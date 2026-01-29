import React from 'react';
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default function Table() {
  const rows = 5;
  const columns = 5;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8 md:p-12">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-light text-slate-800 mb-8 tracking-tight">
          Data Table
        </h1>
        
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
              {Array.from({ length: rows }).map((_, rowIndex) => (
                <tr 
                  key={rowIndex} 
                  className="hover:bg-slate-50/50 transition-colors duration-200"
                >
                  {Array.from({ length: columns }).map((_, colIndex) => (
                    <td 
                      key={colIndex} 
                      className="px-6 py-5 text-sm text-slate-400 border-b border-slate-100 last:border-b-0"
                    >
                      —
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-8 flex justify-center">
          <Button 
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