import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Save, Check } from "lucide-react";
import { toast } from "sonner";

export default function Table() {
  const rows = 5;
  const columns = 5;

  const [tableData, setTableData] = useState(
    Array.from({ length: rows }, () => Array.from({ length: columns }, () => ''))
  );
  const [editingCell, setEditingCell] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);

  const handleCellClick = (rowIndex, colIndex) => {
    setEditingCell({ row: rowIndex, col: colIndex });
  };

  const handleCellChange = (rowIndex, colIndex, value) => {
    const newData = [...tableData];
    newData[rowIndex][colIndex] = value;
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

  const handleAddRow = () => {
    setTableData([...tableData, Array.from({ length: columns }, () => '')]);
    setHasChanges(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8 md:p-12">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-light text-slate-800 tracking-tight">
            Data Table
          </h1>
          {hasChanges && (
            <Button 
              onClick={handleSave}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 font-medium rounded-xl shadow-lg shadow-emerald-600/20 hover:shadow-xl hover:shadow-emerald-600/30 transition-all duration-300"
            >
              <Save className="w-4 h-4 mr-2" />
              Save Changes
            </Button>
          )}
        </div>
        
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50/80">
                {Array.from({ length: columns }).map((_, colIndex) => (
                  <th 
                    key={colIndex} 
                    className="px-6 py-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wider border-b border-slate-200/60"
                  >
                    Column {colIndex + 1}
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
                  {row.map((cellValue, colIndex) => (
                    <td 
                      key={colIndex} 
                      className="px-2 py-2 text-sm border-b border-slate-100 last:border-b-0"
                      onClick={() => handleCellClick(rowIndex, colIndex)}
                    >
                      {editingCell?.row === rowIndex && editingCell?.col === colIndex ? (
                        <Input
                          autoFocus
                          value={cellValue}
                          onChange={(e) => handleCellChange(rowIndex, colIndex, e.target.value)}
                          onBlur={handleCellBlur}
                          onKeyDown={handleKeyDown}
                          className="h-9 border-slate-300 focus:border-slate-500 focus:ring-slate-500"
                        />
                      ) : (
                        <div className="px-4 py-2 min-h-[36px] rounded-lg cursor-pointer hover:bg-slate-100 transition-colors flex items-center">
                          {cellValue || <span className="text-slate-400">—</span>}
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
            <Plus className="w-5 h-5 mr-2" />
            Add
          </Button>
        </div>
      </div>
    </div>
  );
}