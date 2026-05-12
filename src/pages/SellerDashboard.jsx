import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PartyPopper, CheckSquare, UserCircle, LogOut, RefreshCcw, Users, Receipt } from 'lucide-react';
import { Loader2 } from "lucide-react";

export default function SellerDashboard() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [stats, setStats] = useState({
    totalIncome: 0, 
    totalGroups: 0,
    fullRefundsAmount: 0,
    fullRefundsCount: 0,
    partialRefundsAmount: 0,
    partialRefundsCount: 0,
    withdrawalsAmount: 0,
    withdrawalsCount: 0,
    shortagesAmount: 0
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);

        if (currentUser?.full_name) {
          // Fetch sales and pending sales for this user
          const [tableSales, pendingSales] = await Promise.all([
            base44.entities.TableData.filter({ sales_rep: currentUser.full_name }, '-created_date', 1000),
            base44.entities.PendingSale.filter({ sales_rep: currentUser.full_name }, '-created_date', 500)
          ]);
          const sales = [...tableSales, ...pendingSales];
          
          const totalGroups = sales.length;
          
          let calculatedTotalIncome = 0;
          let calculatedShortages = 0;

          sales.forEach(sale => {
            // Calculate Actual Income
            const eur = parseFloat(sale.eur_amount) || 0;
            const nis = parseFloat(sale.shekel_amount) || 0;
            const usd = parseFloat(sale.dollar_amount) || 0;
            const bit = parseFloat(sale.bit_amount) || 0;
            
            // Rates: NIS/Bit = 0.26, USD = 0.95
            const actualTotal = eur + (nis * 0.26) + (usd * 0.95) + (bit * 0.26);
            calculatedTotalIncome += actualTotal;

            // Calculate Shortages based on eur_status
            if (sale.eur_status && sale.eur_status !== 'מאוזן') {
              const statusVal = parseFloat(sale.eur_status);
              if (!isNaN(statusVal) && statusVal < 0) {
                calculatedShortages += Math.abs(statusVal);
              }
            }
          });

          const totalIncome = calculatedTotalIncome;

          // Fetch expenses where I am the sales rep (for refunds)
          const myCreatedExpenses = await base44.entities.Expense.filter({
            sales_rep: currentUser.full_name
          }, '-expense_date', 1000);

          const fullRefunds = myCreatedExpenses.filter(r => r.reason === 'החזר מלא');
          const fullRefundsCount = fullRefunds.length;
          const fullRefundsAmount = fullRefunds.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);

          const partialRefunds = myCreatedExpenses.filter(r => r.reason === 'החזר חלקי');
          const partialRefundsCount = partialRefunds.length;
          const partialRefundsAmount = partialRefunds.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);

          // Fetch withdrawals where I am the recipient
          const myWithdrawals = await base44.entities.Expense.filter({
             reason: 'משיכה לאדם',
             recipient: currentUser.full_name
          }, '-expense_date', 1000);
          
          const withdrawalsCount = myWithdrawals.length;
          const withdrawalsAmount = myWithdrawals.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);

          setStats({ 
            totalIncome, 
            totalGroups, 
            fullRefundsCount,
            fullRefundsAmount,
            partialRefundsCount,
            partialRefundsAmount,
            withdrawalsCount, 
            withdrawalsAmount,
            shortagesAmount: calculatedShortages
          });
        }
      } catch (error) {
        console.error("Failed to fetch data", error);
        setError("אירעה שגיאה בטעינת הנתונים. אנא נסה לרענן את העמוד.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50" dir="rtl">
        <div className="text-center space-y-4">
            <div className="bg-red-100 p-4 rounded-full inline-flex">
                <Users className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-xl font-bold text-slate-800">שגיאה</h2>
            <p className="text-slate-500">{error}</p>
            <Button onClick={() => window.location.reload()} variant="outline">נסה שוב</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-12" dir="rtl">
      <div className="max-w-4xl mx-auto space-y-6 md:space-y-8">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-6 bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="bg-indigo-100 p-3 rounded-full shrink-0">
              <UserCircle className="w-8 h-8 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-slate-800">
                שלום, {user?.full_name || 'מוכר יקר'}
              </h1>
              <p className="text-sm md:text-base text-slate-500">ברוך הבא למערכת הניהול שלך</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 w-full md:flex md:flex-wrap md:justify-center md:gap-4">
            <div className="bg-indigo-50 px-4 py-3 rounded-xl border border-indigo-100 text-center flex flex-col justify-center">
              <span className="block text-indigo-600 text-xs font-bold uppercase tracking-wider mb-1">סה"כ הכנסות</span>
              <span className="text-lg md:text-2xl font-black text-indigo-900">€{stats.totalIncome.toLocaleString()}</span>
            </div>
            <div className="bg-emerald-50 px-4 py-3 rounded-xl border border-emerald-100 text-center flex flex-col justify-center">
              <span className="block text-emerald-600 text-xs font-bold uppercase tracking-wider mb-1">קבוצות</span>
              <span className="text-lg md:text-2xl font-black text-emerald-900">{stats.totalGroups}</span>
            </div>
            <div className="bg-red-50 px-4 py-3 rounded-xl border border-red-100 text-center flex flex-col justify-center">
              <span className="block text-red-600 text-xs font-bold uppercase tracking-wider mb-1">החזר מלא ({stats.fullRefundsCount})</span>
              <span className="text-lg md:text-2xl font-black text-red-900">€{stats.fullRefundsAmount.toLocaleString()}</span>
            </div>
            <div className="bg-orange-50 px-4 py-3 rounded-xl border border-orange-100 text-center flex flex-col justify-center">
              <span className="block text-orange-600 text-xs font-bold uppercase tracking-wider mb-1">החזר חלקי ({stats.partialRefundsCount})</span>
              <span className="text-lg md:text-2xl font-black text-orange-900">€{stats.partialRefundsAmount.toLocaleString()}</span>
            </div>
            <div className="bg-blue-50 px-4 py-3 rounded-xl border border-blue-100 text-center flex flex-col justify-center">
              <span className="block text-blue-600 text-xs font-bold uppercase tracking-wider mb-1">משיכות ({stats.withdrawalsCount})</span>
              <span className="text-lg md:text-2xl font-black text-blue-900">€{stats.withdrawalsAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
            </div>
            <div className="bg-rose-50 px-4 py-3 rounded-xl border border-rose-100 text-center flex flex-col justify-center">
              <span className="block text-rose-600 text-xs font-bold uppercase tracking-wider mb-1">חוסרים</span>
              <span className="text-lg md:text-2xl font-black text-rose-900">€{stats.shortagesAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
            </div>
          </div>

          <Button 
            variant="ghost" 
            className="text-slate-500 hover:text-red-600 gap-2 w-full md:w-auto mt-2 md:mt-0"
            onClick={async () => await base44.auth.logout()}
          >
            <LogOut className="w-4 h-4" />
            התנתק
          </Button>
        </div>

        {/* Action Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
          
          <Link to={createPageUrl('NewSale')} className="block group">
            <Card className="h-full border-slate-200 hover:border-indigo-300 hover:shadow-md transition-all duration-300 cursor-pointer group-hover:-translate-y-1">
              <CardHeader className="pb-4">
                <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center mb-2 group-hover:scale-110 transition-transform duration-300">
                  <PartyPopper className="w-6 h-6 text-indigo-600" />
                </div>
                <CardTitle className="text-xl group-hover:text-indigo-700 transition-colors">מכירה חדשה</CardTitle>
                <CardDescription>רישום הזמנה חדשה וסריקת צמידים</CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
                  <PartyPopper className="w-4 h-4" />
                  התחל מכירה
                </Button>
              </CardContent>
            </Card>
          </Link>

          <Link to={createPageUrl('AddTask')} className="block group">
            <Card className="h-full border-slate-200 hover:border-emerald-300 hover:shadow-md transition-all duration-300 cursor-pointer group-hover:-translate-y-1">
              <CardHeader className="pb-4">
                <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center mb-2 group-hover:scale-110 transition-transform duration-300">
                  <CheckSquare className="w-6 h-6 text-emerald-600" />
                </div>
                <CardTitle className="text-xl group-hover:text-emerald-700 transition-colors">בקשה חדשה</CardTitle>
                <CardDescription>יצירת בקשת החזר או משימה כללית</CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
                  <CheckSquare className="w-4 h-4" />
                  צור בקשה
                </Button>
              </CardContent>
            </Card>
          </Link>

          <Link to={createPageUrl('SwapWristband')} className="block group">
            <Card className="h-full border-slate-200 hover:border-orange-300 hover:shadow-md transition-all duration-300 cursor-pointer group-hover:-translate-y-1">
              <CardHeader className="pb-4">
                <div className="w-12 h-12 bg-orange-50 rounded-xl flex items-center justify-center mb-2 group-hover:scale-110 transition-transform duration-300">
                  <RefreshCcw className="w-6 h-6 text-orange-600" />
                </div>
                <CardTitle className="text-xl group-hover:text-orange-700 transition-colors">החלפת צמיד</CardTitle>
                <CardDescription>החלפת צמיד תקול והעברת נתונים</CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full bg-orange-600 hover:bg-orange-700 text-white gap-2">
                  <RefreshCcw className="w-4 h-4" />
                  החלף צמיד
                </Button>
              </CardContent>
            </Card>
          </Link>

          <Link to={createPageUrl('AddEventToWristband')} className="block group">
            <Card className="h-full border-slate-200 hover:border-purple-300 hover:shadow-md transition-all duration-300 cursor-pointer group-hover:-translate-y-1">
              <CardHeader className="pb-4">
                <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center mb-2 group-hover:scale-110 transition-transform duration-300">
                  <PartyPopper className="w-6 h-6 text-purple-600" />
                </div>
                <CardTitle className="text-xl group-hover:text-purple-700 transition-colors">הוספת אירוע</CardTitle>
                <CardDescription>הוספת אירוע לצמיד קיים וחיוב</CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full bg-purple-600 hover:bg-purple-700 text-white gap-2">
                  <PartyPopper className="w-4 h-4" />
                  הוסף אירוע
                </Button>
              </CardContent>
            </Card>
          </Link>

          <Link to={createPageUrl('AgentGroups')} className="block group">
            <Card className="h-full border-slate-200 hover:border-blue-300 hover:shadow-md transition-all duration-300 cursor-pointer group-hover:-translate-y-1">
              <CardHeader className="pb-4">
                <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center mb-2 group-hover:scale-110 transition-transform duration-300">
                  <Users className="w-6 h-6 text-blue-600" />
                </div>
                <CardTitle className="text-xl group-hover:text-blue-700 transition-colors">הקבוצות שלי</CardTitle>
                <CardDescription>צפייה בכל הקבוצות וקבוצות ביעד</CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white gap-2">
                  <Users className="w-4 h-4" />
                  צפה בקבוצות
                </Button>
              </CardContent>
            </Card>
          </Link>

          <Link to="/SubmitReceipt" className="block group">
            <Card className="h-full border-slate-200 hover:border-teal-300 hover:shadow-md transition-all duration-300 cursor-pointer group-hover:-translate-y-1">
              <CardHeader className="pb-4">
                <div className="w-12 h-12 bg-teal-50 rounded-xl flex items-center justify-center mb-2 group-hover:scale-110 transition-transform duration-300">
                  <Receipt className="w-6 h-6 text-teal-600" />
                </div>
                <CardTitle className="text-xl group-hover:text-teal-700 transition-colors">הגשת קבלה</CardTitle>
                <CardDescription>צילום והגשת קבלות לאישור והחזר</CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full bg-teal-600 hover:bg-teal-700 text-white gap-2">
                  <Receipt className="w-4 h-4" />
                  הגש קבלה
                </Button>
              </CardContent>
            </Card>
          </Link>

        </div>

      </div>
    </div>
  );
}