import React, { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { createPageUrl } from './utils';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import {
  Table2, Database, Receipt, PlusCircle, Landmark, Plane, Ticket, CheckSquare,
  Users, PartyPopper, Clock, UserCircle, RefreshCcw, Loader2, LogIn, Scan,
  LogOut, UserCheck, BarChart3, Languages, Menu,
} from 'lucide-react';
import { Toaster } from '@/components/ui/sonner';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import NotificationsManager from '@/components/NotificationsManager';
import GlobalDataChat from '@/components/GlobalDataChat';

const ADMIN_LINKS = [
  { page: 'SellerDashboard', label: 'בית', Icon: UserCircle },
  { page: 'PendingSales', label: 'מכירה בהמתנה', Icon: Clock },
  { page: 'Table', label: 'צור הכנסה', Icon: Table2 },
  { page: 'SavedData', label: 'כל ההכנסות', Icon: Database },
  { page: 'CreateExpense', label: 'צור הוצאה', Icon: PlusCircle },
  { page: 'AllExpenses', label: 'כל ההוצאות', Icon: Receipt },
  { page: 'BankTable', label: 'טבלת בנק', Icon: Landmark },
  { page: 'Live', label: 'לייב', Icon: Users },
  { page: 'Tasks', label: 'משימות', Icon: CheckSquare },
  { page: 'ManagerDashboard', label: 'נציגים', Icon: Users },
  { page: 'Caspars', label: 'כספרים', Icon: Users },
  { page: 'ReturnedToIsrael', label: 'חזר לארץ', Icon: Plane, iconClass: 'transform rotate-180' },
  { page: 'EventsAndAttractions', label: 'אירועים', Icon: Ticket },
  { page: 'EventStats', label: 'דוחות אירועים', Icon: BarChart3 },
  { page: 'NewSale', label: 'מכירה חדשה', Icon: PartyPopper, newTab: true },
  { page: 'SwapWristband', label: 'החלפת צמיד', Icon: RefreshCcw },
  { page: 'EventScanner', label: 'סורק כניסה', Icon: Scan },
  { page: 'WristbandHistory', label: 'היסטוריית צמידים', Icon: Clock },
  { page: 'UserApproval', label: 'אישור משתמשים', Icon: UserCheck, accent: true },
];

export default function Layout({ children, currentPageName }) {
  const { user, isLoadingAuth } = useAuth();
  const [currentLang, setCurrentLang] = useState(
    typeof document !== 'undefined' && /googtrans=\/(iw|he|auto)\/en/.test(document.cookie) ? 'en' : 'he'
  );
  const [menuOpen, setMenuOpen] = useState(false);

  const toggleLanguage = () => {
    if (currentLang === 'he') {
      document.cookie = 'googtrans=/iw/en; path=/';
      document.cookie = `googtrans=/iw/en; path=/; domain=.${window.location.hostname}`;
    } else {
      document.cookie = 'googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/';
      document.cookie = `googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.${window.location.hostname}`;
    }
    window.location.reload();
  };

  if (isLoadingAuth) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-blue-50/30">
        <Loader2 className="w-10 h-10 animate-spin text-blue-400" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-blue-50/30 gap-6 p-4" dir="rtl">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-black text-blue-900">ברוכים הבאים</h1>
          <p className="text-blue-600 text-lg">יש להתחבר או להירשם למערכת כדי להמשיך</p>
        </div>
        <Button size="lg" className="gap-2 bg-blue-600 text-white hover:bg-blue-700"
          onClick={() => base44.auth.redirectToLogin(window.location.href)}>
          <LogIn className="w-5 h-5" />
          התחברות / הרשמה
        </Button>
      </div>
    );
  }

  if (user.status === 'pending') {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-blue-50/30 gap-6 p-4" dir="rtl">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-black text-blue-900">חשבונך בבדיקה</h1>
          <p className="text-blue-600 text-lg">משתמש זה עדיין לא אושר על ידי מנהל המערכת.</p>
        </div>
        <Button size="lg" variant="outline" className="gap-2" onClick={() => base44.auth.logout()}>
          <LogOut className="w-5 h-5" />
          התנתק
        </Button>
      </div>
    );
  }

  const hideNavPages = ['AddTask', 'NewSale', 'OrderSuccess', 'MyOrder'];
  const shouldHideNav = hideNavPages.includes(currentPageName);

  const allowedForUser = ['SellerDashboard', 'NewSale', 'AddTask', 'SwapWristband', 'AddEventToWristband', 'AgentGroups', 'SubmitReceipt'];
  if (user.role !== 'admin' && !allowedForUser.includes(currentPageName)) {
    return <Navigate to={createPageUrl('SellerDashboard')} replace />;
  }

  if (shouldHideNav) {
    return <div dir="rtl" className="min-h-screen bg-blue-50/30">{children}</div>;
  }

  const isActive = (page) => currentPageName === page;
  const linkClass = (page, accent) => `flex items-center gap-2 px-3 py-2 rounded-lg font-medium min-h-[44px] transition-all duration-200 ${
    isActive(page)
      ? 'bg-blue-600 text-white shadow-lg shadow-blue-200'
      : accent ? 'text-indigo-700 hover:bg-indigo-50' : 'text-slate-600 hover:bg-blue-50 hover:text-blue-600'
  }`;

  const renderLink = (link, onClick) => {
    const Icon = link.Icon;
    return (
      <Link
        key={link.page}
        to={createPageUrl(link.page)}
        target={link.newTab ? '_blank' : undefined}
        className={linkClass(link.page, link.accent)}
        onClick={onClick}
      >
        <Icon className={`w-5 h-5 ${link.iconClass || ''} ${link.accent ? 'text-indigo-600' : ''}`} />
        <span className="whitespace-nowrap">{link.label}</span>
      </Link>
    );
  };

  return (
    <div dir="rtl" className="min-h-screen bg-blue-50/30">
      <button
        onClick={toggleLanguage}
        className="fixed bottom-20 lg:bottom-6 right-6 z-[100] bg-white p-3 rounded-full shadow-lg border border-blue-100 hover:bg-blue-50 flex items-center justify-center min-h-[44px] min-w-[44px]"
        title="Translate to English / עברית"
        aria-label="Toggle language"
      >
        <Languages className="w-6 h-6 text-blue-600" />
      </button>

      {user.role === 'admin' && (
        <nav className="bg-white/80 backdrop-blur-md border-b border-blue-100 shadow-sm sticky top-0 z-40">
          <div className="max-w-[120rem] mx-auto px-4 py-2">
            {/* Mobile: hamburger only */}
            <div className="flex lg:hidden items-center justify-between py-1">
              <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="פתח תפריט">
                    <Menu className="w-6 h-6" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-[280px] sm:w-[320px] overflow-y-auto" dir="rtl">
                  <SheetHeader>
                    <SheetTitle>תפריט</SheetTitle>
                  </SheetHeader>
                  <div className="flex flex-col gap-1 mt-4">
                    {ADMIN_LINKS.map((link) => renderLink(link, () => setMenuOpen(false)))}
                  </div>
                </SheetContent>
              </Sheet>
              <Link to={createPageUrl('SellerDashboard')} className="flex items-center gap-2 font-bold text-blue-900">
                <UserCircle className="w-5 h-5" />
                בית
              </Link>
              <div className="w-10" />
            </div>

            {/* Desktop: full nav */}
            <div className="hidden lg:block">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                {ADMIN_LINKS.slice(0, 9).map((l) => renderLink(l))}
              </div>
              <div className="flex items-center gap-2 flex-wrap border-t border-slate-100 pt-2">
                {ADMIN_LINKS.slice(9).map((l) => renderLink(l))}
              </div>
            </div>
          </div>
        </nav>
      )}

      <main>{children}</main>
      <Toaster />
      <NotificationsManager />
      <GlobalDataChat />
    </div>
  );
}
