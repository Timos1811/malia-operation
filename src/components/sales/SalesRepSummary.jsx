import React, { useEffect, useState } from 'react';
import { base44 } from "@/api/base44Client";
import { UserCircle, Loader2 } from 'lucide-react';

export default function SalesRepSummary({ salesRepName }) {
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
      if (!salesRepName) {
        setLoading(false);
        return;
      }
      try {
        // Fetch sales for this user
        const sales = await base44.entities.TableData.filter({ 
          sales_rep: salesRepName 
        }, '-created_date', 1000);
        
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
          sales_rep: salesRepName
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
           recipient: salesRepName
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
      } catch (error) {
        console.error("Failed to fetch data for sales rep", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [salesRepName]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row justify-between items-center gap-6 bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-slate-100">
      <div className="flex items-center gap-4 w-full md:w-auto">
        <div className="bg-indigo-100 p-3 rounded-full shrink-0">
          <UserCircle className="w-8 h-8 text-indigo-600" />
        </div>
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-800">
            שלום, {salesRepName || 'נציג'}
          </h1>
          <p className="text-sm md:text-base text-slate-500">הנתונים האישיים שלך</p>
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
    </div>
  );
}