import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowRight, User, Calendar, Briefcase, Hash, Users, Building2, CreditCard } from "lucide-react";
import { createPageUrl } from '../utils';

export default function OrderDetails() {
  const [searchParams] = useSearchParams();
  const orderNumber = searchParams.get('orderNumber');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchData() {
      if (!orderNumber) return;
      
      try {
        setLoading(true);
        // Try to fetch from backend function first (Google Sheets)
        const response = await base44.functions.invoke('fetchOrderData', { orderNumber });
        if (response.data) {
          setData(response.data);
        } else {
            // If not found in sheets, maybe check local DB if needed, but fetchOrderData seems to be the source of truth
            setError('ההזמנה לא נמצאה');
        }
      } catch (err) {
        console.error(err);
        setError('שגיאה בטעינת הנתונים');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [orderNumber]);

  if (!orderNumber) {
    return (
        <div className="p-8 text-center text-slate-500" dir="rtl">
            <h2 className="text-xl font-bold mb-4">לא צוין מספר הזמנה</h2>
            <Link to={createPageUrl('SavedData')}>
                <Button>חזרה לטבלה</Button>
            </Link>
        </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50" dir="rtl">
        <div className="text-center space-y-4">
            <Loader2 className="w-8 h-8 animate-spin text-slate-900 mx-auto" />
            <p className="text-slate-500">טוען פרטי הזמנה...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50" dir="rtl">
        <Card className="w-full max-w-md text-center p-6">
            <div className="mb-4 flex justify-center">
                <div className="bg-red-100 p-3 rounded-full">
                    <Hash className="w-6 h-6 text-red-600" />
                </div>
            </div>
            <h2 className="text-xl font-bold text-slate-800 mb-2">שגיאה</h2>
            <p className="text-slate-500 mb-6">{error || 'לא נמצאו נתונים להזמנה זו'}</p>
            <Link to={createPageUrl('SavedData')}>
                <Button variant="outline" className="gap-2">
                    <ArrowRight className="w-4 h-4" />
                    חזרה לטבלה
                </Button>
            </Link>
        </Card>
      </div>
    );
  }

  // Helper to render a detail row
  const DetailRow = ({ icon: Icon, label, value }) => (
    <div className="flex items-start gap-4 p-4 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors">
        <div className="bg-white p-2 rounded-md shadow-sm text-slate-700">
            <Icon className="w-5 h-5" />
        </div>
        <div>
            <div className="text-sm font-medium text-slate-500 mb-1">{label}</div>
            <div className="font-semibold text-slate-900 text-lg">{value || '-'}</div>
        </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50/50 p-6 md:p-12" dir="rtl">
      <div className="max-w-3xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
                <Link to={createPageUrl('SavedData')}>
                    <Button variant="ghost" size="icon" className="hover:bg-slate-200">
                        <ArrowRight className="w-5 h-5 text-slate-600" />
                    </Button>
                </Link>
                <h1 className="text-3xl font-bold text-slate-900">הזמנה {orderNumber}</h1>
            </div>
            <div className="text-sm text-slate-500">
                עודכן לאחרונה: {new Date().toLocaleDateString('he-IL')}
            </div>
        </div>

        {/* Main Content */}
        <div className="grid gap-6 md:grid-cols-2">
            <Card className="md:col-span-2 shadow-sm border-slate-200">
                <CardHeader className="border-b border-slate-100 bg-white/50">
                    <CardTitle className="flex items-center gap-2 text-xl">
                        <User className="w-5 h-5 text-indigo-600" />
                        פרטי לקוח
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-6 grid gap-4 md:grid-cols-2">
                    <DetailRow icon={User} label="שם הלקוח" value={data.customer} />
                    <DetailRow icon={Hash} label="מספר הזמנה" value={orderNumber} />
                    <DetailRow icon={Users} label="הרכב" value={data.gender} />
                    <DetailRow icon={Calendar} label="תאריך יציאה" value={data.departureDate} />
                    <DetailRow icon={Calendar} label="לילות" value={data.nights} />
                    <DetailRow icon={Building2} label="מלון" value={data.hotel} />
                    <DetailRow icon={Briefcase} label="חברה" value={data.company} />
                </CardContent>
            </Card>

            <Card className="md:col-span-2 shadow-sm border-slate-200">
                <CardHeader className="border-b border-slate-100 bg-white/50">
                    <CardTitle className="flex items-center gap-2 text-xl">
                        <CreditCard className="w-5 h-5 text-green-600" />
                        פרטי תשלום
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-6 grid gap-4 md:grid-cols-3">
                    <DetailRow icon={CreditCard} label="סכום מבוקש" value={data.requestedAmount} />
                    {/* Add more fields if available in the fetched data object */}
                </CardContent>
            </Card>
        </div>

      </div>
    </div>
  );
}