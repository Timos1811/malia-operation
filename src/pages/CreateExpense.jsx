import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  { key: 'notes', label: 'הערות' },
];

export default function CreateExpense() {
  const queryClient = useQueryClient();
  const rowsCount = 5;

  const { data: attractions = [] } = useQuery({
    queryKey: ['attractions'],
    queryFn: () => base44.entities.Attraction.list(),
  });

  // Fetch latest users
  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
  });

  const { data: salesReps = [] } = useQuery({
    queryKey: ['salesRepsExpenses'],
    queryFn: async () => {
         const sales = await base44.entities.TableData.list();
         return [...new Set(sales.map(s => s.sales_rep).filter(Boolean))];
    }
  });

  const allUserNames = React.useMemo(() => {
      const names = new Set(users.map(u => u.full_name).filter(Boolean));
      salesReps.forEach(n => names.add(n));
      return Array.from(names);
  }, [users, salesReps]);

  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const user = await base44.auth.me();
        setCurrentUser(user);
      } catch (e) {
        console.error("Failed to fetch user", e);
      }
    };
    fetchUser();
  }, []);

  const [tableData, setTableData] = useState(() => {
    const saved = localStorage.getItem('expenseTableData_v2');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    return Array.from({ length: rowsCount }, () => ({
      reason: '',
      recipient: '',
      amount: '',
      currency: 'EUR',
      expense_date: new Date().toISOString().split('T')[0],
      notes: ''
    }));
  });

  // State for side table data: map rowIndex to single event object
  const [eventDetails, setEventDetails] = useState({});

  useEffect(() => {
    localStorage.setItem('expenseTableData_v2', JSON.stringify(tableData));
  }, [tableData]);

  const handleCellChange = (rowIndex, key, value) => {
    const newData = [...tableData];
    newData[rowIndex][key] = value;
    setTableData(newData);
  };

  const handleEventDetailChange = (rowIndex, key, value) => {
      setEventDetails(prev => ({
          ...prev,
          [rowIndex]: { ...prev[rowIndex], [key]: value }
      }));
  };

