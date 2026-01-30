import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from './utils';
import { Table2, Database } from 'lucide-react';

export default function Layout({ children, currentPageName }) {
  const isTablePage = currentPageName === 'Table';
  const isSavedDataPage = currentPageName === 'SavedData';

  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <nav className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-8 py-4">
          <div className="flex gap-2">
            <Link
              to={createPageUrl('Table')}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
                isTablePage
                  ? 'bg-slate-900 text-white shadow-lg'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Table2 className="w-5 h-5" />
              <span>צור הכנסה</span>
            </Link>
            <Link
              to={createPageUrl('SavedData')}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
                isSavedDataPage
                  ? 'bg-slate-900 text-white shadow-lg'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Database className="w-5 h-5" />
              <span>נתונים שמורים</span>
            </Link>
          </div>
        </div>
      </nav>
      {children}
    </div>
  );
}