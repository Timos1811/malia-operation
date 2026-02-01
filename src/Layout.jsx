import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from './utils';
import { Table2, Database, Receipt, PlusCircle, Landmark, Plane, Ticket, CheckSquare, Users, PartyPopper } from 'lucide-react';

export default function Layout({ children, currentPageName }) {
  const isTablePage = currentPageName === 'Table';
  const isSavedDataPage = currentPageName === 'SavedData';
  const isCreateExpensePage = currentPageName === 'CreateExpense';
  const isAllExpensesPage = currentPageName === 'AllExpenses';
  const isBankTablePage = currentPageName === 'BankTable';
  const isReturnedToIsraelPage = currentPageName === 'ReturnedToIsrael';
  const isLivePage = currentPageName === 'Live';

  if (currentPageName === 'AddTask') {
    return (
      <div dir="rtl" className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        {children}
      </div>
    );
  }

  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <nav className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-8 py-4">
          <div className="flex gap-2 flex-wrap">
            <Link
              to={createPageUrl('ReturnedToIsrael')}
              className={`flex items-center gap-2 px-4 py-3 rounded-lg font-medium transition-all duration-200 ${
                isReturnedToIsraelPage
                  ? 'bg-slate-900 text-white shadow-lg'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Plane className="w-5 h-5 transform rotate-180" />
              <span>חזר לארץ</span>
            </Link>
            <div className="w-px h-8 bg-slate-200 mx-2 self-center" />
            <Link
              to={createPageUrl('Live')}
              className={`flex items-center gap-2 px-4 py-3 rounded-lg font-medium transition-all duration-200 ${
                isLivePage
                  ? 'bg-slate-900 text-white shadow-lg'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Users className="w-5 h-5" />
              <span>לייב</span>
            </Link>
            <div className="w-px h-8 bg-slate-200 mx-2 self-center" />
            <Link
              to={createPageUrl('Table')}
              className={`flex items-center gap-2 px-4 py-3 rounded-lg font-medium transition-all duration-200 ${
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
              className={`flex items-center gap-2 px-4 py-3 rounded-lg font-medium transition-all duration-200 ${
                isSavedDataPage
                  ? 'bg-slate-900 text-white shadow-lg'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Database className="w-5 h-5" />
              <span>כל ההכנסות</span>
            </Link>
            <div className="w-px h-8 bg-slate-200 mx-2 self-center" />
            <Link
              to={createPageUrl('CreateExpense')}
              className={`flex items-center gap-2 px-4 py-3 rounded-lg font-medium transition-all duration-200 ${
                isCreateExpensePage
                  ? 'bg-slate-900 text-white shadow-lg'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <PlusCircle className="w-5 h-5" />
              <span>צור הוצאה</span>
            </Link>
            <Link
              to={createPageUrl('AllExpenses')}
              className={`flex items-center gap-2 px-4 py-3 rounded-lg font-medium transition-all duration-200 ${
                isAllExpensesPage
                  ? 'bg-slate-900 text-white shadow-lg'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Receipt className="w-5 h-5" />
              <span>כל ההוצאות</span>
            </Link>
            <div className="w-px h-8 bg-slate-200 mx-2 self-center" />
            <Link
              to={createPageUrl('BankTable')}
              className={`flex items-center gap-2 px-4 py-3 rounded-lg font-medium transition-all duration-200 ${
                isBankTablePage
                  ? 'bg-slate-900 text-white shadow-lg'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Landmark className="w-5 h-5" />
              <span>טבלת בנק</span>
            </Link>
            <div className="w-px h-8 bg-slate-200 mx-2 self-center" />
            <Link
              to={createPageUrl('EventsAndAttractions')}
              className={`flex items-center gap-2 px-4 py-3 rounded-lg font-medium transition-all duration-200 ${
                currentPageName === 'EventsAndAttractions'
                  ? 'bg-slate-900 text-white shadow-lg'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Ticket className="w-5 h-5" />
              <span>אירועים ואטרקציות</span>
            </Link>
            <div className="w-px h-8 bg-slate-200 mx-2 self-center" />
            <Link
              to={createPageUrl('Tasks')}
              className={`flex items-center gap-2 px-4 py-3 rounded-lg font-medium transition-all duration-200 ${
                currentPageName === 'Tasks'
                  ? 'bg-slate-900 text-white shadow-lg'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <CheckSquare className="w-5 h-5" />
              <span>משימות</span>
            </Link>
            <div className="w-px h-8 bg-slate-200 mx-2 self-center" />
            <Link
              to={createPageUrl('NewSale')}
              target="_blank"
              className={`flex items-center gap-2 px-4 py-3 rounded-lg font-medium transition-all duration-200 ${
                currentPageName === 'NewSale'
                  ? 'bg-slate-900 text-white shadow-lg'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <PartyPopper className="w-5 h-5" />
              <span>מכירה חדשה</span>
            </Link>
          </div>
        </div>
      </nav>
      {children}
    </div>
  );
}