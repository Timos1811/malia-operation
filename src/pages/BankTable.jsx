import React, { useMemo } from 'react';
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Landmark, Loader2, ArrowUpCircle, ArrowDownCircle, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function BankTable() {
  const { data: incomeData = [], isLoading: isLoadingIncome } = useQuery({
    queryKey: ['tableDataAll'],
    queryFn: () => base44.entities.TableData.list('-created_date', 1000),
  });

  const { data: expenseData = [], isLoading: isLoadingExpenses } = useQuery({
    queryKey: ['expensesAll'],
    queryFn: () => base44.entities.Expense.list('-expense_date', 1000),
  });

  const summary = useMemo(() => {
    // Initialize totals
    const totals = {
      shekel: { income: 0, expenses: 0 },
      bit: { income: 0, expenses: 0 }, // Expenses in ILS usually go to Shekel, but keeping structure
      usd: { income: 0, expenses: 0 },
      eur: { income: 0, expenses: 0 },
    };

    // Calculate Income
    incomeData.forEach(row => {
      totals.shekel.income += parseFloat(row.shekel_amount) || 0;
      totals.bit.income += parseFloat(row.bit_amount) || 0;
      totals.usd.income += parseFloat(row.dollar_amount) || 0;
      totals.eur.income += parseFloat(row.eur_amount) || 0;
    });

    // Calculate Expenses
    expenseData.forEach(exp => {
      const amount = parseFloat(exp.amount) || 0;
      if (exp.currency === 'ILS') totals.shekel.expenses += amount;
      else if (exp.currency === 'USD') totals.usd.expenses += amount;
      else if (exp.currency === 'EUR') totals.eur.expenses += amount;
    });

    // Calculate Net
    const getNet = (key) => totals[key].income - totals[key].expenses;

    // Conversion rates for total summary in EUR (based on Table logic)
    // 1 NIS = 0.26 EUR, 1 USD = 0.95 EUR
    const toEur = (amount, currency) => {
        if (currency === 'ILS' || currency === 'BIT') return amount * 0.26;
        if (currency === 'USD') return amount * 0.95;
        return amount;
    };

    const totalEurValue = 
        toEur(getNet('shekel'), 'ILS') +
        toEur(getNet('bit'), 'BIT') +
        toEur(getNet('usd'), 'USD') +
        toEur(getNet('eur'), 'EUR');

    return {
      rows: [
        { label: 'יורו', ...totals.eur, currency: '€' },
        { label: 'שקל (מזומן)', ...totals.shekel, currency: '₪' },
        { label: 'ביט', ...totals.bit, currency: '₪' },
        { label: 'דולר', ...totals.usd, currency: '$' },
      ],
      totalEurValue
    };
  }, [incomeData, expenseData]);

  if (isLoadingIncome || isLoadingExpenses) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="p-8 md:p-12 text-right" dir="rtl">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-8 text-slate-800">
          <Landmark className="w-8 h-8" />
          <h1 className="text-3xl font-bold">טבלת בנק</h1>
        </div>

        <div className="grid gap-6">
            <Card className="border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-right">
                        <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-4">מטבע / סוג</th>
                                <th className="px-6 py-4 text-green-700">סה"כ הכנסות</th>
                                <th className="px-6 py-4 text-red-700">סה"כ הוצאות</th>
                                <th className="px-6 py-4 font-bold">יתרה בקופה</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {summary.rows.map((row, index) => {
                                const net = row.income - row.expenses;
                                return (
                                    <tr key={index} className="hover:bg-slate-50/50 transition-colors text-base">
                                        <td className="px-6 py-4 font-medium text-slate-700">{row.label}</td>
                                        <td className="px-6 py-4 text-green-600 font-medium">
                                            {row.income.toLocaleString()} {row.currency}
                                        </td>
                                        <td className="px-6 py-4 text-red-500 font-medium">
                                            {row.expenses.toLocaleString()} {row.currency}
                                        </td>
                                        <td className="px-6 py-4 font-bold" dir="ltr">
                                            <span className={net >= 0 ? 'text-slate-800' : 'text-red-600'}>
                                                {net.toLocaleString()} {row.currency}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                            
                            {/* Summary Row */}
                            <tr className="bg-slate-900 text-white font-bold text-lg">
                                <td className="px-6 py-6">שווי כולל מוערך (EUR)</td>
                                <td className="px-6 py-6" colSpan="3" dir="ltr">
                                    <div className="flex items-center justify-end gap-2">
                                        <span>€ {summary.totalEurValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                                        <Wallet className="w-5 h-5 text-slate-400" />
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </Card>

            <div className="grid md:grid-cols-2 gap-4 text-sm text-slate-500 bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                <div className="flex items-center gap-2">
                    <ArrowUpCircle className="w-4 h-4 text-green-600" />
                    <span>הכנסות: מחושבות מתוך טבלאות הנתונים (מזומן, ביט, דולר, יורו)</span>
                </div>
                <div className="flex items-center gap-2">
                    <ArrowDownCircle className="w-4 h-4 text-red-500" />
                    <span>הוצאות: מסוכמות מתוך יומן ההוצאות לפי סוג המטבע</span>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}