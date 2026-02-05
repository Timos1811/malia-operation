import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, ArrowRight, User, Calendar, Briefcase, Hash, Users, Building2, CreditCard, PartyPopper, ScanLine } from "lucide-react";
import { createPageUrl } from '../utils';

export default function OrderDetails() {
  const [searchParams] = useSearchParams();
  const orderNumber = searchParams.get('orderNumber');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const queryClient = useQueryClient();

  // Fetch wristbands associated with this order
  const { data: wristbands = [], isLoading: loadingWristbands } = useQuery({
    queryKey: ['wristbands', orderNumber],
    queryFn: () => base44.entities.Wristband.filter({ order_number: orderNumber }),
    enabled: !!orderNumber
  });

  // Fetch all available attractions (parties)
  const { data: attractions = [] } = useQuery({
    queryKey: ['attractions'],
    queryFn: () => base44.entities.Attraction.list()
  });

  // Mutation to update wristband allowed events
  const updateWristbandMutation = useMutation({
    mutationFn: ({ id, allowed_events }) => base44.entities.Wristband.update(id, { allowed_events }),
    onSuccess: () => {
      queryClient.invalidateQueries(['wristbands', orderNumber]);
      toast.success("עודכן בהצלחה");
    },
    onError: () => toast.error("שגיאה בעדכון הצמיד")
  });

  const handleEventToggle = (wristband, eventName) => {
    const currentEvents = wristband.allowed_events || [];
    let newEvents;
    
    if (currentEvents.includes(eventName)) {
      newEvents = currentEvents.filter(e => e !== eventName);
    } else {
      newEvents = [...currentEvents, eventName];
    }
    
    updateWristbandMutation.mutate({
      id: wristband.id,
      allowed_events: newEvents
    });
  };

  useEffect(() => {
    async function fetchData() {
      if (!orderNumber) return;
      
      const trimmedOrderNumber = orderNumber.trim();
      
      try {
        setLoading(true);
        // Try filtering first
        let results = await base44.entities.TableData.filter({ order_number: trimmedOrderNumber });
        
        // Fallback: if not found via filter, try listing recent items and searching (in case of indexing delay or format mismatch)
        if (!results || results.length === 0) {
            console.log('Filter failed, trying list fallback for:', trimmedOrderNumber);
            const allItems = await base44.entities.TableData.list('-created_date', 1000);
            const found = allItems.find(item => String(item.order_number).trim() === trimmedOrderNumber);
            if (found) {
                results = [found];
            }
        }

        if (results && results.length > 0) {
          setData(results[0]);
        } else {
          console.log('Order not found:', trimmedOrderNumber);
          setError(`הזמנה ${trimmedOrderNumber} לא נמצאה בנתונים השמורים`);
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
                    <DetailRow icon={Hash} label="מספר הזמנה" value={orderNumber} />
                    <DetailRow icon={Users} label="הרכב" value={data.customer} />
                    <DetailRow icon={User} label="מגדר" value={data.gender} />
                    <DetailRow icon={Calendar} label="תאריך עזיבה" value={data.departure_date} />
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
                    <DetailRow icon={CreditCard} label="סכום מבוקש" value={data.requested_amount} />
                    <DetailRow icon={CreditCard} label="EUR" value={data.eur_amount} />
                    <DetailRow icon={CreditCard} label="שקל" value={data.shekel_amount} />
                    <DetailRow icon={CreditCard} label="דולר" value={data.dollar_amount} />
                    <DetailRow icon={CreditCard} label="ביט" value={data.bit_amount} />
                    <DetailRow icon={CreditCard} label="סטטוס בEUR" value={data.eur_status} />
                </CardContent>
            </Card>

            {/* Wristbands & Parties Section */}
            <Card className="md:col-span-2 shadow-sm border-slate-200">
                <CardHeader className="border-b border-slate-100 bg-white/50">
                    <CardTitle className="flex items-center gap-2 text-xl">
                        <ScanLine className="w-5 h-5 text-purple-600" />
                        ניהול צמידים ומסיבות
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                    {loadingWristbands ? (
                        <div className="flex justify-center p-4"><Loader2 className="animate-spin" /></div>
                    ) : wristbands.length === 0 ? (
                        <div className="text-center text-slate-500 py-8 bg-slate-50 rounded-lg">
                            לא נמצאו צמידים מקושרים להזמנה זו
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b">
                                        <th className="text-right p-4 font-medium text-slate-500">פרטי צמיד</th>
                                        <th className="text-right p-4 font-medium text-slate-500">מסיבות ואירועים</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {wristbands.map(wb => (
                                        <tr key={wb.id} className="hover:bg-slate-50/50">
                                            <td className="p-4 align-top w-1/4">
                                                <div className="font-bold text-slate-800">{wb.customer_name}</div>
                                                <div className="text-xs font-mono text-slate-400 mt-1">{wb.nfc_id?.replace(/:/g, "")}</div>
                                            </td>
                                            <td className="p-4">
                                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                                    {attractions.map(att => {
                                                        const isChecked = (wb.allowed_events || []).includes(att.name);
                                                        const isInactive = wb.status === 'inactive';
                                                        const isExpired = wb.valid_until && new Date().toISOString().split('T')[0] > wb.valid_until;
                                                        const isDisabled = isInactive || isExpired;

                                                        return (
                                                            <div key={att.id} className={`flex items-center space-x-2 space-x-reverse bg-white border p-2 rounded-lg transition-colors ${isDisabled ? 'opacity-50 cursor-not-allowed bg-slate-100' : 'hover:border-indigo-300'}`}>
                                                                <Checkbox 
                                                                    id={`wb-${wb.id}-${att.id}`} 
                                                                    checked={isChecked}
                                                                    onCheckedChange={() => !isDisabled && handleEventToggle(wb, att.name)}
                                                                    disabled={isDisabled}
                                                                />
                                                                <Label 
                                                                    htmlFor={`wb-${wb.id}-${att.id}`}
                                                                    className={`text-sm select-none flex-1 ${isDisabled ? 'cursor-not-allowed text-slate-400' : 'cursor-pointer'}`}
                                                                >
                                                                    {att.name}
                                                                </Label>
                                                            </div>
                                                        );
                                                    })}
                                                    </div>
                                                    {(wb.status === 'inactive' || (wb.valid_until && new Date().toISOString().split('T')[0] > wb.valid_until)) && (
                                                    <div className="mt-2 text-xs text-red-500 font-bold flex items-center gap-1">
                                                        <AlertTriangle className="w-3 h-3" />
                                                        {wb.status === 'inactive' ? 'צמיד לא פעיל' : `פג תוקף (${wb.valid_until})`}
                                                    </div>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>

      </div>
    </div>
  );
}