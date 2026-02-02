import React, { useState, useEffect, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Loader2, RefreshCw, Save } from "lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";

const COLUMNS = [
  'מספר הזמנה', 'תאריך עזיבה', 'לקוחות', 'לילות', 'מגדר', 'מלון', 
  'חברה', 'סכום מבוקש', 'EUR', 'שקל', 'דולר', 'ביט', 'סטטוס בEUR'
];

const COLUMN_KEYS = [
  'order_number', 'departure_date', 'customer', 'nights', 'gender', 'hotel', 
  'company', 'requested_amount', 'eur_amount', 'shekel_amount', 'dollar_amount', 'bit_amount', 'eur_status'
];

export default function PendingSales() {
  // Initialize from LocalStorage
  const [tableData, setTableData] = useState(() => {
    const saved = localStorage.getItem('pendingSalesTableData');
    return saved ? JSON.parse(saved) : [];
  });

  // Save to LocalStorage on change
  useEffect(() => {
    localStorage.setItem('pendingSalesTableData', JSON.stringify(tableData));
  }, [tableData]);

  // Process new sales from the queue
  const processPendingQueue = useCallback(() => {
    const pendingStr = localStorage.getItem('pending_sales_queue');
    if (!pendingStr) return;

    try {
      const pendingQueue = JSON.parse(pendingStr);
      if (Array.isArray(pendingQueue) && pendingQueue.length > 0) {
        setTableData(prevData => {
          // Add new items to the beginning or end? Let's add to the end.
          // Initialize currency fields for new items
          const newItems = pendingQueue.map(item => ({
            ...item,
            eur_amount: "",
            shekel_amount: "",
            dollar_amount: "",
            bit_amount: "",
            eur_status: "0"
          }));
          
          toast.success(`${newItems.length} הזמנות חדשות התווספו להמתנה!`);
          return [...prevData, ...newItems];
        });

        // Clear queue
        localStorage.setItem('pending_sales_queue', JSON.stringify([]));
      }
    } catch (e) {
      console.error("Error processing queue", e);
    }
  }, []);

  // Listen for sync events
  useEffect(() => {
    const channel = new BroadcastChannel('app_sync_channel');
    channel.onmessage = (event) => {
      if (event.data?.type === 'NEW_SALE_ADDED') {
        processPendingQueue();
      }
    };

    const handleFocus = () => processPendingQueue();
    window.addEventListener('focus', handleFocus);
    
    const intervalId = setInterval(processPendingQueue, 2000); // Polling
    
    // Initial check
    processPendingQueue();

    return () => {
      channel.close();
      window.removeEventListener('focus', handleFocus);
      clearInterval(intervalId);
    };
  }, [processPendingQueue]);

  const handleCellChange = (rowIndex, colKey, value) => {
    const newData = [...tableData];
    newData[rowIndex][colKey] = value;
    setTableData(newData);
  };

  // Calculate EUR Status
  const calculateStatus = (row) => {
    const eur = parseFloat(row.eur_amount) || 0;
    const nis = parseFloat(row.shekel_amount) || 0;
    const usd = parseFloat(row.dollar_amount) || 0;
    const bit = parseFloat(row.bit_amount) || 0;
    const req = parseFloat(row.requested_amount) || 0;
    
    // Conversion rates (approximate, based on previous code)
    const total = eur + (nis * 0.26) + (usd * 0.95) + (bit * 0.26);
    
    if (!row.requested_amount) return { text: '—', color: 'bg-slate-100 text-slate-600' };

    const diff = total - req;
    if (Math.abs(diff) < 0.01) return { text: 'מאוזן', color: 'bg-blue-100 text-blue-700' };
    if (diff > 0) return { text: `+${diff.toFixed(2)}`, color: 'bg-green-100 text-green-800' };
    return { text: diff.toFixed(2), color: 'bg-red-100 text-red-800' };
  };

  const handleDeleteRow = (index) => {
    if (window.confirm('האם למחוק שורה זו?')) {
      const newData = [...tableData];
      newData.splice(index, 1);
      setTableData(newData);
    }
  };

  return (
    <div className="p-8 md:p-12 text-right" dir="rtl">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-slate-800">מכירה בהמתנה</h1>
          <div className="text-slate-500">
            {tableData.length} הזמנות ממתינות
          </div>
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
                <th className="px-4 py-4 border-b"></th>
              </tr>
            </thead>
            <tbody>
              {tableData.length === 0 ? (
                <tr>
                  <td colSpan={COLUMNS.length + 1} className="p-8 text-center text-slate-500">
                    אין מכירות בהמתנה כרגע
                  </td>
                </tr>
              ) : (
                tableData.map((row, rowIndex) => {
                  const status = calculateStatus(row);
                  return (
                    <tr key={rowIndex} className="hover:bg-slate-50/50 transition-colors">
                      {COLUMN_KEYS.map((colKey) => (
                        <td key={colKey} className="px-2 py-2 border-b">
                          {colKey === 'eur_status' ? (
                            <div className={`px-4 py-2 rounded-lg text-center font-medium ${status.color}`}>
                              {status.text}
                            </div>
                          ) : (
                            <Input
                              value={row[colKey] || ''}
                              onChange={(e) => handleCellChange(rowIndex, colKey, e.target.value)}
                              className="text-right h-10 border-slate-200"
                              disabled={colKey === 'requested_amount' || colKey === 'order_number'} // Maybe read-only for some fields?
                            />
                          )}
                        </td>
                      ))}
                      <td className="px-2 py-2 border-b text-center">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleDeleteRow(rowIndex)}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
                        >
                          מחק
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}