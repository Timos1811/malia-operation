import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Landmark, Loader2, ArrowUpCircle, ArrowDownCircle, Wallet, PieChart as PieChartIcon, Users, ShoppingBag, TrendingUp, UserCheck, Plus, Trash2, Coins, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1', '#14b8a6', '#f97316', '#84cc16'];

export default function BankTable() {
  const queryClient = useQueryClient();
  const [newLocation, setNewLocation] = useState({ name: '', amount: '', currency: 'EUR' });
  const [isExporting, setIsExporting] = useState(false);
  
  const [isBitModalOpen, setIsBitModalOpen] = useState(false);
  const [bitCompany, setBitCompany] = useState('');
  const [isProcessingBits, setIsProcessingBits] = useState(false);
  const [bitSummary, setBitSummary] = useState(null);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!bitCompany) {
      toast.error('נא לבחור חברה קודם');
      return;
    }

    setIsProcessingBits(true);
    setBitSummary(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target.result;
        // Simple CSV parser supporting quotes
        let p = '', row = [''], ret = [row], i = 0, r = 0, s = !0;
        for (let l of text) {
            if ('"' === l) {
                if (s && l === p) row[i] += l;
                s = !s;
            } else if (',' === l && s) l = row[++i] = '';
            else if ('\n' === l && s) {
                if ('\r' === p) row[i] = row[i].slice(0, -1);
                row = ret[++r] = [l = '']; i = 0;
            } else row[i] += l;
            p = l;
        }

        const headers = ret[0].map(h => h?.trim()?.replace(/^"|"$/g, ''));
        const descIndex = headers.findIndex(h => h && h.includes('תיאור עסקה'));
        const paidIndex = headers.findIndex(h => h && h.includes('שולם'));

        if (descIndex === -1 || paidIndex === -1) {
            toast.error('לא נמצאו עמודות "תיאור עסקה" או "שולם" בקובץ. וודא שהוא בפורמט CSV (UTF-8).');
            setIsProcessingBits(false);
            return;
        }

        const orderSums = {};
        for (let j = 1; j < ret.length; j++) {
            const rowData = ret[j];
            if (rowData.length <= Math.max(descIndex, paidIndex)) continue;

            const desc = rowData[descIndex] || '';
            const paidStr = rowData[paidIndex] || '0';
            
            // Extract numbers from description - usually 4 to 10 digits
            const match = desc.match(/\d{4,10}/);
            if (!match) continue;
            
            const orderNum = match[0];
            const amount = parseFloat(paidStr.replace(/[^\d.-]/g, '')) || 0;

            if (!orderSums[orderNum]) orderSums[orderNum] = 0;
            orderSums[orderNum] += amount;
        }

        // Fetch PendingSales
        const pendingSales = await base44.entities.PendingSale.filter({ company: bitCompany });
        
        let updatedCount = 0;
        let missingOrders = [];
        const updatePromises = [];

        for (const [orderNum, sumAmount] of Object.entries(orderSums)) {
            const sale = pendingSales.find(s => s.order_number === orderNum);
            if (sale) {
                updatePromises.push(base44.entities.PendingSale.update(sale.id, { bit_amount: sumAmount.toString() }));
                updatedCount++;
            } else {
                missingOrders.push(orderNum);
            }
        }

        await Promise.all(updatePromises);
        
        const companyName = bitCompany === 'ק' ? 'קשרי תעופה' : 'נטו פאן';
        setBitSummary({
            companyName,
            updatedCount,
            missingOrders
        });
        
        toast.success('הסנכרון הושלם בהצלחה');
      } catch (error) {
        console.error(error);
        toast.error('שגיאה בעיבוד הקובץ');
      } finally {
        setIsProcessingBits(false);
        e.target.value = null;
      }
    };
    reader.readAsText(file);
  };

  const handleExport = async () => {
    try {
        setIsExporting(true);
        toast.info("מתחיל בייצוא נתונים לדרייב...");
        await base44.functions.invoke('exportDataToDrive');
        toast.success("הנתונים יוצאו בהצלחה לתיקיית אקסל בדרייב!");
    } catch (error) {
        console.error(error);
        toast.error("שגיאה בייצוא הנתונים");
    } finally {
        setIsExporting(false);
    }
  };

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

  const { data: moneyLocations = [] } = useQuery({
    queryKey: ['moneyLocations'],
    queryFn: () => base44.entities.MoneyLocation.list(),
  });

  const addLocationMutation = useMutation({
    mutationFn: (data) => base44.entities.MoneyLocation.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['moneyLocations']);
      setNewLocation({ name: '', amount: '', currency: 'EUR' });
    },
  });

  const deleteLocationMutation = useMutation({
    mutationFn: (id) => base44.entities.MoneyLocation.delete(id),
    onSuccess: () => queryClient.invalidateQueries(['moneyLocations']),
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
    const salesRepStats = {};
    let totalCustomers = 0;

    // Calculate Income
    incomeData.forEach(row => {
      const shekel = parseFloat(row.shekel_amount) || 0;
      const bit = parseFloat(row.bit_amount) || 0;
      const usd = parseFloat(row.dollar_amount) || 0;
      const eur = parseFloat(row.eur_amount) || 0;

      totals.shekel.income += shekel;
      totals.bit.income += bit;
      totals.usd.income += usd;
      totals.eur.income += eur;
      
      if (row.company === 'נטו פאן') totals.bitNeto += bit;
      else totals.bitKishrei += bit;

      // Count customers (parsing string to int, or extracting first number found)
      const customerStr = String(row.customer || '');
      const numberMatch = customerStr.match(/\d+/);
      const customerCount = numberMatch ? parseInt(numberMatch[0]) : 0;
      totalCustomers += customerCount;

      // Sales Rep Stats (Normalized to EUR)
      const repName = row.sales_rep || 'ללא נציג';
      const totalValueInEur = eur + (shekel * 0.26) + (bit * 0.26) + (usd * 0.95);
      salesRepStats[repName] = (salesRepStats[repName] || 0) + totalValueInEur;
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

    const salesByRep = Object.entries(salesRepStats)
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

    // Global Stats
    const totalIncomeEurCombined = totals.eur.income + (totals.shekel.income * 0.26) + (totals.bit.income * 0.26) + (totals.usd.income * 0.95);
    const avgRevenuePerCustomer = totalCustomers > 0 ? totalIncomeEurCombined / totalCustomers : 0;

    // Money Locations Data Preparation
    const locationsData = moneyLocations.map(loc => {
        let valueInEur = parseFloat(loc.amount);
        if (loc.currency === 'ILS') valueInEur *= 0.26;
        if (loc.currency === 'USD') valueInEur *= 0.95;
        return {
            name: loc.name,
            originalAmount: loc.amount,
            currency: loc.currency,
            value: valueInEur // For chart
        };
    }).filter(l => l.value > 0);

    return {
      locationsData,
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
      expensesByCategory,
      salesByRep,
      generalStats: {
          totalCustomers,
          totalGroups: incomeData.length,
          avgRevenuePerCustomer
      }
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
        <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3 text-slate-800">
              <Landmark className="w-8 h-8" />
              <h1 className="text-3xl font-bold">טבלת בנק</h1>
            </div>
            <div className="flex items-center gap-2">
                <Dialog open={isBitModalOpen} onOpenChange={setIsBitModalOpen}>
                    <DialogTrigger asChild>
                        <Button 
                            className="gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                        >
                            <Wallet className="w-4 h-4" />
                            טעינת ביטים
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md" dir="rtl">
                        <DialogHeader>
                            <DialogTitle>טעינת תשלומי משולם (ביט)</DialogTitle>
                            <DialogDescription>
                                העלה קובץ CSV של עסקאות 'משולם' כדי לחלץ ולהשלים תשלומי ביט לפי מספר הזמנה.
                            </DialogDescription>
                        </DialogHeader>
                        
                        {!bitSummary ? (
                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">בחר חברה:</label>
                                    <Select value={bitCompany} onValueChange={setBitCompany}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="בחר חברה" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="נ">נטו פאן</SelectItem>
                                            <SelectItem value="ק">קשרי תעופה</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">העלאת קובץ CSV:</label>
                                    <Input 
                                        type="file" 
                                        accept=".csv"
                                        disabled={!bitCompany || isProcessingBits}
                                        onChange={handleFileUpload}
                                        className="cursor-pointer"
                                    />
                                    <p className="text-xs text-slate-500">וודא שהקובץ בפורמט CSV סטנדרטי (UTF-8)</p>
                                </div>

                                {isProcessingBits && (
                                    <div className="flex items-center gap-2 text-blue-600 justify-center mt-4">
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        <span>סורק ומעדכן נתונים...</span>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-4 py-4">
                                <div className="p-4 bg-green-50 text-green-800 rounded-lg border border-green-200">
                                    <h4 className="font-bold mb-2">הסנכרון הושלם עבור {bitSummary.companyName}</h4>
                                    <p>עודכנו {bitSummary.updatedCount} הזמנות בהצלחה.</p>
                                </div>
                                
                                {bitSummary.missingOrders.length > 0 && (
                                    <div className="p-4 bg-amber-50 text-amber-800 rounded-lg border border-amber-200">
                                        <h4 className="font-bold mb-2">רשימת מספרי הזמנה שלא נמצאו במערכת:</h4>
                                        <div className="max-h-32 overflow-y-auto text-sm text-left font-mono break-words" dir="ltr">
                                            [{bitSummary.missingOrders.join(', ')}]
                                        </div>
                                    </div>
                                )}
                                
                                <Button 
                                    onClick={() => {
                                        setBitSummary(null);
                                        setIsBitModalOpen(false);
                                    }} 
                                    className="w-full mt-4"
                                >
                                    סגור
                                </Button>
                            </div>
                        )}
                    </DialogContent>
                </Dialog>

                <Button 
                    onClick={handleExport}
                    disabled={isExporting}
                    className="gap-2 bg-green-600 hover:bg-green-700 text-white shadow-sm"
                >
                    {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
                    ייצוא לדרייב
                </Button>
            </div>
        </div>

        <div className="grid gap-6">
            
            {/* General Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="border-slate-200 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">סה"כ לקוחות</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{summary.generalStats.totalCustomers}</div>
                        <p className="text-xs text-muted-foreground">לקוחות בכל הקבוצות</p>
                    </CardContent>
                </Card>
                <Card className="border-slate-200 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">סה"כ קבוצות/מכירות</CardTitle>
                        <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{summary.generalStats.totalGroups}</div>
                        <p className="text-xs text-muted-foreground">הזמנות במערכת</p>
                    </CardContent>
                </Card>
                <Card className="border-slate-200 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">ממוצע ללקוח</CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">€{summary.generalStats.avgRevenuePerCustomer.toLocaleString(undefined, {maximumFractionDigits: 0})}</div>
                        <p className="text-xs text-muted-foreground">הכנסה ממוצעת (משוערך ליורו)</p>
                    </CardContent>
                </Card>
            </div>

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

            <div className="grid md:grid-cols-2 gap-6">
                {/* Sales By Rep Pie Chart */}
                <Card className="border-slate-200 shadow-sm">
                    <CardHeader className="border-b border-slate-100 bg-slate-50/50">
                        <CardTitle className="flex items-center gap-2 text-xl text-slate-800">
                            <UserCheck className="w-5 h-5 text-green-600" />
                            מכירות לפי נציג (במונחי יורו)
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6">
                        <div className="h-[300px] w-full" dir="ltr">
                            {summary.salesByRep.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={summary.salesByRep}
                                            cx="50%"
                                            cy="50%"
                                            labelLine={false}
                                            label={({ cx, cy, midAngle, innerRadius, outerRadius, percent, index }) => {
                                                const RADIAN = Math.PI / 180;
                                                const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                                                const x = cx + radius * Math.cos(-midAngle * RADIAN);
                                                const y = cy + radius * Math.sin(-midAngle * RADIAN);
                                                return percent > 0.1 ? (
                                                    <text x={x} y={y} fill="white" fontSize={12} textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central">
                                                        {`${(percent * 100).toFixed(0)}%`}
                                                    </text>
                                                ) : null;
                                            }}
                                            outerRadius={100}
                                            fill="#8884d8"
                                            dataKey="value"
                                        >
                                            {summary.salesByRep.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip 
                                            formatter={(value) => `€${value.toLocaleString(undefined, {maximumFractionDigits: 0})}`}
                                        />
                                        <Legend layout="vertical" align="right" verticalAlign="middle" wrapperStyle={{fontSize: '12px'}} />
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

                {/* Expenses Pie Chart */}
                <Card className="border-slate-200 shadow-sm">
                    <CardHeader className="border-b border-slate-100 bg-slate-50/50">
                        <CardTitle className="flex items-center gap-2 text-xl text-slate-800">
                            <PieChartIcon className="w-5 h-5 text-indigo-600" />
                            התפלגות הוצאות (במונחי יורו)
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6">
                        <div className="h-[300px] w-full" dir="ltr">
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
                                                    <text x={x} y={y} fill="white" fontSize={12} textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central">
                                                        {`${(percent * 100).toFixed(0)}%`}
                                                    </text>
                                                ) : null;
                                            }}
                                            outerRadius={100}
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
                                        <Legend layout="vertical" align="right" verticalAlign="middle" wrapperStyle={{fontSize: '12px'}} />
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

                {/* Money Locations Chart & Input */}
                <Card className="border-slate-200 shadow-sm col-span-1 md:col-span-2">
                    <CardHeader className="border-b border-slate-100 bg-slate-50/50">
                        <CardTitle className="flex items-center gap-2 text-xl text-slate-800">
                            <Coins className="w-5 h-5 text-amber-500" />
                            מיקום הכסף הפיזי (כספת, מנהל יעד, קופה קטנה)
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6">
                        <div className="grid md:grid-cols-2 gap-8">
                            {/* Chart */}
                            <div className="h-[300px] w-full" dir="ltr">
                                {summary.locationsData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={summary.locationsData}
                                                cx="50%"
                                                cy="50%"
                                                labelLine={false}
                                                label={({ cx, cy, midAngle, innerRadius, outerRadius, percent, index }) => {
                                                    const RADIAN = Math.PI / 180;
                                                    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                                                    const x = cx + radius * Math.cos(-midAngle * RADIAN);
                                                    const y = cy + radius * Math.sin(-midAngle * RADIAN);
                                                    return percent > 0.05 ? (
                                                        <text x={x} y={y} fill="white" fontSize={12} textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central">
                                                            {`${(percent * 100).toFixed(0)}%`}
                                                        </text>
                                                    ) : null;
                                                }}
                                                outerRadius={100}
                                                fill="#8884d8"
                                                dataKey="value"
                                            >
                                                {summary.locationsData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip 
                                                formatter={(value, name, props) => {
                                                    const item = props.payload;
                                                    return [`${item.originalAmount} ${item.currency}`, item.name];
                                                }}
                                            />
                                            <Legend layout="vertical" align="right" verticalAlign="middle" wrapperStyle={{fontSize: '12px'}} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="h-full flex items-center justify-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                                        אין נתונים להצגה - הוסף מיקומים בטופס
                                    </div>
                                )}
                            </div>

                            {/* Input Form & List */}
                            <div className="space-y-6">
                                <div className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                                    <h3 className="font-semibold text-slate-700">הוסף מיקום חדש</h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <Input 
                                            placeholder="שם המיקום (לדוג' כספת)" 
                                            value={newLocation.name}
                                            onChange={e => setNewLocation({...newLocation, name: e.target.value})}
                                            className="bg-white"
                                        />
                                        <div className="flex gap-2">
                                            <Input 
                                                type="number" 
                                                placeholder="סכום" 
                                                value={newLocation.amount}
                                                onChange={e => setNewLocation({...newLocation, amount: e.target.value})}
                                                className="bg-white"
                                            />
                                            <Select 
                                                value={newLocation.currency} 
                                                onValueChange={val => setNewLocation({...newLocation, currency: val})}
                                            >
                                                <SelectTrigger className="w-[100px] bg-white">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="EUR">€ EUR</SelectItem>
                                                    <SelectItem value="ILS">₪ ILS</SelectItem>
                                                    <SelectItem value="USD">$ USD</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    <Button 
                                        className="w-full bg-slate-800 hover:bg-slate-700 gap-2"
                                        disabled={!newLocation.name || !newLocation.amount || addLocationMutation.isPending}
                                        onClick={() => addLocationMutation.mutate({
                                            name: newLocation.name,
                                            amount: parseFloat(newLocation.amount),
                                            currency: newLocation.currency
                                        })}
                                    >
                                        {addLocationMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                                        הוסף מיקום
                                    </Button>
                                </div>

                                <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2">
                                    {moneyLocations.length === 0 && (
                                        <p className="text-center text-sm text-slate-400 py-4">לא הוזנו מיקומים עדיין</p>
                                    )}
                                    {moneyLocations.map(loc => (
                                        <div key={loc.id} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-lg shadow-sm group">
                                            <div className="flex flex-col">
                                                <span className="font-medium text-slate-800">{loc.name}</span>
                                                <span className="text-sm text-slate-500">{loc.amount} {loc.currency}</span>
                                            </div>
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                                onClick={() => deleteLocationMutation.mutate(loc.id)}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
      </div>
    </div>
  );
}