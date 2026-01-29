import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";

const COLUMNS = [
  'מספר הזמנה',
  'לקוחות',
  'לילות',
  'מגדר',
  'גיל',
  'מלון',
  'חדר',
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
  'room',
  'company',
  'requested_amount',
  'eur_amount',
  'eur_status'
];

export default function Table() {
  const rows = 5;

  const [tableData, setTableData] = useState(
    Array.from({ length: rows }, () => COLUMN_KEYS.reduce((acc, key) => ({ ...acc, [key]: '' }), {}))
  );
  const [editingCell, setEditingCell] = useState(null);

  const handleCellChange = async (rowIndex, colKey, value) => {
    const newData = [...tableData];
    newData[rowIndex][colKey] = value;
    setTableData(newData);

    // Auto-fill data from Google Sheets when order number is entered
    if (colKey === 'order_number' && value.trim() !== '') {
      try {
        const response = await base44.functions.invoke('fetchOrderData', { orderNumber: value });
        
        if (response.data) {
          newData[rowIndex] = {
            ...newData[rowIndex],
            customer: response.data.customer,
            nights: response.data.nights,
            hotel: response.data.hotel,
            gender: response.data.gender
          };
          setTableData([...newData]);
          toast.success('נתונים נמלאו מגוגל שיטס');
        }
      } catch (error) {
        if (error.response?.status === 404) {
          toast.error('מספר הזמנה לא נמצא');
        } else {
          toast.error('שגיאה בטעינת נתונים');
        }
      }
    }
  };

  const handleCellBlur = (e) => {
    // Only blur if we're not clicking on another cell
    if (!e.relatedTarget || !e.relatedTarget.closest('td')) {
      setTimeout(() => setEditingCell(null), 0);
    }
  };

  const handleKeyDown = (e, rowIndex, colKey) => {
    if (e.key === 'Enter') {
      setEditingCell(null);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const currentColIndex = COLUMN_KEYS.indexOf(colKey);
      
      if (e.shiftKey) {
        // Shift+Tab - move to previous cell
        if (currentColIndex > 0) {
          setEditingCell({ row: rowIndex, col: COLUMN_KEYS[currentColIndex - 1] });
        } else if (rowIndex > 0) {
          setEditingCell({ row: rowIndex - 1, col: COLUMN_KEYS[COLUMN_KEYS.length - 1] });
        }
      } else {
        // Tab - move to next cell
        if (currentColIndex < COLUMN_KEYS.length - 1) {
          setEditingCell({ row: rowIndex, col: COLUMN_KEYS[currentColIndex + 1] });
        } else if (rowIndex < tableData.length - 1) {
          setEditingCell({ row: rowIndex + 1, col: COLUMN_KEYS[0] });
        }
      }
    }
  };

  const handleAddRow = async () => {
    // Save all current rows to the database
    for (const row of tableData) {
      const hasData = COLUMN_KEYS.some(key => row[key]?.trim() !== '');
      if (hasData) {
        await base44.entities.TableData.create(row);
      }
    }
    // Reset the table
    setTableData(Array.from({ length: rows }, () => COLUMN_KEYS.reduce((acc, key) => ({ ...acc, [key]: '' }), {})));
    toast.success('הנתונים נשמרו בהצלחה!');
  };

  return (
    <div className="p-8 md:p-12">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-light text-slate-800 tracking-tight mb-8">
          טבלת נתונים
        </h1>
        
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-x-auto">
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
              {tableData.map((row, rowIndex) => (
                <tr 
                  key={rowIndex} 
                  className="hover:bg-slate-50/50 transition-colors duration-200"
                >
                  {COLUMN_KEYS.map((colKey, colIndex) => (
                    <td 
                      key={colKey} 
                      className="px-2 py-2 text-sm border-b border-slate-100 last:border-b-0"
                    >
                      {editingCell?.row === rowIndex && editingCell?.col === colKey ? (
                        <Input
                          autoFocus
                          value={row[colKey]}
                          onChange={(e) => handleCellChange(rowIndex, colKey, e.target.value)}
                          onBlur={handleCellBlur}
                          onKeyDown={(e) => handleKeyDown(e, rowIndex, colKey)}
                          className="h-9 border-slate-300 focus:border-slate-500 focus:ring-slate-500 text-right"
                        />
                      ) : (
                        <div 
                          className="px-4 py-2 min-h-[36px] rounded-lg cursor-text hover:bg-slate-100 transition-colors flex items-center"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setEditingCell({ row: rowIndex, col: colKey });
                          }}
                        >
                          {row[colKey] || <span className="text-slate-400">—</span>}
                        </div>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-8 flex justify-center">
          <Button 
            onClick={handleAddRow}
            className="bg-slate-900 hover:bg-slate-800 text-white px-8 py-6 text-base font-medium rounded-xl shadow-lg shadow-slate-900/10 hover:shadow-xl hover:shadow-slate-900/20 transition-all duration-300 ease-out"
          >
            <Plus className="w-5 h-5 ml-2" />
            הוסף
          </Button>
        </div>
      </div>
    </div>
  );
}