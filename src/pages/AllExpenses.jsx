import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Loader2, Receipt } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";

const COLUMNS = [
  { key: 'expense_date', label: 'תאריך', type: 'date' },
  { key: 'supplier', label: 'ספק', type: 'text' },
  { key: 'description', label: 'תיאור', type: 'text' },
  { key: 'amount', label: 'סכום', type: 'number' },
  { key: 'currency', label: 'מטבע', type: 'select' },
];

export default function AllExpenses() {
  const [editingCell, setEditingCell] = useState(null);
  const queryClient = useQueryClient();

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ['expenses'],
    queryFn: () => base44.entities.Expense.list('-created_date'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Expense.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      // toast.success('ההוצאה עודכנה'); // SavedData usually doesn't toast on every cell update to avoid spam
    },
    onError: () => toast.error('שגיאה בעדכון ההוצאה')
  });

  const handleCellChange = (id, field, value) => {
    const finalValue = field === 'amount' ? parseFloat(value) : value;
    updateMutation.mutate({ id, data: { [field]: finalValue } });
  };

  const handleCellBlur = (e) => {
    // Only close if we're not moving to another cell (logic handled by timeout or relatedTarget check)
    // SavedData uses a timeout to allow focus to move
    if (!e.relatedTarget || !e.relatedTarget.closest('td')) {
      setTimeout(() => setEditingCell(null), 0);
    }
  };

  const handleKeyDown = (e, rowId, colKey) => {
      const expensesList = expenses; // current list
      const currentRowIndex = expensesList.findIndex(r => r.id === rowId);
      const currentColIndex = COLUMNS.findIndex(c => c.key === colKey);

      if (e.key === 'Enter') {
        setEditingCell(null);
        handleCellChange(rowId, colKey, e.target.value);
      } else if (e.key === 'Tab') {
        e.preventDefault();
        handleCellChange(rowId, colKey, e.target.value);
        
        if (e.shiftKey) {
          // Shift+Tab - move to previous cell
          if (currentColIndex > 0) {
            setEditingCell({ row: rowId, col: COLUMNS[currentColIndex - 1].key });
          } else if (currentRowIndex > 0) {
            setEditingCell({ row: expensesList[currentRowIndex - 1].id, col: COLUMNS[COLUMNS.length - 1].key });
          }
        } else {
          // Tab - move to next cell
          if (currentColIndex < COLUMNS.length - 1) {
            setEditingCell({ row: rowId, col: COLUMNS[currentColIndex + 1].key });
          } else if (currentRowIndex < expensesList.length - 1) {
            setEditingCell({ row: expensesList[currentRowIndex + 1].id, col: COLUMNS[0].key });
          }
        }
      }
  };

  const renderCellContent = (expense, col) => {
      if (col.key === 'currency') {
          return expense[col.key] || <span className="text-slate-400">—</span>;
      }
      if (col.key === 'amount') {
          return expense[col.key] ? expense[col.key] : <span className="text-slate-400">—</span>;
      }
      return expense[col.key] || <span className="text-slate-400">—</span>;
  };

  return (
    <div className="p-8 md:p-12" dir="rtl">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Receipt className="w-8 h-8 text-slate-600" />
          <h1 className="text-3xl font-light text-slate-800 tracking-tight">
            כל ההוצאות
          </h1>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-x-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
            </div>
          ) : expenses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <Receipt className="w-12 h-12 mb-4" />
              <p className="text-lg">אין הוצאות שמורות</p>
              <p className="text-sm mt-1">הוסף שורות מדף צור הוצאה</p>
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
                  <tr key={expense.id} className="hover:bg-slate-50/50 transition-colors border-b border-slate-100 last:border-0">
                    {COLUMNS.map((col) => (
                        <td key={col.key} className="px-2 py-2 text-sm border-b border-slate-100 last:border-b-0">
                            {editingCell?.row === expense.id && editingCell?.col === col.key ? (
                                col.key === 'currency' ? (
                                    <Select 
                                        defaultValue={expense.currency} 
                                        onValueChange={(val) => {
                                            handleCellChange(expense.id, 'currency', val);
                                            // setEditingCell(null); // Keep editing or close? Usually select closes itself, but we might want to stay in edit mode if tab? 
                                            // Select behaves differently, let's close it after selection for UX
                                            setEditingCell(null);
                                        }}
                                        defaultOpen={true}
                                    >
                                      <SelectTrigger className="h-9 w-full border-slate-300 focus:border-slate-500 focus:ring-slate-500">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="ILS">₪ ILS</SelectItem>
                                        <SelectItem value="USD">$ USD</SelectItem>
                                        <SelectItem value="EUR">€ EUR</SelectItem>
                                      </SelectContent>
                                    </Select>
                                ) : (
                                    <Input
                                        autoFocus
                                        type={col.type === 'number' ? 'number' : col.type === 'date' ? 'date' : 'text'}
                                        defaultValue={expense[col.key]}
                                        onBlur={(e) => {
                                            handleCellBlur(e);
                                            if (e.target.value !== String(expense[col.key] || '')) {
                                                handleCellChange(expense.id, col.key, e.target.value);
                                            }
                                        }}
                                        onKeyDown={(e) => handleKeyDown(e, expense.id, col.key)}
                                        className="h-9 border-slate-300 focus:border-slate-500 focus:ring-slate-500 text-right"
                                    />
                                )
                            ) : (
                                <div 
                                    className="px-4 py-2 min-h-[36px] rounded-lg cursor-text hover:bg-slate-100 transition-colors flex items-center"
                                    onMouseDown={(e) => {
                                        e.preventDefault();
                                        setEditingCell({ row: expense.id, col: col.key });
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