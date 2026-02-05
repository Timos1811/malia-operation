import React from 'react';
import { CheckSquare, Plus, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

function TaskList() {
  const queryClient = useQueryClient();
  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => base44.entities.Task.list('-created_date'),
  });

  const sortedTasks = React.useMemo(() => {
    return [...tasks].sort((a, b) => {
      if (a.status === b.status) return 0;
      return a.status === 'done' ? 1 : -1;
    });
  }, [tasks]);

  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, status }) => base44.entities.Task.update(id, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  });

  const handleStatusToggle = async (task) => {
    const isDone = task.status === 'done';
    const newStatus = isDone ? 'todo' : 'done';

    if (newStatus === 'done' && task.task_type === 'add_event') {
        const confirmed = window.confirm(`האם לאשר את הוספת האירועים להזמנה ${task.order_number}? הסכום ${task.amount} ${task.currency} יתווסף להכנסות.`);
        if (!confirmed) return;

        try {
            // 1. Update Wristbands
            const allAttractions = await base44.entities.Attraction.list();
            const eventNames = task.related_events.map(id => {
                const att = allAttractions.find(a => a.id === id);
                return att ? att.name : id;
            });

            if (task.related_wristbands && task.related_wristbands.length > 0) {
                for (const nfcId of task.related_wristbands) {
                    const wristbands = await base44.entities.Wristband.filter({ nfc_id: nfcId });
                    if (wristbands.length > 0) {
                        const wb = wristbands[0];
                        if (wb.status !== 'active') {
                             console.warn(`Skipping event update for inactive wristband: ${nfcId}`);
                             continue;
                        }
                        const currentEvents = wb.allowed_events || [];
                        const uniqueEvents = [...new Set([...currentEvents, ...eventNames])];
                        await base44.entities.Wristband.update(wb.id, { allowed_events: uniqueEvents });
                    }
                }
            }

            // 2. Create PendingSale (instead of direct update)
            let tables = await base44.entities.TableData.filter({ order_number: task.order_number });
            let baseData = {};
            
            if (tables.length > 0) {
                const row = tables[0];
                baseData = {
                    customer: row.customer,
                    departure_date: row.departure_date,
                    nights: row.nights,
                    gender: row.gender,
                    hotel: row.hotel,
                    company: row.company,
                    sales_rep: row.sales_rep
                };
            }

            await base44.entities.PendingSale.create({
                order_number: task.order_number,
                requested_amount: (task.amount || 0).toString(),
                comments: `תוספת עבור אירועים: ${eventNames.join(', ')}`,
                sales_rep: task.sales_rep || baseData.sales_rep,
                ...baseData,
                eur_amount: "0",
                shekel_amount: "0",
                dollar_amount: "0",
                bit_amount: "0"
            });

            toast.success("נוצרה מכירה בהמתנה לאישור התשלום");

        } catch (error) {
            console.error('Failed to process add_event:', error);
            toast.error('שגיאה בעדכון הנתונים');
            return; // Don't complete task on error
        }
    }

    if (newStatus === 'done' && task.task_type === 'refund') {
      try {
        const totalAmount = (task.amount || 0) * (task.people_count || 1);
        
        // 1. Create Expense
        await base44.entities.Expense.create({
          reason: task.refund_type === 'full' ? 'החזר מלא' : 'החזר חלקי',
          recipient: task.order_number || '',
          amount: parseFloat(totalAmount.toFixed(2)),
          currency: 'EUR',
          expense_date: new Date().toISOString().split('T')[0],
          sales_rep: task.sales_rep || ''
        });

        // Invalidate expense queries to update BankTable and AllExpenses immediately
        queryClient.invalidateQueries({ queryKey: ['expenses'] });
        queryClient.invalidateQueries({ queryKey: ['expensesAll'] });

        // 2. Remove events from wristbands if related_events exists
        if (task.order_number && task.related_events && task.related_events.length > 0) {
          const allWristbands = await base44.entities.Wristband.filter({ order_number: task.order_number });
          
          // If specific wristbands were selected for the task, filter only them. Otherwise, apply to all.
          const targetWristbands = (task.related_wristbands && task.related_wristbands.length > 0)
            ? allWristbands.filter(wb => task.related_wristbands.includes(wb.nfc_id))
            : allWristbands;

          if (targetWristbands.length > 0) {
            const updates = targetWristbands.map(wb => {
              const currentEvents = wb.allowed_events || [];
              const newEvents = currentEvents.filter(event => !task.related_events.includes(event));
              
              if (currentEvents.length !== newEvents.length) {
                return base44.entities.Wristband.update(wb.id, { allowed_events: newEvents });
              }
              return null;
            }).filter(Boolean);

            if (updates.length > 0) {
              await Promise.all(updates);
              toast.success(`הוסרו אירועים מ-${updates.length} צמידים`);
            }
          }
        }

        toast.success('הוצאה נוצרה ואירועים עודכנו');
      } catch (error) {
        console.error('Failed to process refund:', error);
        toast.error('שגיאה בעיבוד ההחזר');
      }
    }

    // Handle Supplier Payment Task Completion
    if (newStatus === 'done' && task.task_type === 'supplier_payment') {
      try {
        // 1. Create Expense
        const expense = await base44.entities.Expense.create({
          reason: 'תשלום לספק',
          recipient: task.event_name || 'ספק', // Using event name as recipient or generic
          amount: task.amount || 0,
          currency: task.currency || 'EUR',
          expense_date: new Date().toISOString().split('T')[0], // Date of payment (today)
          sales_rep: task.sales_rep || ''
        });

        // 2. Create ExpenseEvent linked to the expense
        if (expense && expense.id) {
          await base44.entities.ExpenseEvent.create({
            expense_id: expense.id,
            event_name: task.event_name || '',
            event_date: task.event_date || new Date().toISOString().split('T')[0],
            buyers_count: task.people_count || 0,
            scanned_count: task.scanned_count || 0
          });
        }

        queryClient.invalidateQueries({ queryKey: ['expenses'] });
        queryClient.invalidateQueries({ queryKey: ['expensesAll'] });
        
        toast.success('הוצאה לתשלום ספק נוצרה בהצלחה');
      } catch (error) {
        console.error('Failed to process supplier payment:', error);
        toast.error('שגיאה ביצירת הוצאה לספק');
      }
    }

    toggleStatusMutation.mutate({ id: task.id, status: newStatus });
  };

  if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;
  
  if (tasks.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 min-h-[400px] flex items-center justify-center text-slate-400">
        <p>אין משימות להצגה</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {sortedTasks.map((task) => {
        const isRefund = task.task_type === 'refund';
        const isSupplierPayment = task.task_type === 'supplier_payment';
        const isAddEvent = task.task_type === 'add_event';
        const isDone = task.status === 'done';
        
        // For supplier payments and add_event, amount is already total. For refunds, it's per person.
        const displayAmount = (isSupplierPayment || isAddEvent)
            ? task.amount 
            : (task.amount * (task.people_count || 1));

        return (
          <Card 
            key={task.id} 
            className={`transition-all ${
              !isDone 
                ? 'bg-red-50 border border-red-200 shadow-sm' 
                : 'bg-slate-50 opacity-70 border border-slate-200'
            }`}
          >
            <CardContent className="p-6 flex items-start justify-between gap-4">
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <h3 className={`font-bold text-lg ${!isDone ? (isAddEvent ? 'text-purple-900' : 'text-red-900') : 'text-slate-800'} ${isDone ? 'line-through' : ''}`}>
                    {task.title}
                  </h3>
                  {isRefund && (
                    <Badge variant={isDone ? "outline" : "destructive"}>
                      {task.refund_type === 'full' ? 'החזר מלא' : 'החזר חלקי'}
                    </Badge>
                  )}
                  {isAddEvent && (
                    <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-200">
                      הוספת אירוע
                    </Badge>
                  )}
                  {task.amount > 0 && (
                    <Badge variant="secondary" className="text-lg font-bold px-3 py-1">
                      €{parseFloat(displayAmount.toFixed(2))}
                    </Badge>
                  )}
                </div>
                <p className="text-slate-600 text-sm whitespace-pre-wrap">{task.description}</p>
                {task.order_number && (
                  <div className="flex gap-4 text-sm mt-2 text-slate-700">
                    <Link 
                      to={`${createPageUrl('OrderDetails')}?orderNumber=${task.order_number}`}
                      className="font-medium bg-blue-50 text-blue-700 px-2 py-0.5 rounded hover:bg-blue-100 hover:underline transition-colors"
                    >
                      הזמנה: {task.order_number}
                    </Link>
                    {task.people_count > 0 && (
                      <span className="font-medium bg-slate-100 px-2 py-0.5 rounded">כמות אנשים: {task.people_count}</span>
                    )}
                    {task.departure_date && (
                      <span className="font-medium bg-slate-100 px-2 py-0.5 rounded">עזיבה: {task.departure_date}</span>
                    )}
                    </div>
                    )}
                <div className="text-xs text-slate-400 mt-2">
                  {new Date(task.created_date).toLocaleDateString('he-IL')}
                </div>
              </div>
              
              <Button
                variant={isDone ? "outline" : "default"}
                size={isDone ? "icon" : "sm"}
                onClick={() => handleStatusToggle(task)}
                className={isDone ? "text-green-600 border-green-200 bg-green-50 shrink-0" : "bg-green-600 hover:bg-green-700 text-white shrink-0 shadow-sm px-4"}
              >
                {isDone ? <CheckCircle2 className="w-5 h-5" /> : "בוצע"}
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export default function Tasks() {
  return (
    <div className="p-8 md:p-12 text-right" dir="rtl">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <CheckSquare className="w-8 h-8 text-slate-600" />
            <h1 className="text-3xl font-bold text-slate-800">משימות</h1>
          </div>
          <Link to={createPageUrl('AddTask')}>
            <Button className="bg-slate-900 text-white hover:bg-slate-800 gap-2">
              <Plus className="w-4 h-4" />
              הוסף בקשה חדשה
            </Button>
          </Link>
        </div>
        
        <TaskList />
      </div>
    </div>
  );
}