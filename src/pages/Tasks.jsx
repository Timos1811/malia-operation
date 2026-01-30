import React from 'react';
import { CheckSquare, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { Button } from "@/components/ui/button";

export default function Tasks() {
  return (
    <div className="p-8 md:p-12 text-right" dir="rtl">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <CheckSquare className="w-8 h-8 text-slate-600" />
            <h1 className="text-3xl font-bold text-slate-800">משימות</h1>
          </div>
          <Link to={createPageUrl('AddTask')}>
            <Button className="bg-slate-900 text-white hover:bg-slate-800 gap-2">
              <Plus className="w-4 h-4" />
              הוסף משימה
            </Button>
          </Link>
        </div>
        
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 min-h-[400px] flex items-center justify-center text-slate-400">
          <p>דף משימות ריק</p>
        </div>
      </div>
    </div>
  );
}