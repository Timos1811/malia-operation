import React, { useState, useEffect, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";

const COLUMNS = [
  'מספר הזמנה', 'לקוחות', 'לילות', 'מגדר', 'מלון', 
  'חברה', 'סכום מבוקש', 'EUR', 'שקל', 'דולר', 'סטטוס בEUR'
];

const COLUMN_KEYS = [
  'order_number', 'customer', 'nights', 'gender', 'hotel', 
  'company', 'requested_amount', 'eur_amount', 'shekel_amount', 'dollar_amount', 'eur_status'
];

export default function Table() {
  const rowsCount = 5;

  // אתחול דאטה - טעינה מהלוקאל סטורג' או יצירת שורות ריקות
  const [tableData, setTableData] = useState(() => {
    const saved = localStorage.getItem('tableData');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    return Array.from({ length: rowsCount }, () => 
      COLUMN_KEYS.reduce((acc, key) => ({ ...acc, [key]: '' }), {})
    );
  });

  const [editingCell, setEditingCell] = useState(null);
  const [fetchingRows, setFetchingRows] = useState(new Set());
  const [missingFields, setMissingFields] = useState({});

  // שמירה אוטומטית ללוקאל סטורג' בכל שינוי
  useEffect(() => {
    localStorage.setItem('tableData', JSON.stringify(tableData));
  }, [tableData]);

  // פונקציית משיכת הנתונים מגוגל שיטס
  const fetchOrderDetails = useCallback(async (rowIndex, orderNumber) => {
    const trimmedOrder = String(orderNumber).trim();
    
    if (!trimmedOrder || trimmedOrder.length < 7 || fetchingRows.has(rowIndex)) return;

    setFetchingRows(prev => new Set(prev).add(rowIndex));

    try {
      // קריאה לפונקציית הענן שמחוברת לגוגל שיטס
      const response = await base44.functions.invoke('fetchOrderData', { 
        orderNumber: trimmedOrder 
      });

      if (response && response.data) {
        setTableData(prevData => {
          const newData = [...prevData];
          newData[rowIndex] = {
            ...newData[rowIndex],
            customer: response.data.customer || '',
            nights: response.data.nights || '',
            hotel: response.data.hotel || '',
            gender: response.data.gender || '',
            // אם יש סכום מבוקש בשיטס, נמשוך גם אותו
            requested_amount: response.data.requested_amount || newData[rowIndex].requested_amount
          };
          return newData;
        });
        toast.success(`נתוני הזמנה ${trimmedOrder} נטענו`);
      } else {
        toast.error('הזמנה לא נמצאה בשיטס');
      }
    } catch (error) {
      console.error('Fetch error:', error);
      toast.error('שגיאה בתקשורת עם גוגל שיטס');
    } finally {
      setFetchingRows(prev => {
        const newSet = new Set(prev);
        newSet.delete(rowIndex);
        return newSet;
      });
    }
  }, [fetchingRows]);

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
  };

  const handleCellBlur = (rowIndex, colKey, value) => {
    if (colKey === 'order_number' && value.trim().length >= 7) {
      fetchOrderDetails(rowIndex, value);
    }
    setEditingCell(null);
  };

  const handleSaveAll = async () => {
    // סינון שורות ריקות - שומרים רק שורות שיש בהן מספר הזמנה
    const rowsToSave = tableData.filter(row => row.order_number?.trim().length > 0);

    if (rowsToSave.length === 0) {
      toast.error('אין נתונים לשמירה');
      return;
    }

    // בדיקת תקינות - שדות חובה ומטבעות
    for (const row of rowsToSave) {
      const requiredFields = ['order_number', 'customer', 'nights', 'gender', 'hotel', 'company', 'requested_amount'];
      const missingFields = requiredFields.filter(field => !row[field] || String(row[field]).trim() === '');
      
      if (missingFields.length > 0) {
        toast.error(`חסרים שדות חובה להזמנה ${row.order_number}: ${missingFields.join(', ')}`);
        return;
      }

      const hasCurrency = ['eur_amount', 'shekel_amount', 'dollar_amount'].some(field => row[field] && String(row[field]).trim() !== '');
      if (!hasCurrency) {
        toast.error(`יש להזין לפחות סכום אחד (EUR, שקל או דולר) להזמנה ${row.order_number}`);
        return;
      }
    }

    try {
      for (const row of rowsToSave) {
        await base44.entities.TableData.create(row);
      }
      
      toast.success('הנתונים נשמרו בטבלה הכללית!');
      
      // איפוס הטבלה לאחר שמירה מוצלחת
      const emptyData = Array.from({ length: rowsCount }, () => 
        COLUMN_KEYS.reduce((acc, key) => ({ ...acc, [key]: '' }), {})
      );
      setTableData(emptyData);
      localStorage.removeItem('tableData');
    } catch (error) {
      toast.error('שגיאה בשמירת הנתונים');
    }
  };

  return (
    <div className="p-8 md:p-12 text-right" dir="rtl">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-slate-800 mb-8">ניהול הכנסות והזמנות</h1>
        
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

                    let eurStatus = '—';
                    let eurStatusColor = 'bg-slate-100 text-slate-600';

                    if (colKey === 'eur_status') {
                        const eur = parseFloat(row.eur_amount) || 0;
                        const nis = parseFloat(row.shekel_amount) || 0;
                        const usd = parseFloat(row.dollar_amount) || 0;
                        const req = parseFloat(row.requested_amount) || 0;

                        // 1 NIS = 0.26 EUR, 1 USD = 0.95 EUR
                        const total = eur + (nis * 0.26) + (usd * 0.95);

                        if (row.requested_amount) {
                            const diff = total - req;
                            if (Math.abs(diff) < 0.01) {
                                eurStatus = 'מאוזן';
                                eurStatusColor = 'bg-slate-100 text-slate-600';
                            } else if (diff > 0) {
                                eurStatus = `+${diff.toFixed(2)}`;
                                eurStatusColor = 'bg-green-100 text-green-800';
                            } else {
                                eurStatus = diff.toFixed(2);
                                eurStatusColor = 'bg-red-100 text-red-800';
                            }
                        }
                    }

                    return (
                      <td key={colKey} className="px-2 py-2 border-b border-slate-100">
                        {colKey === 'eur_status' ? (
                          <div className={`px-4 py-2 rounded-lg text-center font-medium ${eurStatusColor}`}>
                            {eurStatus}
                          </div>
                        ) : (
                          <div className="relative">
                            <Input
                              value={row[colKey]}
                              onChange={(e) => handleCellChange(rowIndex, colKey, e.target.value)}
                              onBlur={(e) => handleCellBlur(rowIndex, colKey, e.target.value)}
                              className="text-right h-10"
                              disabled={isFetching}
                            />
                            {isFetching && (
                              <Loader2 className="absolute left-2 top-2.5 h-5 w-5 animate-spin text-slate-400" />
                            )}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
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