import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";

const COLUMNS = [
  { key: 'supplier', label: 'ספק' },
  { key: 'description', label: 'תיאור' },
  { key: 'amount', label: 'סכום' },
  { key: 'currency', label: 'מטבע' },
  { key: 'expense_date', label: 'תאריך' },
];

export default function CreateExpense() {
  const rowsCount = 5;

  const [tableData, setTableData] = useState(() => {
    const saved = localStorage.getItem('expenseTableData');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    return Array.from({ length: rowsCount }, () => ({
      supplier: '',
      description: '',
      amount: '',
      currency: 'ILS',
      expense_date: new Date().toISOString().split('T')[0]
    }));
  });

  useEffect(() => {
    localStorage.setItem('expenseTableData', JSON.stringify(tableData));
  }, [tableData]);

  const handleCellChange = (rowIndex, key, value) => {
    const newData = [...tableData];
    newData[rowIndex][key] = value;
    setTableData(newData);
  };

  const handleSaveAll = async () => {
    const rowsToSave = tableData.filter(row => 
      row.supplier && row.amount && row.expense_date
    );

    if (rowsToSave.length === 0) {
      toast.error('אין נתונים תקינים לשמירה (חובה למלא ספק, סכום ותאריך)');
      return;
    }

    try {
      let savedCount = 0;
      for (const row of rowsToSave) {
        await base44.entities.Expense.create({
          ...row,
          amount: parseFloat(row.amount)
        });
        savedCount++;
      }

      toast.success(`${savedCount} הוצאות נשמרו בהצלחה!`);
      
      // Clear saved rows
      const emptyRow = {
        supplier: '',
        description: '',
        amount: '',
        currency: 'ILS',
        expense_date: new Date().toISOString().split('T')[0]
      };
      
      setTableData(prev => {
         // Keep rows that weren't saved (incomplete ones), or reset if they were all saved
         // For simplicity, let's just reset the rows that were valid, similar to the other table
         // Actually, let's just reset the whole table logic like the user asked for previously
         // "Valid rows saved and cleared, invalid remain"
         
         const newTable = prev.map(row => {
             if (row.supplier && row.amount && row.expense_date) {
                 return { ...emptyRow };
             }
             return row;
         });
         return newTable;
      });

    } catch (error) {
      console.error(error);
      toast.error('שגיאה בשמירת הנתונים');
    }
  };

  return (
    <div className="p-8 md:p-12 text-right" dir="rtl">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-slate-800 mb-8">הוספת הוצאה חדשה</h1>
        
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead>
              <tr className="bg-slate-50">
                {COLUMNS.map((col) => (
                  <th key={col.key} className="px-4 py-4 text-xs font-semibold text-slate-500 border-b">
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableData.map((row, rowIndex) => (
                <tr key={rowIndex} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-2 py-2 border-b border-slate-100">
                    <Input 
                      value={row.supplier} 
                      onChange={(e) => handleCellChange(rowIndex, 'supplier', e.target.value)}
                      placeholder="שם הספק"
                      className="text-right"
                    />
                  </td>
                  <td className="px-2 py-2 border-b border-slate-100">
                    <Input 
                      value={row.description} 
                      onChange={(e) => handleCellChange(rowIndex, 'description', e.target.value)}
                      placeholder="תיאור"
                      className="text-right"
                    />
                  </td>
                  <td className="px-2 py-2 border-b border-slate-100">
                    <Input 
                      type="number"
                      value={row.amount} 
                      onChange={(e) => handleCellChange(rowIndex, 'amount', e.target.value)}
                      placeholder="0.00"
                      className="text-right"
                    />
                  </td>
                  <td className="px-2 py-2 border-b border-slate-100">
                    <Select 
                        value={row.currency} 
                        onValueChange={(val) => handleCellChange(rowIndex, 'currency', val)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ILS">₪ (ILS)</SelectItem>
                        <SelectItem value="USD">$ (USD)</SelectItem>
                        <SelectItem value="EUR">€ (EUR)</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-2 py-2 border-b border-slate-100">
                    <Input 
                      type="date"
                      value={row.expense_date} 
                      onChange={(e) => handleCellChange(rowIndex, 'expense_date', e.target.value)}
                      className="text-right"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-8 flex justify-center gap-4">
          <Button onClick={handleSaveAll} className="bg-slate-800 hover:bg-slate-900 text-white px-10 py-6 rounded-xl shadow-lg">
            שמור הוצאות
          </Button>
        </div>
      </div>
    </div>
  );
}