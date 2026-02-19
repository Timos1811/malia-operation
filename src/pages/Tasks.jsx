import React, { useState } from 'react';
import { CheckSquare, Plus, AlertCircle, CheckCircle2, Repeat, CalendarDays } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

function TaskList() {
  const queryClient = useQueryClient();
  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => base44.entities.Task.list('-created_date'),
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Task.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  });

  const sortedTasks = React.useMemo(() => {
    const today = new Date();
    // Use local date for accurate day comparison
    const todayDateString = today.toLocaleDateString('en-CA');
    const dayOfWeek = today.getDay();

    const filtered = tasks.filter(task => {
      if (task.is_recurring) {
        // Safely check if recurring_days includes today
        if (!Array.isArray(task.recurring_days) || task.recurring_days.length === 0) return true;
        return task.recurring_days.includes(dayOfWeek);
      }
      return true;
    });

    return filtered.sort((a, b) => {
      let aDone = a.status === 'done';
      let bDone = b.status === 'done';

      // Check completion for recurring tasks using LOCAL date
      if (a.is_recurring) {
         aDone = !!a.last_completed_at && new Date(a.last_completed_at).toLocaleDateString('en-CA') === todayDateString;
      }
      if (b.is_recurring) {
         bDone = !!b.last_completed_at && new Date(b.last_completed_at).toLocaleDateString('en-CA') === todayDateString;
      }

      if (aDone === bDone) {
        if (!aDone) {
          // Both TODO: Recurring first
          if (a.is_recurring && !b.is_recurring) return -1;
          if (!a.is_recurring && b.is_recurring) return 1;
        }
        // Maintain created_date sort (newest first)
        return new Date(b.created_date) - new Date(a.created_date);
      }
      return aDone ? 1 : -1;
    });
  }, [tasks]);

  const handleStatusToggle = async (task) => {
    const todayDateString = new Date().toLocaleDateString('en-CA');
    let isDone = task.status === 'done';
    
    if (task.is_recurring) {
      isDone = !!task.last_completed_at && new Date(task.last_completed_at).toLocaleDateString('en-CA') === todayDateString;
    }

    const newStatus = isDone ? 'todo' : 'done';

    // Recurring Logic Update
    if (task.is_recurring) {
      updateTaskMutation.mutate({
        id: task.id,
        data: {
          last_completed_at: !isDone ? new Date().toISOString() : null
        }
      });
      return; // Stop here for recurring tasks (they don't trigger expenses/side-effects for now based on request simplicity)
    }

    // Normal Task Logic
    // add_event logic is now handled automatically in AddEventToWristband.js
    // We keep the task just for logging purposes
    if (newStatus === 'done' && task.task_type === 'add_event') {
        // Just toggle the status, no side effects
    }

    if (newStatus === 'done' && task.task_type === 'refund') {
      try {
        // Security Check: Verify no scans occurred between request creation and approval
        if (task.order_number && task.related_events && task.related_events.length > 0) {
           const scanLogs = await base44.entities.WristbandScanLog.filter({ order_number: task.order_number });
           const targetWristbandIds = task.related_wristbands || [];
           
           const hasScanned = scanLogs.some(log => {
             const isRelatedEvent = task.related_events.includes(log.event_name);
             const isTargetWristband = targetWristbandIds.length === 0 || targetWristbandIds.includes(log.nfc_id);
             const isSuccessfulScan = log.status === 'success' || log.status === 'processed';
             return isRelatedEvent && isTargetWristband && isSuccessfulScan;
           });

           if (hasScanned) {
             toast.error('לא ניתן לאשר את ההחזר: זוהתה כניסה לאירוע (סריקה) לאחר יצירת הבקשה!');
             return; // Stop execution
           }
        }

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

    updateTaskMutation.mutate({ id: task.id, data: { status: newStatus } });
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
        
        // Determine "Done" status
        const todayDateString = new Date().toLocaleDateString('en-CA');
        let isDone = task.status === 'done';
        if (task.is_recurring) {
          isDone = !!task.last_completed_at && new Date(task.last_completed_at).toLocaleDateString('en-CA') === todayDateString;
        }
        
        // For supplier payments and add_event, amount is already total. For refunds, it's per person.
        const displayAmount = (isSupplierPayment || isAddEvent)
            ? task.amount 
            : (task.amount * (task.people_count || 1));

        return (
          <Card 
            key={task.id} 
            className={`transition-all ${
              !isDone 
                ? (task.is_recurring ? 'bg-amber-50 border-amber-200 shadow-md ring-1 ring-amber-100' : 'bg-red-50 border border-red-200 shadow-sm')
                : 'bg-slate-50 opacity-70 border border-slate-200'
            }`}
          >
            <CardContent className="p-6 flex items-start justify-between gap-4">
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2">
                    {task.is_recurring && (
                      <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-200 gap-1">
                        <Repeat className="w-3 h-3" /> משימה קבועה
                      </Badge>
                    )}
                    <h3 className={`font-bold text-lg ${!isDone ? (task.is_recurring ? 'text-amber-900' : isAddEvent ? 'text-purple-900' : 'text-red-900') : 'text-slate-800'} ${isDone ? 'line-through' : ''}`}>
                      {task.title}
                    </h3>
                  </div>
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
  const [isAdmin, setIsAdmin] = useState(false);
  const [isRecurringDialogOpen, setIsRecurringDialogOpen] = useState(false);
  const [recurringTitle, setRecurringTitle] = useState('');
  const [recurringDays, setRecurringDays] = useState([0, 1, 2, 3, 4, 5, 6]); // Default all days
  const queryClient = useQueryClient();

  React.useEffect(() => {
    base44.auth.me().then(user => {
      setIsAdmin(user?.role === 'admin');
    }).catch(() => {});
  }, []);

  const createRecurringTask = async () => {
    if (!recurringTitle.trim()) return;

    try {
      await base44.entities.Task.create({
        title: recurringTitle,
        is_recurring: true,
        recurring_days: recurringDays,
        status: 'todo',
        task_type: 'general',
        description: 'משימה קבועה'
      });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setIsRecurringDialogOpen(false);
      setRecurringTitle('');
      setRecurringDays([0, 1, 2, 3, 4, 5, 6]);
      toast.success('משימה קבועה נוצרה בהצלחה');
    } catch (e) {
      toast.error('שגיאה ביצירת משימה');
    }
  };

  const days = [
    { label: 'א', value: 0 },
    { label: 'ב', value: 1 },
    { label: 'ג', value: 2 },
    { label: 'ד', value: 3 },
    { label: 'ה', value: 4 },
    { label: 'ו', value: 5 },
    { label: 'ש', value: 6 },
  ];

  return (
    <div className="p-8 md:p-12 text-right" dir="rtl">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <CheckSquare className="w-8 h-8 text-slate-600" />
            <h1 className="text-3xl font-bold text-slate-800">משימות</h1>
          </div>
          
          <div className="flex gap-3">
            {isAdmin && (
              <Dialog open={isRecurringDialogOpen} onOpenChange={setIsRecurringDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="gap-2 border-dashed border-slate-300">
                    <Repeat className="w-4 h-4" />
                    הוסף משימה קבועה
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>הוספת משימה קבועה (מנהל)</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label>כותרת המשימה</Label>
                      <Input 
                        value={recurringTitle}
                        onChange={(e) => setRecurringTitle(e.target.value)}
                        placeholder="לדוגמה: בדיקת מלאי בוקר"
                      />
                    </div>
                    
                    <div className="space-y-3">
                      <Label>ימי הופעה</Label>
                      <div className="flex flex-wrap gap-2">
                        {days.map(day => {
                          const isSelected = recurringDays.includes(day.value);
                          return (
                            <div 
                              key={day.value}
                              onClick={() => {
                                setRecurringDays(prev => 
                                  isSelected 
                                    ? prev.filter(d => d !== day.value)
                                    : [...prev, day.value]
                                );
                              }}
                              className={`
                                w-10 h-10 rounded-full flex items-center justify-center cursor-pointer transition-all font-bold text-sm border
                                ${isSelected ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-300'}
                              `}
                            >
                              {day.label}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <Button onClick={createRecurringTask} className="w-full mt-4">
                      צור משימה קבועה
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}

            <Link to={createPageUrl('AddTask')}>
              <Button className="bg-slate-900 text-white hover:bg-slate-800 gap-2">
                <Plus className="w-4 h-4" />
                הוסף בקשה חדשה
              </Button>
            </Link>
          </div>
        </div>
        
        <TaskList />
      </div>
    </div>
  );
}