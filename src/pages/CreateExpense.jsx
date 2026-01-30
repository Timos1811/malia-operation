import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
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
  const [openSheetIndex, setOpenSheetIndex] = useState(null);

  useEffect(() => {
    localStorage.setItem('expenseTableData', JSON.stringify(tableData));
  }, [tableData]);

  const handleCellChange = (rowIndex, key, value) => {
    const newData = [...tableData];
    newData[rowIndex][key] = value;
    
    // Clear event details if reason changes from supplier payment
    if (key === 'reason' && value !== 'תשלום לספק') {
        const newDetails = { ...eventDetails };
        delete newDetails[rowIndex];
        setEventDetails(newDetails);
    }
    
    setTableData(newData);
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
                toast.error(`בשורה ${i + 1}: חובה להזין פרטי אירועים עבור תשלום לספק`);
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
                      {row.reason === 'תשלום לספק' && (
                          <Sheet open={openSheetIndex === rowIndex} onOpenChange={(open) => setOpenSheetIndex(open ? rowIndex : null)}>
                              <SheetTrigger asChild>
                                  <Button variant="outline" className="w-full border-blue-200 text-blue-700 hover:bg-blue-50">
                                      {eventDetails[rowIndex]?.length > 0 
                                          ? `פרטי אירועים (${eventDetails[rowIndex].length})`
                                          : 'הוסף פרטי אירוע (חובה)'}
                                  </Button>
                              </SheetTrigger>
                              <SheetContent side="left" className="w-[600px] sm:w-[540px] overflow-y-auto">
                                  <SheetHeader className="mb-6 text-right">
                                      <SheetTitle>פרטי אירועים לתשלום ספק</SheetTitle>
                                  </SheetHeader>
                                  
                                  <div className="space-y-4">
                                      <Table dir="rtl">
                                          <TableHeader>
                                              <TableRow>
                                                  <TableHead className="text-right">אירוע</TableHead>
                                                  <TableHead className="text-right">תאריך</TableHead>
                                                  <TableHead className="text-right">קונים</TableHead>
                                                  <TableHead className="text-right">נסרקים</TableHead>
                                                  <TableHead></TableHead>
                                              </TableRow>
                                          </TableHeader>
                                          <TableBody>
                                              {eventDetails[rowIndex]?.map((detail, dIndex) => (
                                                  <TableRow key={dIndex}>
                                                      <TableCell className="p-1">
                                                          <Select 
                                                              value={detail.event_name} 
                                                              onValueChange={(v) => handleEventDetailChange(rowIndex, dIndex, 'event_name', v)}
                                                          >
                                                              <SelectTrigger className="h-8">
                                                                  <SelectValue />
                                                              </SelectTrigger>
                                                              <SelectContent>
                                                                  <SelectItem value="קודו">קודו</SelectItem>
                                                                  <SelectItem value="קנדי">קנדי</SelectItem>
                                                                  <SelectItem value="הסעות">הסעות</SelectItem>
                                                              </SelectContent>
                                                          </Select>
                                                      </TableCell>
                                                      <TableCell className="p-1">
                                                          <Input 
                                                              type="date" 
                                                              value={detail.event_date} 
                                                              onChange={(e) => handleEventDetailChange(rowIndex, dIndex, 'event_date', e.target.value)}
                                                              className="h-8"
                                                          />
                                                      </TableCell>
                                                      <TableCell className="p-1">
                                                          <Input 
                                                              type="number" 
                                                              placeholder="0"
                                                              value={detail.buyers_count} 
                                                              onChange={(e) => handleEventDetailChange(rowIndex, dIndex, 'buyers_count', e.target.value)}
                                                              className="h-8"
                                                          />
                                                      </TableCell>
                                                      <TableCell className="p-1">
                                                          <Input 
                                                              type="number" 
                                                              placeholder="0"
                                                              value={detail.scanned_count} 
                                                              onChange={(e) => handleEventDetailChange(rowIndex, dIndex, 'scanned_count', e.target.value)}
                                                              className="h-8"
                                                          />
                                                      </TableCell>
                                                      <TableCell className="p-1">
                                                          <Button variant="ghost" size="icon" onClick={() => removeEventRow(rowIndex, dIndex)} className="h-8 w-8 text-red-500">
                                                              <Trash2 className="h-4 w-4" />
                                                          </Button>
                                                      </TableCell>
                                                  </TableRow>
                                              ))}
                                          </TableBody>
                                      </Table>
                                      
                                      <Button onClick={() => addEventRow(rowIndex)} className="w-full gap-2" variant="secondary">
                                          <Plus className="h-4 w-4" /> הוסף שורה
                                      </Button>
                                      
                                      <Button onClick={() => setOpenSheetIndex(null)} className="w-full mt-4">
                                          סיום ועבור לטבלה
                                      </Button>
                                  </div>
                              </SheetContent>
                          </Sheet>
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