// Unused event row functions removed

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
        const detail = eventDetails[i];

        // If supplier payment, event details are mandatory
        if (row.reason === 'תשלום לספק' && row.recipient && row.amount) {
            if (!detail || !detail.event_name || !detail.event_date || !detail.buyers_count || !detail.scanned_count) {
                toast.error(`בשורה ${i + 1}: חובה להזין את כל פרטי האירוע (כולל תאריך אירוע) עבור תשלום לספק`);
                return;
            }
        }
        
        // If not supplier payment but partially filled, validate completeness
        if (detail && (detail.event_name || detail.event_date || detail.buyers_count || detail.scanned_count)) {
             if (!detail.event_name || !detail.event_date || !detail.buyers_count || !detail.scanned_count) {
                 toast.error(`בשורה ${i + 1}: הוחל במילוי פרטי אירוע, יש להשלים את כל השדות`);
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
          expense_date: new Date().toISOString(), // Automatic date (now)
          sales_rep: currentUser?.full_name || '',
          notes: row.notes || ''
        });

        const detail = eventDetails[i];
        if (detail && detail.event_name && detail.event_date && detail.buyers_count && detail.scanned_count) {
            await base44.entities.ExpenseEvent.create({
                expense_id: expense.id,
                event_name: detail.event_name,
                event_date: detail.event_date,
                buyers_count: parseInt(detail.buyers_count) || 0,
                scanned_count: parseInt(detail.scanned_count) || 0
            });
        }

        savedCount++;
      }

      toast.success(`${savedCount} הוצאות נשמרו בהצלחה!`);
      
      // Invalidate queries to update Bank Table and other lists
      queryClient.invalidateQueries({ queryKey: ['expensesAll'] });
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['returned_expenses'] });

      const emptyRow = {
        reason: '',
        recipient: '',
        amount: '',
        currency: 'EUR',
        expense_date: new Date().toISOString().split('T')[0],
        notes: ''
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
        
        <div className="flex flex-col lg:flex-row gap-8">
            {/* Main Expense Table */}
            <div className="w-full lg:w-3/5 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
                    <h3 className="font-bold text-slate-800">פרטי הוצאה</h3>
                </div>
                <table className="w-full">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                            {COLUMNS.map((col) => (
                                <th key={col.key} className="px-4 py-3 text-xs font-semibold text-slate-500 h-10">
                                    {col.label}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {tableData.map((row, rowIndex) => (
                            <tr key={rowIndex} className="hover:bg-slate-50/50 transition-colors h-16 border-b border-slate-100 last:border-0">
                                <td className="px-2 py-2">
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
                                            <SelectItem value="פינוק ללקוחות">פינוק ללקוחות</SelectItem>
                                            <SelectItem value="פינוק לנציגים">פינוק לנציגים</SelectItem>
                                            <SelectItem value="אשל">אשל</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </td>
                                <td className="px-2 py-2">
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
                                    ) : (row.reason === 'משיכה לאדם' || row.reason === 'החזר מלא' || row.reason === 'החזר חלקי' || row.reason === 'אשל') ? (
                                        <Select 
                                            value={row.recipient} 
                                            onValueChange={(val) => handleCellChange(rowIndex, 'recipient', val)}
                                        >
                                            <SelectTrigger className="w-full h-10 text-right" dir="rtl">
                                                <SelectValue placeholder="בחר נציג/משתמש" />
                                            </SelectTrigger>
                                            <SelectContent dir="rtl">
                                                {allUserNames.map((name, idx) => (
                                                    <SelectItem key={idx} value={name}>{name}</SelectItem>
                                                ))}
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
                                <td className="px-2 py-2">
                                    <Input 
                                        type="number"
                                        value={row.amount} 
                                        onChange={(e) => handleCellChange(rowIndex, 'amount', e.target.value)}
                                        className="text-right h-10"
                                    />
                                </td>
                                <td className="px-2 py-2">
                                    <Select 
                                        value={row.currency} 
                                        onValueChange={(val) => handleCellChange(rowIndex, 'currency', val)}
                                    >
                                        <SelectTrigger className="w-full h-10">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="EUR">€ (EUR)</SelectItem>
                                            <SelectItem value="ILS">₪ (ILS)</SelectItem>
                                            <SelectItem value="USD">$ (USD)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </td>
                                <td className="px-2 py-2">
                                    <Input 
                                        value={row.notes} 
                                        onChange={(e) => handleCellChange(rowIndex, 'notes', e.target.value)}
                                        className="text-right h-10"
                                        placeholder="הערות..."
                                    />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Event Details Table - Parallel to Main Table */}
            <div className="w-full lg:w-2/5 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
                    <h3 className="font-bold text-slate-800">פרטי אירוע (חובה לתשלום ספק)</h3>
                </div>
                <table className="w-full">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                            <th className="px-2 py-3 text-xs font-semibold text-slate-500 h-10">אירוע</th>
                            <th className="px-2 py-3 text-xs font-semibold text-slate-500 h-10">תאריך אירוע</th>
                            <th className="px-2 py-3 text-xs font-semibold text-slate-500 h-10">קונים</th>
                            <th className="px-2 py-3 text-xs font-semibold text-slate-500 h-10">נסרקים</th>
                        </tr>
                    </thead>
                    <tbody>
                        {tableData.map((row, rowIndex) => {
                            const detail = eventDetails[rowIndex] || {};
                            const isRequired = row.reason === 'תשלום לספק';
                            const opacityClass = isRequired || detail.event_name ? 'opacity-100' : 'opacity-60 hover:opacity-100 transition-opacity';

                            return (
                                <tr key={rowIndex} className={`h-16 border-b border-slate-100 last:border-0 ${opacityClass}`}>
                                    <td className="px-2 py-2">
                                        <Select 
                                            value={detail.event_name || ''} 
                                            onValueChange={(v) => handleEventDetailChange(rowIndex, 'event_name', v)}
                                        >
                                            <SelectTrigger className={`h-10 text-right w-full text-xs ${isRequired && !detail.event_name ? 'border-red-300 bg-red-50' : ''}`} dir="rtl">
                                                <SelectValue placeholder="-" />
                                            </SelectTrigger>
                                            <SelectContent dir="rtl">
                                                {attractions.length > 0 ? (
                                                    attractions.map(attr => (
                                                        <SelectItem key={attr.id} value={attr.name}>{attr.name}</SelectItem>
                                                    ))
                                                ) : (
                                                    <>
                                                        <SelectItem value="קודו">קודו</SelectItem>
                                                        <SelectItem value="קנדי">קנדי</SelectItem>
                                                        <SelectItem value="הסעות">הסעות</SelectItem>
                                                    </>
                                                )}
                                            </SelectContent>
                                        </Select>
                                    </td>
                                    <td className="px-2 py-2">
                                        <Input 
                                            type="date" 
                                            value={detail.event_date || ''} 
                                            onChange={(e) => handleEventDetailChange(rowIndex, 'event_date', e.target.value)}
                                            className={`h-10 text-right w-full px-1 text-xs ${isRequired && !detail.event_date ? 'border-red-300 bg-red-50' : ''}`}
                                        />
                                    </td>
                                    <td className="px-2 py-2">
                                        <Input 
                                            type="number" 
                                            placeholder="0"
                                            value={detail.buyers_count || ''} 
                                            onChange={(e) => handleEventDetailChange(rowIndex, 'buyers_count', e.target.value)}
                                            className={`h-10 text-right w-full px-1 text-xs ${isRequired && !detail.buyers_count ? 'border-red-300 bg-red-50' : ''}`}
                                        />
                                    </td>
                                    <td className="px-2 py-2">
                                        <Input 
                                            type="number" 
                                            placeholder="0"
                                            value={detail.scanned_count || ''} 
                                            onChange={(e) => handleEventDetailChange(rowIndex, 'scanned_count', e.target.value)}
                                            className={`h-10 text-right w-full px-1 text-xs ${isRequired && !detail.scanned_count ? 'border-red-300 bg-red-50' : ''}`}
                                        />
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
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