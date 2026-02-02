import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from './utils';
import { Table2, Database, Receipt, PlusCircle, Landmark, Plane, Ticket, CheckSquare, Users, PartyPopper } from 'lucide-react';

export default function Layout({ children, currentPageName }) {
  // הסתרת התפריט בעמודים ספציפיים
  const hideNavPages = ['AddTask', 'NewSale', 'OrderSuccess'];
  const shouldHideNav = hideNavPages.includes(currentPageName);

  if (shouldHideNav) {
    return (
      <div dir="rtl" className="min-h-screen bg-slate-50">
        {children}
      </div>
    );
  }

  // פונקציית עזר לסימון הדף הפעיל
  const isActive = (page) => currentPageName === page;
  const linkClass = (page) => `flex items-center gap-2 px-4 py-3 rounded-lg font-medium transition-all duration-200 ${
    isActive(page) ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-600 hover:bg-slate-100'
  }`;

  return (
    <div dir="rtl" className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center gap-2 overflow-x-auto py-2 no-scrollbar">
            
            <Link to={createPageUrl('ReturnedToIsrael')} className={linkClass('ReturnedToIsrael')}>
              <Plane className="w-5 h-5 transform rotate-180" />
              <span className="whitespace-nowrap">חזר לארץ</span>
            </Link>
            
            <div className="w-px h-6 bg-slate-200 mx-1 flex-shrink-0" />

            <Link to={createPageUrl('Live')} className={linkClass('Live')}>
              <Users className="w-5 h-5" />
              <span className="whitespace-nowrap">לייב</span>
            </Link>

            <div className="w-px h-6 bg-slate-200 mx-1 flex-shrink-0" />

            <Link to={createPageUrl('PendingSales')} className={linkClass('PendingSales')}>
              <Clock className="w-5 h-5" />
              <span className="whitespace-nowrap">הכנסות ממתינות</span>
            </Link>

            <Link to={createPageUrl('Table')} className={linkClass('Table')}>
              <Table2 className="w-5 h-5" />
              <span className="whitespace-nowrap">צור הכנסה</span>
            </Link>

            <Link to={createPageUrl('SavedData')} className={linkClass('SavedData')}>
              <Database className="w-5 h-5" />
              <span className="whitespace-nowrap">כל ההכנסות</span>
            </Link>

            <div className="w-px h-6 bg-slate-200 mx-1 flex-shrink-0" />

            <Link to={createPageUrl('CreateExpense')} className={linkClass('CreateExpense')}>
              <PlusCircle className="w-5 h-5" />
              <span className="whitespace-nowrap">צור הוצאה</span>
            </Link>

            <Link to={createPageUrl('AllExpenses')} className={linkClass('AllExpenses')}>
              <Receipt className="w-5 h-5" />
              <span className="whitespace-nowrap">כל ההוצאות</span>
            </Link>

            <div className="w-px h-6 bg-slate-200 mx-1 flex-shrink-0" />

            <Link to={createPageUrl('BankTable')} className={linkClass('BankTable')}>
              <Landmark className="w-5 h-5" />
              <span className="whitespace-nowrap">טבלת בנק</span>
            </Link>

            <div className="w-px h-6 bg-slate-200 mx-1 flex-shrink-0" />

            <Link to={createPageUrl('EventsAndAttractions')} className={linkClass('EventsAndAttractions')}>
              <Ticket className="w-5 h-5" />
              <span className="whitespace-nowrap">אירועים</span>
            </Link>

            <div className="w-px h-6 bg-slate-200 mx-1 flex-shrink-0" />

            <Link to={createPageUrl('Tasks')} className={linkClass('Tasks')}>
              <CheckSquare className="w-5 h-5" />
              <span className="whitespace-nowrap">משימות</span>
            </Link>
            
             <div className="w-px h-6 bg-slate-200 mx-1 flex-shrink-0" />

            <Link to={createPageUrl('NewSale')} target="_blank" className={linkClass('NewSale')}>
              <PartyPopper className="w-5 h-5" />
              <span className="whitespace-nowrap">מכירה חדשה</span>
            </Link>

          </div>
        </div>
      </nav>
      
      <main>
        {children}
      </main>
    </div>
  );
}