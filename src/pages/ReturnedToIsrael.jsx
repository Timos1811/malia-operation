import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Loader2, Plane } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const COLUMNS = [
  { key: 'recipient', label: 'למי הועבר', type: 'readonly' },
  { key: 'amount', label: 'כמה', type: 'readonly' },
  { key: 'returned_to_in_israel', label: 'למי הביאו בארץ', type: 'text', editable: true },
  { key: 'created_date', label: 'תאריך', type: 'readonly' },
  { key: 'currency', label: 'מטבע', type: 'readonly' },
];

export default function ReturnedToIsrael() {
  const [editingCell, setEditingCell] = useState(null);
  const queryClient = useQueryClient();

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ['returned_expenses'],
    queryFn: () => base44.entities.Expense.filter({ reason: 'יצא מהיעד' }, '-created_date'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Expense.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['returned_expenses'] });
      // Also invalidate main expenses list to keep it fresh
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
    },
    onError: () => toast.error('שגיאה בעדכון הנתונים')
  });

  const handleCellChange = (expenseId, value) => {
    updateMutation.mutate({ 
        id: expenseId, 
        data: { returned_to_in_israel: value } 
    });
  };

  const handleCellBlur = (e) => {
    if (!e.relatedTarget || !e.relatedTarget.closest('td')) {
      setTimeout(() => setEditingCell(null), 0);
    }
  };

  const handleKeyDown = (e, rowId, value) => {
    if (e.key === 'Enter') {
        setEditingCell(null);
        handleCellChange(rowId, value);
    }
  };

  const renderCellContent = (expense, col) => {
      if (col.key === 'created_date') {
          return <span className="text-slate-600 font-medium">{expense.created_date ? new Date(expense.created_date).toLocaleDateString('he-IL') : '-'}</span>;
      }
      if (col.key === 'amount') {
           // Maybe format currency if needed, but plain number is fine based on request
           return expense[col.key];
      }
      
      const value = expense[col.key];
      if (value === null || value === undefined || value === '') {
          return <span className="text-slate-400">—</span>;
      }
      return value;
  };

  return (
    <div className="p-8 md:p-12" dir="rtl">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Plane className="w-8 h-8 text-slate-600 transform rotate-180" />
          <h1 className="text-3xl font-light text-slate-800 tracking-tight">
            חזר לארץ
          </h1>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-x-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
            </div>
          ) : expenses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <Plane className="w-12 h-12 mb-4" />
              <p className="text-lg">אין נתונים להצגה</p>
            </div>
          ) : (
            <table className="w-full min-w-[800px]">
              <thead>
                <tr className="bg-slate-50/80">
                  {COLUMNS.map((col) => (
                      <th key={col.key} className="px-4 py-4 text-right text-xs font-medium text-slate-500 border-b border-slate-200/60 whitespace-nowrap">
                          {col.label}
                      </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {expenses.map((expense) => (
                  <tr 
                    key={expense.id} 
                    className={`${!expense.returned_to_in_israel ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-slate-50/50'} transition-colors border-b border-slate-100 last:border-0`}
                  >
                    {COLUMNS.map((col) => (
                        <td key={col.key} className="px-2 py-2 text-sm border-b border-slate-100 last:border-b-0">
                            {col.editable && editingCell === expense.id ? (
                                <Input
                                    autoFocus
                                    defaultValue={expense[col.key]}
                                    onBlur={(e) => {
                                        handleCellBlur(e);
                                        if (e.target.value !== (expense[col.key] || '')) {
                                            handleCellChange(expense.id, e.target.value);
                                        }
                                    }}
                                    onKeyDown={(e) => handleKeyDown(e, expense.id, e.target.value)}
                                    className="h-9 border-slate-300 focus:border-slate-500 focus:ring-slate-500 text-right"
                                />
                            ) : (
                                <div 
                                    className={`px-4 py-2 min-h-[36px] rounded-lg transition-colors flex items-center ${col.editable ? 'cursor-text hover:bg-slate-100' : 'cursor-default'}`}
                                    onMouseDown={(e) => {
                                        if (!col.editable) return;
                                        e.preventDefault();
                                        setEditingCell(expense.id);
                                    }}
                                >
                                    {renderCellContent(expense, col)}
                                </div>
                            )}
                        </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}