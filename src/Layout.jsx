import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from './utils';
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Table2, Database, Receipt, PlusCircle, Landmark, Plane, Ticket, CheckSquare, Users, PartyPopper, Clock, UserCircle, RefreshCcw, Loader2, LogIn } from 'lucide-react';

export default function Layout({ children, currentPageName }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const isAuth = await base44.auth.isAuthenticated();
        setIsAuthenticated(isAuth);
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };
    checkAuth();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-slate-50">
        <Loader2 className="w-10 h-10 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-slate-50 gap-6 p-4" dir="rtl">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-black text-slate-900">ברוכים הבאים</h1>
          <p className="text-slate-500 text-lg">יש להתחבר או להירשם למערכת כדי להמשיך</p>
        </div>
        <Button 
          size="lg" 
          className="gap-2 bg-slate-900 text-white hover:bg-slate-800"
          onClick={() => base44.auth.redirectToLogin(window.location.href)}
        >
          <LogIn className="w-5 h-5" />
          התחברות / הרשמה
        </Button>
      </div>
    );
  }

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
            
            <Link to={createPageUrl('SellerDashboard')} className={linkClass('SellerDashboard')}>
              <UserCircle className="w-5 h-5" />
              <span className="whitespace-nowrap">בית</span>
            </Link>

            <div className="w-px h-6 bg-slate-200 mx-1 flex-shrink-0" />

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

            <Link to={createPageUrl('PendingSales')} className={linkClass('PendingSales')}>
              <Clock className="w-5 h-5" />
              <span className="whitespace-nowrap">מכירה בהמתנה</span>
            </Link>

            <div className="w-px h-6 bg-slate-200 mx-1 flex-shrink-0" />

            <Link to={createPageUrl('NewSale')} target="_blank" className={linkClass('NewSale')}>
              <PartyPopper className="w-5 h-5" />
              <span className="whitespace-nowrap">מכירה חדשה</span>
            </Link>

            <div className="w-px h-6 bg-slate-200 mx-1 flex-shrink-0" />

            <Link to={createPageUrl('SwapWristband')} className={linkClass('SwapWristband')}>
              <RefreshCcw className="w-5 h-5" />
              <span className="whitespace-nowrap">החלפת צמיד</span>
            </Link>

            <div className="w-px h-6 bg-slate-200 mx-1 flex-shrink-0" />

            <Link to={createPageUrl('ManagerDashboard')} className={linkClass('ManagerDashboard')}>
              <Users className="w-5 h-5" />
              <span className="whitespace-nowrap">מנהלים</span>
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