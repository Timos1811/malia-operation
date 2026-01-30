import React from 'react';
import { CheckSquare } from 'lucide-react';

export default function Tasks() {
  return (
    <div className="p-8 md:p-12 text-right" dir="rtl">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <CheckSquare className="w-8 h-8 text-slate-600" />
          <h1 className="text-3xl font-bold text-slate-800">משימות</h1>
        </div>
        
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 min-h-[400px] flex items-center justify-center text-slate-400">
          <p>דף משימות ריק</p>
        </div>
      </div>
    </div>
  );
}