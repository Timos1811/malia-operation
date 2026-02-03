import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PartyPopper, CheckSquare, UserCircle, LogOut } from 'lucide-react';
import { Loader2 } from "lucide-react";

export default function SellerDashboard() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

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
          // Fetch sales for this user
          const sales = await base44.entities.TableData.filter({ 
            sales_rep: currentUser.full_name 
          });
          
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

          // Fetch refunds for this user
          const refunds = await base44.entities.Expense.filter({
            sales_rep: currentUser.full_name
          });

          const fullRefunds = refunds.filter(r => r.reason === 'החזר מלא');
          const fullRefundsCount = fullRefunds.length;
          const fullRefundsAmount = fullRefunds.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);

          const partialRefunds = refunds.filter(r => r.reason === 'החזר חלקי');
          const partialRefundsCount = partialRefunds.length;
          const partialRefundsAmount = partialRefunds.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);

          // Fetch withdrawals for this user (where they are the recipient)
          const myWithdrawals = refunds.filter(r => 
            r.reason === 'משיכה לאדם' && r.recipient === currentUser.full_name
          );
          
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

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-12" dir="rtl">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex items-center gap-4">
            <div className="bg-indigo-100 p-3 rounded-full">
              <UserCircle className="w-8 h-8 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">
                שלום, {user?.full_name || 'מוכר יקר'}
              </h1>
              <p className="text-slate-500">ברוך הבא למערכת הניהול שלך</p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="bg-indigo-50 px-6 py-3 rounded-xl border border-indigo-100 text-center">
              <span className="block text-indigo-600 text-xs font-bold uppercase tracking-wider">סה"כ הכנסות</span>
              <span className="text-2xl font-black text-indigo-900">€{stats.totalIncome.toLocaleString()}</span>
            </div>
            <div className="bg-emerald-50 px-6 py-3 rounded-xl border border-emerald-100 text-center">
              <span className="block text-emerald-600 text-xs font-bold uppercase tracking-wider">קבוצות</span>
              <span className="text-2xl font-black text-emerald-900">{stats.totalGroups}</span>
            </div>
            <div className="bg-red-50 px-6 py-3 rounded-xl border border-red-100 text-center">
              <span className="block text-red-600 text-xs font-bold uppercase tracking-wider">החזר מלא ({stats.fullRefundsCount})</span>
              <span className="text-2xl font-black text-red-900">€{stats.fullRefundsAmount.toLocaleString()}</span>
            </div>
            <div className="bg-orange-50 px-6 py-3 rounded-xl border border-orange-100 text-center">
              <span className="block text-orange-600 text-xs font-bold uppercase tracking-wider">החזר חלקי ({stats.partialRefundsCount})</span>
              <span className="text-2xl font-black text-orange-900">€{stats.partialRefundsAmount.toLocaleString()}</span>
            </div>
            <div className="bg-blue-50 px-6 py-3 rounded-xl border border-blue-100 text-center">
              <span className="block text-orange-600 text-xs font-bold uppercase tracking-wider">משיכות ({stats.withdrawalsCount})</span>
              <span className="text-2xl font-black text-orange-900">€{stats.withdrawalsAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
            </div>
            <div className="bg-rose-50 px-6 py-3 rounded-xl border border-rose-100 text-center">
              <span className="block text-rose-600 text-xs font-bold uppercase tracking-wider">חוסרים</span>
              <span className="text-2xl font-black text-rose-900">€{stats.shortagesAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
            </div>
          </div>

          <Button 
            variant="ghost" 
            className="text-slate-500 hover:text-red-600 gap-2"
            onClick={async () => await base44.auth.logout()}
          >
            <LogOut className="w-4 h-4" />
            התנתק
          </Button>
        </div>

        {/* Action Cards */}
        <div className="grid md:grid-cols-2 gap-6">
          
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

        </div>

      </div>
    </div>
  );
}