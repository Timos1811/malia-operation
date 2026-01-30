import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
// Sheet imports removed
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2 } from "lucide-react";

const COLUMNS = [
  { key: 'reason', label: 'סיבת הוצאה' },
  { key: 'recipient', label: 'למי הועבר' },
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
      amount: '',
      currency: 'ILS',
      expense_date: new Date().toISOString().split('T')[0]
    }));
  });

  // State for side table data: map rowIndex to array of events
  const [eventDetails, setEventDetails] = useState({});
  const [activeRowIndex, setActiveRowIndex] = useState(null);

  useEffect(() => {
    localStorage.setItem('expenseTableData', JSON.stringify(tableData));
  }, [tableData]);

  const handleCellChange = (rowIndex, key, value) => {
    const newData = [...tableData];
    newData[rowIndex][key] = value;
    
    // Clear event details if reason changes from supplier payment
    if (key === 'reason') {
        if (value !== 'תשלום לספק') {
            const newDetails = { ...eventDetails };
            delete newDetails[rowIndex];
            setEventDetails(newDetails);
        } else {
             // If switched to supplier payment, ensure event details array exists
             if (!eventDetails[rowIndex]) {
                 setEventDetails(prev => ({ ...prev, [rowIndex]: [] }));
             }
        }
    }
    
    setTableData(newData);
    setActiveRowIndex(rowIndex);
  };

  const handleEventDetailChange = (rowIndex, detailIndex, key, value) => {
      setEventDetails(prev => {
          const rowEvents = [...(prev[rowIndex] || [])];
          rowEvents[detailIndex] = { ...rowEvents[detailIndex], [key]: value };
          return { ...prev, [rowIndex]: rowEvents };
      });
  };

  const addEventRow = (rowIndex) => {
      setEventDetails(prev => ({
          ...prev,
          [rowIndex]: [
              ...(prev[rowIndex] || []),
              { event_name: 'קודו', event_date: new Date().toISOString().split('T')[0], buyers_count: '', scanned_count: '' }
          ]
      }));
  };

  const removeEventRow = (rowIndex, detailIndex) => {
      setEventDetails(prev => {
          const rowEvents = [...(prev[rowIndex] || [])];
          rowEvents.splice(detailIndex, 1);
          return { ...prev, [rowIndex]: rowEvents };
      });
  };

  const handleSaveAll = async () => {
    const rowsToSave = tableData.filter(row => 
      row.reason && row.recipient && row.amount
    );

    if (rowsToSave.length === 0) {
      toast.error('אין נתונים תקינים לשמירה (חובה למלא סיבה, למי הועבר וסכום)');
      return;
    }

    // Validation for supplier payments
    for (let i = 0; i < tableData.length; i++) {
        const row = tableData[i];
        if (row.reason === 'תשלום לספק' && row.recipient && row.amount) {
            const details = eventDetails[i];
            if (!details || details.length === 0) {
                toast.error(`בשורה ${i + 1}: חובה להזין פרטי אירועים עבור תשלום לספק (יש לבחור את השורה ולמלא בטבלה הצדדית)`);
                return;
            }
            // Validate inner details
            const incomplete = details.some(d => !d.event_name || !d.event_date || !d.buyers_count || !d.scanned_count);
            if (incomplete) {
                toast.error(`בשורה ${i + 1}: יש למלא את כל שדות פרטי האירוע (תאריך, כמויות)`);
                return;
            }
        }
    }

    try {
      let savedCount = 0;
      for (let i = 0; i < tableData.length; i++) {
        const row = tableData[i];
        if (!row.reason || !row.recipient || !row.amount) continue;

        const expense = await base44.entities.Expense.create({
          reason: row.reason,
          recipient: row.recipient,
          amount: parseFloat(row.amount),
          currency: row.currency,
          expense_date: row.expense_date
        });

        if (row.reason === 'תשלום לספק' && eventDetails[i]) {
            const details = eventDetails[i];
            const eventsToCreate = details.map(d => ({
                expense_id: expense.id,
                event_name: d.event_name,
                event_date: d.event_date,
                buyers_count: parseInt(d.buyers_count),
                scanned_count: parseInt(d.scanned_count)
            }));
            await base44.entities.ExpenseEvent.bulkCreate(eventsToCreate);
        }

        savedCount++;
      }

      toast.success(`${savedCount} הוצאות נשמרו בהצלחה!`);
      
      const emptyRow = {
        reason: '',
        recipient: '',
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
      setEventDetails({});

    } catch (error) {
      console.error(error);
      toast.error('שגיאה בשמירת הנתונים');
    }
  };

  return (
    <div className="p-8 md:p-12 text-right" dir="rtl">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-slate-800 mb-8">הוספת הוצאה חדשה</h1>
        
        <div className="flex flex-col lg:flex-row gap-6">
            <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-x-auto">
              <table className="w-full min-w-[600px]">
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
                    <tr 
                        key={rowIndex} 
                        className={`transition-colors cursor-pointer ${activeRowIndex === rowIndex ? 'bg-blue-50/50 ring-1 ring-blue-200' : 'hover:bg-slate-50/50'}`}
                        onClick={() => setActiveRowIndex(rowIndex)}
                    >
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
                                onFocus={() => setActiveRowIndex(rowIndex)}
                            />
                        )}
                      </td>
                      <td className="px-2 py-2 border-b border-slate-100">
                        <Input 
                          type="number"
                          value={row.amount} 
                          onChange={(e) => handleCellChange(rowIndex, 'amount', e.target.value)}
                          className="text-right h-10"
                          onFocus={() => setActiveRowIndex(rowIndex)}
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

            {/* Side Table for Event Details */}
            {activeRowIndex !== null && tableData[activeRowIndex]?.reason === 'תשלום לספק' && (
                <div className="w-full lg:w-1/3 bg-white rounded-2xl shadow-sm border border-slate-200 p-6 animate-in fade-in slide-in-from-right-4 h-fit">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-bold text-xl text-slate-800">פרטי אירועים (שורה {activeRowIndex + 1})</h3>
                        <div className="text-sm font-medium text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                            {eventDetails[activeRowIndex]?.length || 0} רשומות
                        </div>
                    </div>
                    
                    <div className="bg-white rounded-xl overflow-hidden border border-slate-200 mb-4">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-slate-50">
                                    <th className="px-3 py-3 text-xs font-semibold text-slate-500 border-b text-right">אירוע</th>
                                    <th className="px-3 py-3 text-xs font-semibold text-slate-500 border-b text-right">תאריך</th>
                                    <th className="px-3 py-3 text-xs font-semibold text-slate-500 border-b text-right">קונים</th>
                                    <th className="px-3 py-3 text-xs font-semibold text-slate-500 border-b text-right">נסרקים</th>
                                    <th className="px-3 py-3 text-xs font-semibold text-slate-500 border-b w-8"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {eventDetails[activeRowIndex]?.map((detail, dIndex) => (
                                    <tr key={dIndex} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-2 py-2 border-b border-slate-100">
                                            <Select 
                                                value={detail.event_name} 
                                                onValueChange={(v) => handleEventDetailChange(activeRowIndex, dIndex, 'event_name', v)}
                                            >
                                                <SelectTrigger className="h-10 text-right w-full" dir="rtl">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent dir="rtl">
                                                    <SelectItem value="קודו">קודו</SelectItem>
                                                    <SelectItem value="קנדי">קנדי</SelectItem>
                                                    <SelectItem value="הסעות">הסעות</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </td>
                                        <td className="px-2 py-2 border-b border-slate-100">
                                            <Input 
                                                type="date" 
                                                value={detail.event_date} 
                                                onChange={(e) => handleEventDetailChange(activeRowIndex, dIndex, 'event_date', e.target.value)}
                                                className="h-10 w-full"
                                            />
                                        </td>
                                        <td className="px-2 py-2 border-b border-slate-100">
                                            <Input 
                                                type="number" 
                                                placeholder="0"
                                                value={detail.buyers_count} 
                                                onChange={(e) => handleEventDetailChange(activeRowIndex, dIndex, 'buyers_count', e.target.value)}
                                                className="h-10 text-right w-full"
                                            />
                                        </td>
                                        <td className="px-2 py-2 border-b border-slate-100">
                                            <Input 
                                                type="number" 
                                                placeholder="0"
                                                value={detail.scanned_count} 
                                                onChange={(e) => handleEventDetailChange(activeRowIndex, dIndex, 'scanned_count', e.target.value)}
                                                className="h-10 text-right w-full"
                                            />
                                        </td>
                                        <td className="px-2 py-2 border-b border-slate-100 text-center">
                                            <Button variant="ghost" size="icon" onClick={() => removeEventRow(activeRowIndex, dIndex)} className="h-8 w-8 text-slate-400 hover:text-red-500 hover:bg-red-50">
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                                {(!eventDetails[activeRowIndex] || eventDetails[activeRowIndex].length === 0) && (
                                    <tr>
                                        <td colSpan={5} className="text-center text-slate-400 py-8 text-sm bg-slate-50/30">
                                            אין אירועים מוזנים
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    
                    <Button onClick={() => addEventRow(activeRowIndex)} className="w-full gap-2 bg-slate-800 hover:bg-slate-900 text-white py-6 rounded-xl shadow-sm">
                        <Plus className="h-5 w-5" /> הוסף שורת אירוע
                    </Button>
                    
                    <div className="mt-4 text-xs text-red-500 bg-red-50 p-3 rounded-lg border border-red-100 text-center">
                       * חובה למלא את פרטי האירועים לשמירת ההוצאה
                    </div>
                </div>
            )}
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