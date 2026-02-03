import React, { useEffect, useState, useMemo } from 'react';
import { base44 } from "@/api/base44Client";
import { Loader2, Users, Receipt, TrendingUp, TrendingDown, ArrowDownCircle, AlertCircle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default function ManagerDashboard() {
  const [loading, setLoading] = useState(true);
  const [summaryData, setSummaryData] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Increased limit to 1000 to ensure all recent data is fetched
        const [allSales, allExpenses] = await Promise.all([
          base44.entities.TableData.list('-created_date', 1000),
          base44.entities.Expense.list('-expense_date', 1000)
        ]);

        // Get unique users from both sales reps and expense recipients
        const salesReps = new Set(allSales.map(s => s.sales_rep).filter(Boolean));
        const expenseReps = new Set(allExpenses.map(e => e.sales_rep).filter(Boolean));
        const recipients = new Set(allExpenses.filter(e => e.reason === 'משיכה לאדם').map(e => e.recipient).filter(Boolean));
        
        const allUsers = new Set([...salesReps, ...expenseReps, ...recipients]);

        const data = Array.from(allUsers).map(user => {
          // Filter sales for this user
          const userSales = allSales.filter(s => s.sales_rep === user);
          
          // Calculate Income
          const totalIncome = userSales.reduce((sum, sale) => {
            const eur = parseFloat(sale.eur_amount) || 0;
            const nis = parseFloat(sale.shekel_amount) || 0;
            const usd = parseFloat(sale.dollar_amount) || 0;
            const bit = parseFloat(sale.bit_amount) || 0;
            return sum + eur + (nis * 0.26) + (usd * 0.95) + (bit * 0.26);
          }, 0);

          // Calculate Shortages
          const shortage = userSales.reduce((sum, sale) => {
            if (sale.eur_status && sale.eur_status !== 'מאוזן') {
              const val = parseFloat(sale.eur_status);
              if (!isNaN(val) && val < 0) return sum + Math.abs(val);
            }
            return sum;
          }, 0);

          // Filter Expenses by sales_rep for Refunds
          const userExpenses = allExpenses.filter(e => e.sales_rep === user);
          
          const fullRefunds = userExpenses
            .filter(e => e.reason === 'החזר מלא')
            .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

          const partialRefunds = userExpenses
            .filter(e => e.reason === 'החזר חלקי')
            .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

          // Filter Expenses by recipient for Withdrawals
          const withdrawals = allExpenses
            .filter(e => e.reason === 'משיכה לאדם' && e.recipient === user)
            .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

          return {
            name: user,
            totalIncome,
            groups: userSales.length,
            fullRefunds,
            partialRefunds,
            withdrawals,
            shortage
          };
        });

        setSummaryData(data);
      } catch (error) {
        console.error("Failed to fetch manager data", error);
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
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex items-center gap-4 mb-8">
            <div className="bg-slate-900 p-3 rounded-full text-white">
                <Users className="w-6 h-6" />
            </div>
            <h1 className="text-3xl font-bold text-slate-900">דשבורד מנהלים</h1>
        </div>

        <Card className="border-none shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-right">
                    <thead className="bg-slate-100 text-slate-600 font-bold uppercase">
                        <tr>
                            <th className="px-6 py-4">שם נציג</th>
                            <th className="px-6 py-4">קבוצות</th>
                            <th className="px-6 py-4">סה"כ הכנסות</th>
                            <th className="px-6 py-4">החזר מלא</th>
                            <th className="px-6 py-4">החזר חלקי</th>
                            <th className="px-6 py-4">משיכה לאדם</th>
                            <th className="px-6 py-4">חוסר</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {summaryData.map((row, index) => (
                            <tr key={index} className="hover:bg-slate-50 transition-colors">
                                <td className="px-6 py-4 font-medium text-slate-900">{row.name}</td>
                                <td className="px-6 py-4 text-slate-600">{row.groups}</td>
                                <td className="px-6 py-4 text-emerald-600 font-bold">€{row.totalIncome.toLocaleString(undefined, {maximumFractionDigits: 2})}</td>
                                <td className="px-6 py-4 text-red-500">€{row.fullRefunds.toLocaleString(undefined, {maximumFractionDigits: 2})}</td>
                                <td className="px-6 py-4 text-orange-500">€{row.partialRefunds.toLocaleString(undefined, {maximumFractionDigits: 2})}</td>
                                <td className="px-6 py-4 text-blue-500 font-medium">€{row.withdrawals.toLocaleString(undefined, {maximumFractionDigits: 2})}</td>
                                <td className="px-6 py-4 text-rose-600 font-bold">€{row.shortage.toLocaleString(undefined, {maximumFractionDigits: 2})}</td>
                            </tr>
                        ))}
                        {summaryData.length === 0 && (
                            <tr>
                                <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                                    אין נתונים להצגה
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </Card>
      </div>
    </div>
  );
}