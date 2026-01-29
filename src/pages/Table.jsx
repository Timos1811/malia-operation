import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Save } from "lucide-react";
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
  const [hasChanges, setHasChanges] = useState(false);

  const handleCellClick = (rowIndex, colKey) => {
    setEditingCell({ row: rowIndex, col: colKey });
  };

  const handleCellChange = (rowIndex, colKey, value) => {
    const newData = [...tableData];
    newData[rowIndex][colKey] = value;
    setTableData(newData);
    setHasChanges(true);
  };

  const handleCellBlur = () => {
    setEditingCell(null);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      setEditingCell(null);
    }
  };

  const handleSave = () => {
    toast.success('Changes saved successfully!');
    setHasChanges(false);
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
    setHasChanges(false);
    toast.success('הנתונים נשמרו בהצלחה!');
  };

  return (
    <div className="p-8 md:p-12">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-light text-slate-800 tracking-tight">
            טבלת נתונים
          </h1>
          {hasChanges && (
            <Button 
              onClick={handleSave}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 font-medium rounded-xl shadow-lg shadow-emerald-600/20 hover:shadow-xl hover:shadow-emerald-600/30 transition-all duration-300"
            >
              <Save className="w-4 h-4 ml-2" />
              שמור שינויים
            </Button>
          )}
        </div>
        
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
                      onClick={() => handleCellClick(rowIndex, colKey)}
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
                        <div className="px-4 py-2 min-h-[36px] rounded-lg cursor-pointer hover:bg-slate-100 transition-colors flex items-center">
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