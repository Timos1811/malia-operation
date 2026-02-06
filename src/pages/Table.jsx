import React, { useState, useEffect, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";

const COLUMNS = [
  'מספר הזמנה', 'תאריך עזיבה', 'לקוחות', 'לילות', 'מגדר', 'מלון', 
  'חברה', 'סכום מבוקש', 'EUR', 'שקל', 'דולר', 'ביט', 'סטטוס בEUR', 'שם נציג', 'הערות'
];

const COLUMN_KEYS = [
  'order_number', 'departure_date', 'customer', 'nights', 'gender', 'hotel', 
  'company', 'requested_amount', 'eur_amount', 'shekel_amount', 'dollar_amount', 'bit_amount', 'eur_status', 'sales_rep', 'comments'
];

export default function Table() {
  const rowsCount = 5;

  // אתחול דאטה - טעינה מהלוקאל סטורג' או יצירת שורות ריקות
  const [tableData, setTableData] = useState(() => {
    const saved = localStorage.getItem('tableData');
    let initialData = [];
    if (saved) {
      try { 
        initialData = JSON.parse(saved); 
      } catch (e) { console.error(e); }
    }
    
    // Ensure we always have at least rowsCount rows
    if (!Array.isArray(initialData)) initialData = [];
    if (initialData.length < rowsCount) {
      const emptyRows = Array.from({ length: rowsCount - initialData.length }, () => 
        COLUMN_KEYS.reduce((acc, key) => ({ ...acc, [key]: '' }), {})
      );
      initialData = [...initialData, ...emptyRows];
    }
    
    return initialData;
  });

  const [fetchingRows, setFetchingRows] = useState(new Set());
  const [missingFields, setMissingFields] = useState({});

  // שמירה אוטומטית ללוקאל סטורג' בכל שינוי בטבלה
  useEffect(() => {
    localStorage.setItem('tableData', JSON.stringify(tableData));
  }, [tableData]);

  // פונקציה לעיבוד הזמנות חדשות מהתור
  const processPendingQueue = useCallback(() => {
    // בוטל: העיבוד הועבר לדף "מכירה בהמתנה" (PendingSales.jsx)
    // אנו משאירים את הפונקציה ריקה כדי לא לשבור תלויות, אך היא לא תעשה כלום.
  }, []);

  // האזנה לאירועים וסנכרון - בוטל חלקית עבור התור, נשאר רק רענון ידני אם צריך
  useEffect(() => {
    // הקוד המקורי בוטל כדי לא "לגנוב" נתונים מדף ההמתנה
  }, []);

  // פונקציית משיכת הנתונים מגוגל שיטס - מעודכנת לעבוד עם הפונקציה החדשה ב-Base44
  const fetchOrderDetails = useCallback(async (rowIndex, orderNumber) => {
    const trimmedOrder = String(orderNumber).trim();
    
    // בדיקה שמדובר במספר הזמנה תקין ושלא מושכים כרגע
    if (!trimmedOrder || trimmedOrder.length < 5 || fetchingRows.has(rowIndex)) return;

    setFetchingRows(prev => new Set(prev).add(rowIndex));

    try {
      // קריאה לפונקציית הענן המעודכנת
      const response = await base44.functions.invoke('fetchOrderData', { 
        orderNumber: trimmedOrder 
      });

      if (response && response.data) {
        setTableData(prevData => {
          const newData = [...prevData];
          newData[rowIndex] = {
            ...newData[rowIndex],
            customer: response.data.customer || newData[rowIndex].customer,
            nights: response.data.nights || newData[rowIndex].nights,
            hotel: response.data.hotel || newData[rowIndex].hotel,
            gender: response.data.gender || newData[rowIndex].gender,
            departure_date: response.data.departureDate || newData[rowIndex].departure_date,
          };
          return newData;
        });
        toast.success(`נתוני הזמנה ${trimmedOrder} נטענו בהצלחה`);
      } else {
        toast.error(`הזמנה ${trimmedOrder} לא נמצאה בגיליון החיצוני`);
      }
    } catch (error) {
      console.error('Fetch error:', error);
      const errorMessage = error.message || 'שגיאה לא ידועה';
      toast.error(`שגיאה במשיכת נתונים: ${errorMessage}. וודא שהפונקציה תקינה ושמספר ההזמנה קיים.`);
    } finally {
      setFetchingRows(prev => {
        const newSet = new Set(prev);
        newSet.delete(rowIndex);
        return newSet;
      });
    }
  }, [fetchingRows]);

  const handleAddRow = () => {
    setTableData(prev => [
      ...prev,
      COLUMN_KEYS.reduce((acc, key) => ({ ...acc, [key]: '' }), {})
    ]);
  };

  const handleCellChange = (rowIndex, colKey, value) => {
    const newData = [...tableData];
    newData[rowIndex][colKey] = value;

    // לוגיקת זיהוי חברה לפי תחילת מספר הזמנה
    if (colKey === 'order_number') {
      const val = String(value).trim();
      if (val.startsWith('5')) newData[rowIndex]['company'] = 'קשרי תעופה';
      else if (val.startsWith('1')) newData[rowIndex]['company'] = 'נטו פאן';
      else if (val.length > 0) newData[rowIndex]['company'] = 'כספר';
    }

    setTableData(newData);

    // ניקוי שגיאה
    if (missingFields[rowIndex]?.includes(colKey)) {
      setMissingFields(prev => ({
        ...prev,
        [rowIndex]: prev[rowIndex].filter(field => field !== colKey)
      }));
    }
  };

  const handleCellBlur = (rowIndex, colKey, value) => {
    if (colKey === 'order_number' && value.trim().length >= 5) {
      fetchOrderDetails(rowIndex, value);
    }
  };

  const handleSaveAll = async () => {
    const newMissingFields = {};
    const validRowsIndices = [];
    const rowsToCreate = [];

    tableData.forEach((row, index) => {
      if (!row.order_number?.trim()) return;

      const required = ['order_number', 'customer', 'nights', 'gender', 'hotel', 'company', 'requested_amount'];
      const missing = required.filter(field => !row[field] || String(row[field]).trim() === '');
      
      const hasCurrency = ['eur_amount', 'shekel_amount', 'dollar_amount', 'bit_amount'].some(field => row[field] && String(row[field]).trim() !== '');

      if (missing.length > 0 || !hasCurrency) {
        newMissingFields[index] = [...missing];
        if (!hasCurrency) newMissingFields[index].push('currency_fields');
      } else {
        validRowsIndices.push(index);
        rowsToCreate.push(row);
      }
    });

    if (rowsToCreate.length === 0 && Object.keys(newMissingFields).length === 0) {
      toast.error('אין נתונים לשמירה');
      return;
    }

    setMissingFields(newMissingFields);

    if (Object.keys(newMissingFields).length > 0) {
        toast.error('שגיאה: חובה למלא את שדות החובה ולפחות אמצעי תשלום אחד (יורו, שקל, דולר, ביט) לכל שורה');
    }

    if (rowsToCreate.length === 0) return;

    try {
      // בדיקת כפילויות מול מסד הנתונים
      const orderNumbers = rowsToCreate.map(r => r.order_number);
      const existingOrders = await base44.entities.TableData.filter({ 
        order_number: { $in: orderNumbers } 
      });

      if (existingOrders.length > 0) {
        const duplicates = existingOrders.map(o => o.order_number).join(', ');
        toast.error(`שגיאה: הזמנות הבאות כבר קיימות במערכת: ${duplicates}`);
        return;
      }

      for (const row of rowsToCreate) {
        // חישוב סטטוס EUR
        const eur = parseFloat(row.eur_amount) || 0;
        const nis = parseFloat(row.shekel_amount) || 0;
        const usd = parseFloat(row.dollar_amount) || 0;
        const bit = parseFloat(row.bit_amount) || 0;
        const req = parseFloat(row.requested_amount) || 0;
        const total = eur + (nis * 0.26) + (usd * 0.95) + (bit * 0.26);
        
        let calculatedStatus = '';
        if (row.requested_amount) {
            const diff = total - req;
            calculatedStatus = Math.abs(diff) < 0.01 ? 'מאוזן' : diff.toFixed(2);
        }

        await base44.entities.TableData.create({ ...row, eur_status: calculatedStatus });
      }

      toast.success(`${rowsToCreate.length} שורות נשמרו!`);

      setTableData(prevData => {
         const newData = [...prevData];
         validRowsIndices.forEach(index => {
             newData[index] = COLUMN_KEYS.reduce((acc, key) => ({ ...acc, [key]: '' }), {});
         });
         return newData;
      });
    } catch (error) {
      console.error(error);
      toast.error(`שגיאה בשמירה: ${error.message || 'אנא נסה שוב מאוחר יותר'}`);
    }
  };

  return (
    <div className="p-8 md:p-12 text-right" dir="rtl">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-slate-800">ניהול הכנסות והזמנות</h1>
          <Button 
            variant="outline" 
            onClick={() => {
              const saved = localStorage.getItem('tableData');
              if (saved) {
                setTableData(JSON.parse(saved));
                toast.success('הנתונים רעננו');
              }
            }}
            className="gap-2"
          >
            <RefreshCw className="w-4 h-4" /> רענן נתונים
          </Button>
        </div>
        
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-x-auto">
          <table className="w-full min-w-[1200px]">
            <thead>
              <tr className="bg-slate-50">
                {COLUMNS.map((col, i) => (
                  <th key={i} className="px-4 py-4 text-xs font-semibold text-slate-500 border-b">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableData.map((row, rowIndex) => (
                <tr key={rowIndex} className="hover:bg-slate-50/50 transition-colors">
                  {COLUMN_KEYS.map((colKey) => {
                    const isFetching = colKey === 'order_number' && fetchingRows.has(rowIndex);
                    const isMissing = missingFields[rowIndex]?.includes(colKey) || (colKey.includes('amount') && missingFields[rowIndex]?.includes('currency_fields'));

                    if (colKey === 'eur_status') {
                        const eur = parseFloat(row.eur_amount) || 0;
                        const nis = parseFloat(row.shekel_amount) || 0;
                        const usd = parseFloat(row.dollar_amount) || 0;
                        const bit = parseFloat(row.bit_amount) || 0;
                        const req = parseFloat(row.requested_amount) || 0;
                        const total = eur + (nis * 0.26) + (usd * 0.95) + (bit * 0.26);
                        
                        let status = '—';
                        let color = 'bg-slate-100 text-slate-600';
                        if (row.requested_amount) {
                            const diff = total - req;
                            if (Math.abs(diff) < 0.01) { status = 'מאוזן'; color = 'bg-blue-100 text-blue-700'; }
                            else if (diff > 0) { status = `+${diff.toFixed(2)}`; color = 'bg-green-100 text-green-800'; }
                            else { status = diff.toFixed(2); color = 'bg-red-100 text-red-800'; }
                        }
                        return <td key={colKey} className="px-2 py-2 border-b"><div className={`px-4 py-2 rounded-lg text-center font-medium ${color}`}>{status}</div></td>
                    }

                    return (
                      <td key={colKey} className="px-2 py-2 border-b">
                        <div className="relative">
                          <Input
                            value={row[colKey] || ''}
                            onChange={(e) => handleCellChange(rowIndex, colKey, e.target.value)}
                            onBlur={(e) => handleCellBlur(rowIndex, colKey, e.target.value)}
                            className={`text-right h-10 ${isMissing ? 'border-red-500 bg-red-50' : ''}`}
                            disabled={isFetching}
                          />
                          {isFetching && <Loader2 className="absolute left-2 top-2.5 h-5 w-5 animate-spin text-slate-400" />}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex justify-center">
          <Button variant="ghost" onClick={handleAddRow} className="text-slate-500 hover:bg-slate-100">
            <Plus className="w-4 h-4 ml-2" /> הוסף שורה חדשה
          </Button>
        </div>

        <div className="mt-8 flex justify-center gap-4">
          <Button onClick={handleSaveAll} className="bg-blue-600 hover:bg-blue-700 text-white px-10 py-6 rounded-xl shadow-lg">
            שמור נתונים לטבלה הכללית
          </Button>
        </div>
      </div>
    </div>
  );
}