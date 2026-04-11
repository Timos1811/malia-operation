import React, { useState, useEffect } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { createPageUrl } from './utils';
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Table2, Database, Receipt, PlusCircle, Landmark, Plane, Ticket, CheckSquare, Users, PartyPopper, Clock, UserCircle, RefreshCcw, Loader2, LogIn, Scan, LogOut, UserCheck } from 'lucide-react';
import { Toaster } from "@/components/ui/sonner";
import NotificationsManager from "@/components/NotificationsManager";
import GlobalDataChat from "@/components/GlobalDataChat";

export default function Layout({ children, currentPageName }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const isAuth = await base44.auth.isAuthenticated();
        setIsAuthenticated(isAuth);
        if (isAuth) {
           const currentUser = await base44.auth.me();
           setUser(currentUser);
        }
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
      <div className="min-h-screen w-full flex items-center justify-center bg-blue-50/30">
        <Loader2 className="w-10 h-10 animate-spin text-blue-400" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-blue-50/30 gap-6 p-4" dir="rtl">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-black text-blue-900">ברוכים הבאים</h1>
          <p className="text-blue-600 text-lg">יש להתחבר או להירשם למערכת כדי להמשיך</p>
        </div>
        <Button 
          size="lg" 
          className="gap-2 bg-blue-600 text-white hover:bg-blue-700"
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

  if (user && user.role !== 'admin' && user.status === 'pending') {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-blue-50/30 gap-6 p-4" dir="rtl">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-black text-blue-900">חשבונך בבדיקה</h1>
          <p className="text-blue-600 text-lg">משתמש זה עדיין לא אושר על ידי מנהל המערכת.</p>
        </div>
        <Button 
          size="lg" 
          variant="outline"
          className="gap-2"
          onClick={() => base44.auth.logout()}
        >
          <LogOut className="w-5 h-5" />
          התנתק
        </Button>
      </div>
    );
  }

  const allowedForUser = [
    'SellerDashboard', 'NewSale', 'AddTask', 'SwapWristband', 
    'AddEventToWristband', 'AgentGroups', 'SubmitReceipt'
  ];

  if (user && user.role !== 'admin' && !allowedForUser.includes(currentPageName)) {
    return <Navigate to={createPageUrl('SellerDashboard')} replace />;
  }

  if (shouldHideNav) {
    return (
      <div dir="rtl" className="min-h-screen bg-blue-50/30">
        {children}
      </div>
    );
  }

  // פונקציית עזר לסימון הדף הפעיל
  const isActive = (page) => currentPageName === page;
  const linkClass = (page) => `flex items-center gap-2 px-3 py-2 rounded-lg font-medium transition-all duration-200 ${
    isActive(page) ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'text-slate-600 hover:bg-blue-50 hover:text-blue-600'
  }`;

  return (
    <div dir="rtl" className="min-h-screen bg-blue-50/30">
      {user?.role === 'admin' && (
      <nav className="bg-white/80 backdrop-blur-md border-b border-blue-100 shadow-sm sticky top-0 z-50">
        <div className="max-w-[120rem] mx-auto px-4 py-2">
          {/* Row 1 - Main Actions */}
          <div className="flex items-center gap-2 mb-2 overflow-x-auto lg:overflow-visible lg:flex-wrap no-scrollbar pb-2 lg:pb-0">
            <Link to={createPageUrl('SellerDashboard')} className={linkClass('SellerDashboard')}>
              <UserCircle className="w-5 h-5" />
              <span className="whitespace-nowrap">בית</span>
            </Link>

            {user?.role === 'admin' && (
              <>
                <Link to={createPageUrl('PendingSales')} className={linkClass('PendingSales')}>
                  <Clock className="w-5 h-5" />
                  <span className="whitespace-nowrap">מכירה בהמתנה</span>
                </Link>

                <Link to={createPageUrl('Table')} className={linkClass('Table')}>
                  <Table2 className="w-5 h-5" />
                  <span className="whitespace-nowrap">צור הכנסה</span>
                </Link>

                <Link to={createPageUrl('SavedData')} className={linkClass('SavedData')}>
                  <Database className="w-5 h-5" />
                  <span className="whitespace-nowrap">כל ההכנסות</span>
                </Link>

                <Link to={createPageUrl('CreateExpense')} className={linkClass('CreateExpense')}>
                  <PlusCircle className="w-5 h-5" />
                  <span className="whitespace-nowrap">צור הוצאה</span>
                </Link>

                <Link to={createPageUrl('AllExpenses')} className={linkClass('AllExpenses')}>
                  <Receipt className="w-5 h-5" />
                  <span className="whitespace-nowrap">כל ההוצאות</span>
                </Link>

                <Link to={createPageUrl('BankTable')} className={linkClass('BankTable')}>
                  <Landmark className="w-5 h-5" />
                  <span className="whitespace-nowrap">טבלת בנק</span>
                </Link>

                <Link to={createPageUrl('Live')} className={linkClass('Live')}>
                  <Users className="w-5 h-5" />
                  <span className="whitespace-nowrap">לייב</span>
                </Link>

                <Link to={createPageUrl('Tasks')} className={linkClass('Tasks')}>
                  <CheckSquare className="w-5 h-5" />
                  <span className="whitespace-nowrap">משימות</span>
                </Link>
              </>
            )}
          </div>
          
          {/* Row 2 - Management & Tools */}
          {user?.role === 'admin' && (
            <div className="flex items-center gap-2 overflow-x-auto lg:overflow-visible lg:flex-wrap no-scrollbar border-t border-slate-100 pt-2">
              <Link to={createPageUrl('ManagerDashboard')} className={linkClass('ManagerDashboard')}>
                <Users className="w-5 h-5" />
                <span className="whitespace-nowrap">נציגים</span>
              </Link>

              <Link to={createPageUrl('Caspars')} className={linkClass('Caspars')}>
                <Users className="w-5 h-5" />
                <span className="whitespace-nowrap">כספרים</span>
              </Link>
              
              <Link to={createPageUrl('ReturnedToIsrael')} className={linkClass('ReturnedToIsrael')}>
                <Plane className="w-5 h-5 transform rotate-180" />
                <span className="whitespace-nowrap">חזר לארץ</span>
              </Link>

              <Link to={createPageUrl('EventsAndAttractions')} className={linkClass('EventsAndAttractions')}>
                <Ticket className="w-5 h-5" />
                <span className="whitespace-nowrap">אירועים</span>
              </Link>
              
              <Link to={createPageUrl('NewSale')} target="_blank" className={linkClass('NewSale')}>
                <PartyPopper className="w-5 h-5" />
                <span className="whitespace-nowrap">מכירה חדשה</span>
              </Link>

              <Link to={createPageUrl('SwapWristband')} className={linkClass('SwapWristband')}>
                <RefreshCcw className="w-5 h-5" />
                <span className="whitespace-nowrap">החלפת צמיד</span>
              </Link>

              <Link to={createPageUrl('EventScanner')} className={linkClass('EventScanner')}>
                <Scan className="w-5 h-5" />
                <span className="whitespace-nowrap">סורק כניסה</span>
              </Link>

              <Link to={createPageUrl('WristbandHistory')} className={linkClass('WristbandHistory')}>
                <Clock className="w-5 h-5" />
                <span className="whitespace-nowrap">היסטוריית צמידים</span>
              </Link>

              <Link to={createPageUrl('UserApproval')} className={linkClass('UserApproval')}>
                <UserCheck className="w-5 h-5 text-indigo-600" />
                <span className="whitespace-nowrap font-bold text-indigo-700">אישור משתמשים</span>
              </Link>
            </div>
          )}
        </div>
      </nav>
      )}
      
      <main>
        {children}
      </main>
      <Toaster />
      <NotificationsManager />
      <GlobalDataChat />
      </div>
      );
      }