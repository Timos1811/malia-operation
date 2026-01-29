import React from 'react';
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Loader2, Database } from "lucide-react";

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

export default function SavedData() {
  const { data: savedRows = [], isLoading } = useQuery({
    queryKey: ['tableData'],
    queryFn: () => base44.entities.TableData.list('-created_date'),
  });

  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8 md:p-12">
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
                    {COLUMN_KEYS.map((colKey) => (
                      <td 
                        key={colKey} 
                        className="px-4 py-5 text-sm text-slate-700 border-b border-slate-100 last:border-b-0"
                      >
                        {row[colKey] || <span className="text-slate-400">—</span>}
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