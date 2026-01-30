import React from 'react';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Loader2, Receipt } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";

export default function AllExpenses() {
  const queryClient = useQueryClient();

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ['expenses'],
    queryFn: () => base44.entities.Expense.list('-created_date'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Expense.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      toast.success('ההוצאה עודכנה');
    },
    onError: () => toast.error('שגיאה בעדכון ההוצאה')
  });

  const handleUpdate = (id, field, value) => {
    // If updating amount, make sure it's a number
    const finalValue = field === 'amount' ? parseFloat(value) : value;
    updateMutation.mutate({ id, data: { [field]: finalValue } });
  };

  const formatCurrency = (amount, currency) => {
    if (!amount) return '-';
    const formatter = new Intl.NumberFormat('he-IL', {
      style: 'currency',
      currency: currency || 'ILS',
    });
    return formatter.format(amount);
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
            </div>
          ) : (
            <table className="w-full min-w-[800px]">
              <thead>
                <tr className="bg-slate-50/80">
                  <th className="px-4 py-4 text-right text-xs font-medium text-slate-500">תאריך</th>
                  <th className="px-4 py-4 text-right text-xs font-medium text-slate-500">ספק</th>
                  <th className="px-4 py-4 text-right text-xs font-medium text-slate-500">תיאור</th>
                  <th className="px-4 py-4 text-right text-xs font-medium text-slate-500">סכום</th>
                  <th className="px-4 py-4 text-right text-xs font-medium text-slate-500">מטבע</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((expense) => (
                  <tr key={expense.id} className="hover:bg-slate-50/50 transition-colors border-b border-slate-100 last:border-0">
                    <td className="px-4 py-3">
                      <Input 
                        type="date"
                        defaultValue={expense.expense_date}
                        onBlur={(e) => {
                            if (e.target.value !== expense.expense_date) {
                                handleUpdate(expense.id, 'expense_date', e.target.value);
                            }
                        }}
                        className="h-8 w-full bg-transparent border-transparent hover:border-slate-200 focus:bg-white"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Input 
                        defaultValue={expense.supplier}
                        onBlur={(e) => {
                             if (e.target.value !== expense.supplier) {
                                 handleUpdate(expense.id, 'supplier', e.target.value);
                             }
                        }}
                        className="h-8 w-full bg-transparent border-transparent hover:border-slate-200 focus:bg-white"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Input 
                        defaultValue={expense.description}
                        onBlur={(e) => {
                             if (e.target.value !== expense.description) {
                                 handleUpdate(expense.id, 'description', e.target.value);
                             }
                        }}
                        className="h-8 w-full bg-transparent border-transparent hover:border-slate-200 focus:bg-white"
                      />
                    </td>
                    <td className="px-4 py-3 font-medium">
                      <Input 
                        type="number"
                        defaultValue={expense.amount}
                        onBlur={(e) => {
                             const val = parseFloat(e.target.value);
                             if (val !== expense.amount) {
                                 handleUpdate(expense.id, 'amount', e.target.value);
                             }
                        }}
                        className="h-8 w-full bg-transparent border-transparent hover:border-slate-200 focus:bg-white text-left"
                        dir="ltr"
                      />
                    </td>
                    <td className="px-4 py-3">
                        <Select 
                            defaultValue={expense.currency} 
                            onValueChange={(val) => handleUpdate(expense.id, 'currency', val)}
                        >
                          <SelectTrigger className="h-8 w-[100px] border-transparent hover:border-slate-200 focus:bg-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ILS">₪ ILS</SelectItem>
                            <SelectItem value="USD">$ USD</SelectItem>
                            <SelectItem value="EUR">€ EUR</SelectItem>
                          </SelectContent>
                        </Select>
                    </td>
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