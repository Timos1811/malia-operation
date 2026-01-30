import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";

const COLUMNS = [
  { key: 'reason', label: 'סיבת הוצאה' },
  { key: 'recipient', label: 'למי הועבר' },
  { key: 'event', label: 'אירוע' },
  { key: 'amount', label: 'סכום' },
  { key: 'currency', label: 'מטבע' },
];

export default function CreateExpense() {
  const rowsCount = 5;

  const [tableData, setTableData] = useState(() => {
    const saved = localStorage.getItem('expenseTableData');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    return Array.from({ length: rowsCount }, () => ({
      reason: '',
      recipient: '',
      event: '',
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
      row.reason && row.recipient && row.amount
    );

    if (rowsToSave.length === 0) {
      toast.error('אין נתונים תקינים לשמירה (חובה למלא סיבה, למי הועבר וסכום)');
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
      
      const emptyRow = {
        reason: '',
        recipient: '',
        event: '',
        amount: '',
        currency: 'ILS',
        expense_date: new Date().toISOString().split('T')[0]
      };
      
      setTableData(prev => {
         const newTable = prev.map(row => {
             if (row.reason && row.recipient && row.amount) {
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
                    <Select 
                        value={row.reason} 
                        onValueChange={(val) => handleCellChange(rowIndex, 'reason', val)}
                    >
                      <SelectTrigger className="w-full h-10 text-right" dir="rtl">
                        <SelectValue placeholder="בחר סיבה" />
                      </SelectTrigger>
                      <SelectContent dir="rtl">
                        <SelectItem value="יצא מהיעד">יצא מהיעד</SelectItem>
                        <SelectItem value="החזר מלא">החזר מלא</SelectItem>
                        <SelectItem value="החזר חלקי">החזר חלקי</SelectItem>
                        <SelectItem value="רכב">רכב</SelectItem>
                        <SelectItem value="אחר">אחר</SelectItem>
                        <SelectItem value="משיכה לאדם">משיכה לאדם</SelectItem>
                        <SelectItem value="תשלום לספק">תשלום לספק</SelectItem>
                        <SelectItem value="פיצוי קשרי תעופה">פיצוי קשרי תעופה</SelectItem>
                        <SelectItem value="פיצוי נטו פאן">פיצוי נטו פאן</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-2 py-2 border-b border-slate-100">
                    {row.reason === 'תשלום לספק' ? (
                        <Select 
                            value={row.recipient} 
                            onValueChange={(val) => handleCellChange(rowIndex, 'recipient', val)}
                        >
                            <SelectTrigger className="w-full h-10 text-right" dir="rtl">
                                <SelectValue placeholder="בחר ספק" />
                            </SelectTrigger>
                            <SelectContent dir="rtl">
                                <SelectItem value="מנוס">מנוס</SelectItem>
                                <SelectItem value="טמיס">טמיס</SelectItem>
                                <SelectItem value="מייק">מייק</SelectItem>
                                <SelectItem value="מגדה">מגדה</SelectItem>
                            </SelectContent>
                        </Select>
                    ) : (
                        <Input 
                            value={row.recipient} 
                            onChange={(e) => handleCellChange(rowIndex, 'recipient', e.target.value)}
                            className="text-right h-10"
                        />
                    )}
                  </td>
                  <td className="px-2 py-2 border-b border-slate-100">
                    {row.reason === 'תשלום לספק' ? (
                        <Select 
                            value={row.event} 
                            onValueChange={(val) => handleCellChange(rowIndex, 'event', val)}
                        >
                            <SelectTrigger className="w-full h-10 text-right" dir="rtl">
                                <SelectValue placeholder="בחר אירוע" />
                            </SelectTrigger>
                            <SelectContent dir="rtl">
                                <SelectItem value="קודו">קודו</SelectItem>
                                <SelectItem value="קנדי">קנדי</SelectItem>
                                <SelectItem value="הסעות">הסעות</SelectItem>
                            </SelectContent>
                        </Select>
                    ) : (
                        <div className="bg-slate-50 h-10 rounded-md border border-slate-100" />
                    )}
                  </td>
                  <td className="px-2 py-2 border-b border-slate-100">
                    <Input 
                      type="number"
                      value={row.amount} 
                      onChange={(e) => handleCellChange(rowIndex, 'amount', e.target.value)}
                      className="text-right h-10"
                    />
                  </td>
                  <td className="px-2 py-2 border-b border-slate-100">
                    <Select 
                        value={row.currency} 
                        onValueChange={(val) => handleCellChange(rowIndex, 'currency', val)}
                    >
                      <SelectTrigger className="w-full h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ILS">₪ (ILS)</SelectItem>
                        <SelectItem value="USD">$ (USD)</SelectItem>
                        <SelectItem value="EUR">€ (EUR)</SelectItem>
                      </SelectContent>
                    </Select>
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