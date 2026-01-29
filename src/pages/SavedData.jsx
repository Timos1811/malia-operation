import React from 'react';
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Loader2, Database } from "lucide-react";

export default function SavedData() {
  const { data: savedRows = [], isLoading } = useQuery({
    queryKey: ['tableData'],
    queryFn: () => base44.entities.TableData.list('-created_date'),
  });

  const columns = 5;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8 md:p-12">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Database className="w-8 h-8 text-slate-600" />
          <h1 className="text-3xl font-light text-slate-800 tracking-tight">
            Saved Data
          </h1>
        </div>
        
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
            </div>
          ) : savedRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <Database className="w-12 h-12 mb-4" />
              <p className="text-lg">No saved data yet</p>
              <p className="text-sm mt-1">Add rows from the Data Table page</p>
            </div>
          ) : (
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
                {savedRows.map((row, rowIndex) => (
                  <tr 
                    key={row.id} 
                    className="hover:bg-slate-50/50 transition-colors duration-200"
                  >
                    {Array.from({ length: columns }).map((_, colIndex) => (
                      <td 
                        key={colIndex} 
                        className="px-6 py-5 text-sm text-slate-700 border-b border-slate-100 last:border-b-0"
                      >
                        {row.row_data?.[colIndex] || <span className="text-slate-400">—</span>}
                      </td>
                    ))}
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