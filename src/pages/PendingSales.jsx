import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const COLUMNS = [
  'מספר הזמנה', 'תאריך עזיבה', 'לקוחות', 'לילות', 'מגדר', 'מלון', 
  'חברה', 'סכום מבוקש', 'EUR', 'שקל', 'דולר', 'ביט', 'סטטוס בEUR', 'הערות'
];

const COLUMN_KEYS = [
  'order_number', 'departure_date', 'customer', 'nights', 'gender', 'hotel', 
  'company', 'requested_amount', 'eur_amount', 'shekel_amount', 'dollar_amount', 'bit_amount', 'eur_status', 'comments'
];

export default function PendingSales() {
  const queryClient = useQueryClient();
  const [editingCell, setEditingCell] = useState(null);

  // Fetch data from PendingSale entity
  const { data: pendingSales = [], isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['pendingSales'],
    queryFn: () => base44.entities.PendingSale.list(),
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.PendingSale.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['pendingSales']);
    },
    onError: () => toast.error("שגיאה בעדכון הנתונים")
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.PendingSale.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['pendingSales']);
      toast.success("השורה נמחקה");
    },
    onError: () => toast.error("שגיאה במחיקת השורה")
  });

  const handleCellChange = (id, colKey, value, originalRow) => {
    // Optimistic update logic could go here, but for simplicity we'll just mutate
    // We only trigger update on blur to avoid too many requests, 
    // but here we are in onChange, so let's just update local state if we had it, 
    // or direct update if we want real-time (but real-time on every keystroke is bad).
    // Better pattern: Local state for the input, update on blur.
  };

  const handleBlur = (id, colKey, value, originalRow) => {
    if (value === originalRow[colKey]) return; // No change

    const updates = { [colKey]: value };

    // If currency fields changed, recalculate status
    if (['eur_amount', 'shekel_amount', 'dollar_amount', 'bit_amount', 'requested_amount'].includes(colKey)) {
        // We calculate based on the new value and existing values
        const row = { ...originalRow, ...updates };
        const status = calculateStatusText(row);
        updates.eur_status = status;
    }

    updateMutation.mutate({ id, data: updates });
    setEditingCell(null);
  };

  const saveToAllIncomes = async (row) => {
      if (!window.confirm('האם לשמור את הנתונים לטבלת ההכנסות?')) return;

      try {
          // 1. Create in TableData
          await base44.entities.TableData.create({
              ...row,
              created_date: new Date().toISOString() // Ensure fresh date
          });

          // 2. Delete from PendingSale
          await base44.entities.PendingSale.delete(row.id);

          // 3. Refresh UI
          queryClient.invalidateQueries(['pendingSales']);
          toast.success("ההזמנה נשמרה בהצלחה והועברה לטבלת ההכנסות!");
      } catch (error) {
          console.error(error);
          toast.error("שגיאה בשמירת הנתונים");
      }
  };

  // Helper to calculate status string for DB storage/display
  const calculateStatusText = (row) => {
    const eur = parseFloat(row.eur_amount) || 0;
    const nis = parseFloat(row.shekel_amount) || 0;
    const usd = parseFloat(row.dollar_amount) || 0;
    const bit = parseFloat(row.bit_amount) || 0;
    const req = parseFloat(row.requested_amount) || 0;
    
    const total = eur + (nis * 0.26) + (usd * 0.95) + (bit * 0.26);
    
    if (!row.requested_amount) return "0";

    const diff = total - req;
    if (Math.abs(diff) < 0.01) return "מאוזן";
    return diff.toFixed(2);
  };

  const calculateStatusDisplay = (row) => {
    // Re-calculate for display properties (color)
    const eur = parseFloat(row.eur_amount) || 0;
    const nis = parseFloat(row.shekel_amount) || 0;
    const usd = parseFloat(row.dollar_amount) || 0;
    const bit = parseFloat(row.bit_amount) || 0;
    const req = parseFloat(row.requested_amount) || 0;
    
    const total = eur + (nis * 0.26) + (usd * 0.95) + (bit * 0.26);
    
    if (!row.requested_amount) return { text: '—', color: 'bg-slate-100 text-slate-600' };

    const diff = total - req;
    if (Math.abs(diff) < 0.01) return { text: 'מאוזן', color: 'bg-blue-100 text-blue-700' };
    if (diff > 0) return { text: `+${diff.toFixed(2)}`, color: 'bg-green-100 text-green-800' };
    return { text: diff.toFixed(2), color: 'bg-red-100 text-red-800' };
  };

  const handleDeleteRow = (id) => {
    if (window.confirm('האם למחוק שורה זו?')) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="p-8 md:p-12 text-right" dir="rtl">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-slate-800">מכירה בהמתנה</h1>
          <div className="flex gap-4 items-center">
            <Button 
              variant="outline" 
              onClick={() => refetch()}
              className="gap-2"
              disabled={isRefetching}
            >
              <RefreshCw className={`w-4 h-4 ${isRefetching ? 'animate-spin' : ''}`} /> 
              {isRefetching ? 'מרענן...' : 'רענן נתונים'}
            </Button>
            <div className="text-slate-500">
              {pendingSales.length} הזמנות ממתינות
            </div>
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
              {isLoading ? (
                  <tr>
                    <td colSpan={COLUMNS.length + 1} className="p-8 text-center text-slate-500">
                      <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
                      טוען נתונים...
                    </td>
                  </tr>
              ) : pendingSales.length === 0 ? (
                <tr>
                  <td colSpan={COLUMNS.length + 1} className="p-8 text-center text-slate-500">
                    אין מכירות בהמתנה כרגע
                  </td>
                </tr>
              ) : (
                pendingSales.map((row) => {
                  const status = calculateStatusDisplay(row);
                  return (
                    <tr key={row.id} className="hover:bg-slate-50/50 transition-colors">
                      {COLUMN_KEYS.map((colKey) => (
                        <td key={colKey} className="px-2 py-2 border-b">
                          {colKey === 'eur_status' ? (
                            <div className={`px-4 py-2 rounded-lg text-center font-medium ${status.color}`}>
                              {status.text}
                            </div>
                          ) : (
                            <EditableCell 
                                value={row[colKey] || ''}
                                onBlur={(val) => handleBlur(row.id, colKey, val, row)}
                                disabled={false}
                            />
                          )}
                        </td>
                      ))}
                      <td className="px-2 py-2 border-b text-center">
                        <div className="flex gap-2 justify-center">
                            <Button 
                              variant="default" 
                              size="sm" 
                              onClick={() => saveToAllIncomes(row)}
                              className="bg-green-600 hover:bg-green-700 text-white"
                            >
                              <Save className="w-4 h-4 ml-1" /> שמור
                            </Button>
                        </div>
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

// Separate component to handle local state of input
function EditableCell({ value: initialValue, onBlur, disabled }) {
    const [value, setValue] = useState(initialValue);
    
    // Update local state if external value changes (e.g. refresh)
    React.useEffect(() => {
        setValue(initialValue);
    }, [initialValue]);

    return (
        <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={() => onBlur(value)}
            className={`text-right h-10 border-slate-200 ${disabled ? 'bg-slate-50 text-slate-500' : ''}`}
            disabled={disabled}
        />
    );
}