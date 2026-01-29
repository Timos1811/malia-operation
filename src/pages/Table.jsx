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

  const handleCellChange = (rowIndex, colKey, value) => {
    const newData = [...tableData];
    newData[rowIndex][colKey] = value;
    setTableData(newData);
  };

  const handleCellBlur = () => {
    setEditingCell(null);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      setEditingCell(null);
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
                          onKeyDown={handleKeyDown}
                          className="h-9 border-slate-300 focus:border-slate-500 focus:ring-slate-500 text-right"
                        />
                      ) : (
                        <div 
                          className="px-4 py-2 min-h-[36px] rounded-lg cursor-text hover:bg-slate-100 transition-colors flex items-center"
                          onClick={() => setEditingCell({ row: rowIndex, col: colKey })}
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