import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Loader2, Database } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const COLUMNS = [
  'מספר הזמנה',
  'לקוחות',
  'לילות',
  'מגדר',
  'גיל',
  'מלון',
  'חברה',
  'סכום מבוקש',
  'EUR',
  'סטטוס בEUR'
];

const COLUMN_KEYS = [
  'order_number',
  'customer',
  'nights',
  'gender',
  'age',
  'hotel',
  'company',
  'requested_amount',
  'eur_amount',
  'eur_status'
];

export default function SavedData() {
    const [editingCell, setEditingCell] = useState(null);
    const [fetchingRows, setFetchingRows] = useState(new Set());
    const queryClient = useQueryClient();
  
  const { data: savedRows = [], isLoading } = useQuery({
    queryKey: ['tableData'],
    queryFn: () => base44.entities.TableData.list('-created_date'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.TableData.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tableData'] });
    },
  });

  const fetchAndUpdateOrder = async (rowId, orderNumber) => {
    const trimmedOrderNumber = orderNumber.trim();

    if (!trimmedOrderNumber || fetchingRows.has(rowId)) {
      return;
    }

    setFetchingRows(prev => new Set(prev).add(rowId));

    try {
      const response = await base44.functions.invoke('fetchOrderData', { orderNumber: trimmedOrderNumber });

      if (response.data) {
        updateMutation.mutate({
          id: rowId,
          data: {
            customer: response.data.customer,
            nights: response.data.nights,
            hotel: response.data.hotel,
            gender: response.data.gender
          }
        });
        toast.success('נתונים נמלאו מגוגל שיטס');
      }
    } catch (error) {
      if (error.response?.status === 404) {
        toast.error('מספר הזמנה לא נמצא');
      } else {
        toast.error('שגיאה בטעינת נתונים');
      }
    } finally {
      setFetchingRows(prev => {
        const newSet = new Set(prev);
        newSet.delete(rowId);
        return newSet;
      });
    }
  };

  const handleCellChange = async (rowId, colKey, value) => {
    // Determine company based on first digit when order number changes
    if (colKey === 'order_number') {
      const trimmedOrderNumber = value.trim();
      let company = '';
      if (trimmedOrderNumber.startsWith('5')) {
        company = 'קשרי תעופה';
      } else if (trimmedOrderNumber.startsWith('1')) {
        company = 'נטו פאן';
      } else if (trimmedOrderNumber.length > 0) {
        company = 'כספר';
      }

      // Update order number and company first
      updateMutation.mutate({
        id: rowId,
        data: { order_number: trimmedOrderNumber, company: company }
      });

      // Then fetch additional data from Google Sheets
      if (trimmedOrderNumber.length >= 5) {
        await fetchAndUpdateOrder(rowId, trimmedOrderNumber);
      }
      return;
    }

    updateMutation.mutate({
      id: rowId,
      data: { [colKey]: value }
    });
  };

  const handleCellBlur = (e) => {
    if (!e.relatedTarget || !e.relatedTarget.closest('td')) {
      setTimeout(() => setEditingCell(null), 0);
    }
  };

  const handleKeyDown = (e, rowId, colKey, value) => {
    if (e.key === 'Enter') {
      setEditingCell(null);
      handleCellChange(rowId, colKey, value);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      handleCellChange(rowId, colKey, value);
      
      const currentRowIndex = savedRows.findIndex(r => r.id === rowId);
      const currentColIndex = COLUMN_KEYS.indexOf(colKey);
      
      if (e.shiftKey) {
        // Shift+Tab - move to previous cell
        if (currentColIndex > 0) {
          setEditingCell({ row: rowId, col: COLUMN_KEYS[currentColIndex - 1] });
        } else if (currentRowIndex > 0) {
          setEditingCell({ row: savedRows[currentRowIndex - 1].id, col: COLUMN_KEYS[COLUMN_KEYS.length - 1] });
        }
      } else {
        // Tab - move to next cell
        if (currentColIndex < COLUMN_KEYS.length - 1) {
          setEditingCell({ row: rowId, col: COLUMN_KEYS[currentColIndex + 1] });
        } else if (currentRowIndex < savedRows.length - 1) {
          setEditingCell({ row: savedRows[currentRowIndex + 1].id, col: COLUMN_KEYS[0] });
        }
      }
    }
  };

  return (
    <div className="p-8 md:p-12">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Database className="w-8 h-8 text-slate-600" />
          <h1 className="text-3xl font-light text-slate-800 tracking-tight">
            נתונים שמורים
          </h1>
        </div>
        
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-x-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
            </div>
          ) : savedRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <Database className="w-12 h-12 mb-4" />
              <p className="text-lg">אין נתונים שמורים עדיין</p>
              <p className="text-sm mt-1">הוסף שורות מדף טבלת הנתונים</p>
            </div>
          ) : (
            <table className="w-full min-w-[1200px]">
              <thead>
                <tr className="bg-slate-50/80">
                  {COLUMNS.map((colName, colIndex) => (
                    <th 
                      key={colIndex} 
                      className="px-4 py-4 text-right text-xs font-medium text-slate-500 border-b border-slate-200/60 whitespace-nowrap"
                    >
                      {colName}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {savedRows.map((row) => (
                  <tr 
                    key={row.id} 
                    className="hover:bg-slate-50/50 transition-colors duration-200"
                  >
                    {COLUMN_KEYS.map((colKey) => {
                      // Calculate EUR status
                      let eurStatus = '';
                      let eurStatusColor = '';
                      if (colKey === 'eur_status') {
                        const eurAmount = parseFloat(row.eur_amount) || 0;
                        const requestedAmount = parseFloat(row.requested_amount) || 0;
                        if (eurAmount && requestedAmount) {
                          const diff = eurAmount - requestedAmount;
                          if (diff > 0) {
                            eurStatus = `+${diff.toFixed(2)}`;
                            eurStatusColor = 'bg-green-100 text-green-800';
                          } else if (diff < 0) {
                            eurStatus = diff.toFixed(2);
                            eurStatusColor = 'bg-red-100 text-red-800';
                          } else {
                            eurStatus = 'מאוזן';
                            eurStatusColor = 'bg-slate-100 text-slate-600';
                          }
                        }
                      }

                      return (
                        <td 
                          key={colKey} 
                          className="px-2 py-2 text-sm border-b border-slate-100 last:border-b-0"
                        >
                          {colKey === 'eur_status' ? (
                            <div 
                              className={`px-4 py-2 min-h-[36px] rounded-lg flex items-center justify-center font-medium ${eurStatusColor}`}
                            >
                              {eurStatus || <span className="text-slate-400">—</span>}
                            </div>
                          ) : editingCell?.row === row.id && editingCell?.col === colKey ? (
                            <Input
                              autoFocus
                              defaultValue={row[colKey]}
                              onChange={(e) => {
                                if (colKey === 'order_number' && e.target.value.trim().length >= 5) {
                                  handleCellChange(row.id, colKey, e.target.value);
                                }
                              }}
                              onBlur={(e) => {
                                handleCellBlur(e);
                                if (colKey !== 'order_number') {
                                  handleCellChange(row.id, colKey, e.target.value);
                                }
                              }}
                              onKeyDown={(e) => handleKeyDown(e, row.id, colKey, e.target.value)}
                              className="h-9 border-slate-300 focus:border-slate-500 focus:ring-slate-500 text-right"
                            />
                          ) : (
                            <div 
                              className="px-4 py-2 min-h-[36px] rounded-lg cursor-text hover:bg-slate-100 transition-colors flex items-center"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                setEditingCell({ row: row.id, col: colKey });
                              }}
                            >
                              {row[colKey] || <span className="text-slate-400">—</span>}
                            </div>
                          )}
                        </td>
                      );
                    })}
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