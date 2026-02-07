import React, { useMemo } from 'react';
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Landmark, Loader2, ArrowUpCircle, ArrowDownCircle, Wallet, PieChart as PieChartIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1', '#14b8a6', '#f97316', '#84cc16'];

export default function BankTable() {
  const { data: incomeData = [], isLoading: isLoadingIncome } = useQuery({
    queryKey: ['tableDataAll'],
    queryFn: () => base44.entities.TableData.list('-created_date', 1000),
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });

  const { data: expenseData = [], isLoading: isLoadingExpenses } = useQuery({
    queryKey: ['expensesAll'],
    queryFn: () => base44.entities.Expense.list('-expense_date', 1000),
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });

  const summary = useMemo(() => {
    // Initialize totals
    const totals = {
      shekel: { income: 0, expenses: 0 },
      bit: { income: 0, expenses: 0 }, 
      usd: { income: 0, expenses: 0 },
      eur: { income: 0, expenses: 0 },
      bitKishrei: 0,
      bitNeto: 0
    };

    const categoryStats = {};

    // Calculate Income
    incomeData.forEach(row => {
      totals.shekel.income += parseFloat(row.shekel_amount) || 0;
      totals.bit.income += parseFloat(row.bit_amount) || 0;
      totals.usd.income += parseFloat(row.dollar_amount) || 0;
      totals.eur.income += parseFloat(row.eur_amount) || 0;
      
      const bitAmount = parseFloat(row.bit_amount) || 0;
      if (row.company === 'נטו פאן') totals.bitNeto += bitAmount;
      else totals.bitKishrei += bitAmount;
    });

    // Calculate Expenses
    expenseData.forEach(exp => {
      const amount = parseFloat(exp.amount) || 0;
      if (exp.currency === 'ILS') totals.shekel.expenses += amount;
      else if (exp.currency === 'USD') totals.usd.expenses += amount;
      else if (exp.currency === 'EUR') totals.eur.expenses += amount;

      // Category breakdown (Normalized to EUR for visualization)
      let amountInEur = amount;
      if (exp.currency === 'ILS') amountInEur = amount * 0.26; // Approx rate
      else if (exp.currency === 'USD') amountInEur = amount * 0.95; // Approx rate
      
      if (exp.reason) {
        categoryStats[exp.reason] = (categoryStats[exp.reason] || 0) + amountInEur;
      }
    });

    const expensesByCategory = Object.entries(categoryStats)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .filter(item => item.value > 0);

    // Calculate Net
    const getNet = (key) => totals[key].income - totals[key].expenses;

    // Conversion rates for total summary in EUR (based on Table logic)
    // 1 NIS = 0.26 EUR, 1 USD = 0.95 EUR
    const toEur = (amount, currency) => {
        if (currency === 'ILS' || currency === 'BIT') return amount * 0.26;
        if (currency === 'USD') return amount * 0.95;
        return amount;
    };

    const destinationBalances = {
        eur: getNet('eur'),
        shekel: getNet('shekel'),
        usd: getNet('usd')
    };

    return {
      rows: [
        { label: 'יורו', ...totals.eur, currency: '€' },
        { label: 'שקל (מזומן)', ...totals.shekel, currency: '₪' },
        { label: 'דולר', ...totals.usd, currency: '$' },
      ],
      bitTotals: {
          kishrei: totals.bitKishrei,
          neto: totals.bitNeto,
          total: totals.bit.income
      },
      destinationBalances,
      expensesByCategory
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
                    <table className="w-full text-sm text-center">
                        <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-4 text-right">תיאור</th>
                                {summary.rows.map((row, index) => (
                                    <th key={index} className="px-6 py-4">{row.label}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            <tr className="hover:bg-slate-50/50 transition-colors text-base">
                                <td className="px-6 py-4 font-medium text-slate-700 text-right">סה"כ הכנסות</td>
                                {summary.rows.map((row, index) => (
                                    <td key={index} className="px-6 py-4 text-green-600 font-medium">
                                        {row.income.toLocaleString()} {row.currency}
                                    </td>
                                ))}
                            </tr>
                            <tr className="hover:bg-slate-50/50 transition-colors text-base">
                                <td className="px-6 py-4 font-medium text-slate-700 text-right">סה"כ הוצאות</td>
                                {summary.rows.map((row, index) => (
                                    <td key={index} className="px-6 py-4 text-red-500 font-medium">
                                        {row.expenses.toLocaleString()} {row.currency}
                                    </td>
                                ))}
                            </tr>
                            <tr className="bg-slate-50/80 font-bold text-lg border-t-2 border-slate-200">
                                <td className="px-6 py-6 text-slate-800 text-right">יתרה בקופה (ביעד)</td>
                                {summary.rows.map((row, index) => {
                                    const net = row.income - row.expenses;
                                    return (
                                        <td key={index} className="px-6 py-6">
                                            <span className={net >= 0 ? 'text-slate-800' : 'text-red-600'}>
                                                {net.toLocaleString()} {row.currency}
                                            </span>
                                        </td>
                                    );
                                })}
                            </tr>
                            <tr className="bg-blue-50/50 border-t-2 border-slate-200">
                                <td className="px-6 py-6 text-slate-800 font-bold text-right align-middle">
                                    סיכום ביט
                                    <div className="text-xs font-normal text-slate-500 mt-1">סה"כ: ₪{summary.bitTotals.total.toLocaleString()}</div>
                                </td>
                                <td colSpan={summary.rows.length} className="px-6 py-4">
                                    <div className="flex justify-around items-center">
                                        <div className="flex flex-col items-center">
                                            <span className="text-sm text-slate-500 mb-1">קשרי תעופה</span>
                                            <span className="text-lg font-bold text-slate-800">₪{summary.bitTotals.kishrei.toLocaleString()}</span>
                                        </div>
                                        <div className="h-8 w-px bg-slate-300"></div>
                                        <div className="flex flex-col items-center">
                                            <span className="text-sm text-slate-500 mb-1">נטו פאן</span>
                                            <span className="text-lg font-bold text-slate-800">₪{summary.bitTotals.neto.toLocaleString()}</span>
                                        </div>
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

            {/* Expenses Pie Chart */}
            <Card className="border-slate-200 shadow-sm">
                <CardHeader className="border-b border-slate-100 bg-slate-50/50">
                    <CardTitle className="flex items-center gap-2 text-xl text-slate-800">
                        <PieChartIcon className="w-5 h-5 text-indigo-600" />
                        התפלגות הוצאות לפי קטגוריה (במונחי יורו)
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                    <div className="h-[400px] w-full" dir="ltr">
                        {summary.expensesByCategory.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={summary.expensesByCategory}
                                        cx="50%"
                                        cy="50%"
                                        labelLine={false}
                                        label={({ cx, cy, midAngle, innerRadius, outerRadius, percent, index }) => {
                                            const RADIAN = Math.PI / 180;
                                            const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                                            const x = cx + radius * Math.cos(-midAngle * RADIAN);
                                            const y = cy + radius * Math.sin(-midAngle * RADIAN);
                                            return percent > 0.05 ? (
                                                <text x={x} y={y} fill="white" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central">
                                                    {`${(percent * 100).toFixed(0)}%`}
                                                </text>
                                            ) : null;
                                        }}
                                        outerRadius={150}
                                        fill="#8884d8"
                                        dataKey="value"
                                    >
                                        {summary.expensesByCategory.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip 
                                        formatter={(value) => `€${value.toLocaleString(undefined, {minimumFractionDigits: 2})}`}
                                    />
                                    <Legend layout="vertical" align="right" verticalAlign="middle" />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-slate-400">
                                אין נתונים להצגה
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
      </div>
    </div>
  );
}