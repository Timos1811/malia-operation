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

function TaskList() {
  const queryClient = useQueryClient();
  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => base44.entities.Task.list('-created_date'),
  });

  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, status }) => base44.entities.Task.update(id, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  });

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
      {tasks.map((task) => {
        const isRefund = task.task_type === 'refund';
        const isDone = task.status === 'done';
        
        return (
          <Card 
            key={task.id} 
            className={`transition-all ${
              isRefund && !isDone 
                ? 'bg-red-50 border-red-200 shadow-md' 
                : isDone ? 'bg-slate-50 opacity-70' : 'bg-white'
            }`}
          >
            <CardContent className="p-6 flex items-start justify-between gap-4">
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <h3 className={`font-bold text-lg ${isRefund && !isDone ? 'text-red-700' : 'text-slate-800'} ${isDone ? 'line-through' : ''}`}>
                    {task.title}
                  </h3>
                  {isRefund && (
                    <Badge variant={isDone ? "outline" : "destructive"}>
                      {task.refund_type === 'full' ? 'החזר מלא' : 'החזר חלקי'}
                    </Badge>
                  )}
                  {task.amount > 0 && (
                    <Badge variant="secondary">
                      €{task.amount}
                    </Badge>
                  )}
                </div>
                <p className="text-slate-600 text-sm whitespace-pre-wrap">{task.description}</p>
                {task.order_number && (
                  <div className="flex gap-4 text-sm mt-2 text-slate-700">
                    <span className="font-medium bg-slate-100 px-2 py-0.5 rounded">הזמנה: {task.order_number}</span>
                    {task.people_count > 0 && (
                      <span className="font-medium bg-slate-100 px-2 py-0.5 rounded">כמות אנשים: {task.people_count}</span>
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
                onClick={() => toggleStatusMutation.mutate({ 
                  id: task.id, 
                  status: isDone ? 'todo' : 'done' 
                })}
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