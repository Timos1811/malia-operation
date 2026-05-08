import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, ArrowRight, User, Calendar, Briefcase, Hash, Users, Building2, CreditCard, PartyPopper, ScanLine, Search, CheckCircle2, AlertTriangle, History, Receipt, CheckSquare, RefreshCcw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { createPageUrl } from '../utils';
import { getNextEventDate } from "@/utils/dateHelpers";

export default function OrderDetails() {
  const [searchParams] = useSearchParams();
  const orderNumber = searchParams.get('orderNumber');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [wristbandFilter, setWristbandFilter] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(user => {
      setIsAdmin(user?.role === 'admin');
    }).catch(console.error);
  }, []);

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

  // Fetch scan logs for this order to show status
  const { data: scanLogs = [] } = useQuery({
    queryKey: ['scanLogs', orderNumber],
    queryFn: () => base44.entities.WristbandScanLog.filter({ order_number: orderNumber }),
    enabled: !!orderNumber
  });

  // Fetch tasks related to this order (refunds, add events, etc.)
  const { data: orderTasks = [], isLoading: loadingTasks } = useQuery({
    queryKey: ['orderTasks', orderNumber],
    queryFn: () => base44.entities.Task.filter({ order_number: orderNumber }),
    enabled: !!orderNumber
  });

  // Fetch expenses related to this order (where recipient is usually the order number for refunds)
  const { data: orderExpenses = [] } = useQuery({
    queryKey: ['orderExpenses', orderNumber],
    queryFn: () => base44.entities.Expense.filter({ recipient: orderNumber }),
    enabled: !!orderNumber
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

  const handleEventToggle = (wristband, attraction) => {
    const currentEvents = wristband.allowed_events || [];
    let newEvents;
    
    const existingEvent = currentEvents.find(e => e === attraction.name || e.startsWith(attraction.name + ' - '));
    
    if (existingEvent) {
      newEvents = currentEvents.filter(e => e !== existingEvent);
    } else {
      const nextDateStr = getNextEventDate(attraction.event_days, attraction.start_time);
      const eventNameToAdd = nextDateStr 
          ? `${attraction.name} - ${nextDateStr.split('-').reverse().join('/')}` 
          : attraction.name;
      newEvents = [...currentEvents, eventNameToAdd];
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

        // If STILL not found, it might be in PendingSale
        if (!results || results.length === 0) {
            console.log('Not in TableData, checking PendingSale for:', trimmedOrderNumber);
            let pendingResults = await base44.entities.PendingSale.filter({ order_number: trimmedOrderNumber });
            if (!pendingResults || pendingResults.length === 0) {
                const allPending = await base44.entities.PendingSale.list('-created_date', 1000);
                const foundPending = allPending.find(item => String(item.order_number).trim() === trimmedOrderNumber);
                if (foundPending) {
                    pendingResults = [foundPending];
                }
            }
            if (pendingResults && pendingResults.length > 0) {
                results = pendingResults;
            }
        }

        if (results && results.length > 0) {
          setData(results[0]);
        } else {
          console.log('Order not found:', trimmedOrderNumber);
          setError(`הזמנה מספר ${trimmedOrderNumber} לא נמצאה במערכת. אנא וודא שהמספר תקין ונסה שוב.`);
        }
      } catch (err) {
        console.error(err);
        const errorMsg = err.message || err.toString();
        setError(`שגיאה בטעינת הנתונים: ${errorMsg}. אנא בדוק את החיבור לאינטרנט ונסה שנית.`);
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
                <div className="flex items-center gap-3">
                    <h1 className="text-3xl font-bold text-slate-900">הזמנה {orderNumber}</h1>
                    {data?.is_combo && (
                        <Badge className="bg-yellow-400 text-yellow-900 hover:bg-yellow-500 px-3 text-sm">
                            COMBO DEAL
                        </Badge>
                    )}
                </div>
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
                    {/* Wristband Search */}
                    <div className="mb-6 max-w-sm">
                        <div className="relative">
                            <Search className="absolute right-3 top-2.5 w-4 h-4 text-slate-400" />
                            <Input 
                                value={wristbandFilter}
                                onChange={(e) => setWristbandFilter(e.target.value)}
                                placeholder="חפש לפי שם אורח או מספר צמיד..."
                                className="pr-9"
                            />
                        </div>
                    </div>

                    {loadingWristbands ? (
                        <div className="flex justify-center p-4"><Loader2 className="animate-spin" /></div>
                    ) : wristbands.length === 0 ? (
                        <div className="text-center text-slate-500 py-8 bg-slate-50 rounded-lg">
                            לא נמצאו צמידים מקושרים להזמנה זו
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {/* Desktop Headers */}
                            <div className="hidden md:grid md:grid-cols-4 gap-4 px-4 py-2 border-b text-slate-500 font-medium">
                                <div className="col-span-1">פרטי צמיד</div>
                                <div className="col-span-3">מסיבות ואירועים</div>
                            </div>

                            {/* Wristband List */}
                            {wristbands
                                .filter(wb => wb.status !== 'inactive')
                                .filter(wb => {
                                    if (!wristbandFilter) return true;
                                    const search = wristbandFilter.toLowerCase();
                                    return (
                                        wb.customer_name?.toLowerCase().includes(search) || 
                                        wb.nfc_id?.toLowerCase().includes(search)
                                    );
                                })
                                .map(wb => (
                                <div key={wb.id} className="bg-white border rounded-xl p-4 md:p-0 md:border-b md:border-x-0 md:border-t-0 md:rounded-none md:bg-transparent md:grid md:grid-cols-4 md:gap-4 md:items-start hover:bg-slate-50/50 transition-colors shadow-sm md:shadow-none">
                                    <div className="mb-4 md:mb-0 md:p-4 md:col-span-1 border-b md:border-0 pb-4 md:pb-0">
                                        <div className="font-bold text-slate-800 text-lg md:text-base">{wb.customer_name}</div>
                                        <div className="text-xs font-mono text-slate-400 mt-1">{wb.nfc_id?.replace(/:/g, "")}</div>
                                        
                                        {/* Status Alerts */}
                                        {(wb.status === 'inactive' || (wb.valid_until && new Date().toISOString().split('T')[0] > wb.valid_until)) && (
                                            <div className="mt-2 text-xs text-red-500 font-bold flex items-center gap-1 bg-red-50 p-2 rounded w-fit">
                                                <AlertTriangle className="w-3 h-3" />
                                                {wb.status === 'inactive' ? 'צמיד לא פעיל' : `פג תוקף (${wb.valid_until})`}
                                            </div>
                                        )}
                                    </div>
                                    
                                    <div className="md:p-4 md:col-span-3">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                            {attractions.map(att => {
                                                const isChecked = (wb.allowed_events || []).some(e => e === att.name || e.startsWith(att.name + ' - '));
                                                const isInactive = wb.status === 'inactive';
                                                const isExpired = wb.valid_until && new Date().toISOString().split('T')[0] > wb.valid_until;
                                                // Disable if inactive, expired, or user is NOT admin
                                                const isDisabled = isInactive || isExpired || !isAdmin;
                                                
                                                // Check if scanned
                                                const isScanned = scanLogs.some(log => 
                                                    log.nfc_id === wb.nfc_id && 
                                                    (log.event_name === att.name || log.event_name.startsWith(att.name + ' - ')) && 
                                                    (log.status === 'success' || log.status === 'processed')
                                                );

                                                return (
                                                    <div key={att.id} className={`flex flex-col gap-1 bg-slate-50/50 border p-3 rounded-lg transition-colors ${isDisabled ? 'opacity-60 cursor-not-allowed' : 'hover:border-indigo-300 bg-white'}`}>
                                                        <div className="flex items-center space-x-2 space-x-reverse">
                                                            <Checkbox 
                                                                id={`wb-${wb.id}-${att.id}`} 
                                                                checked={isChecked}
                                                                onCheckedChange={() => !isDisabled && handleEventToggle(wb, att)}
                                                                disabled={isDisabled}
                                                                className="h-5 w-5"
                                                            />
                                                            <Label 
                                                                htmlFor={`wb-${wb.id}-${att.id}`}
                                                                className={`text-sm font-medium select-none flex-1 ${isDisabled ? 'cursor-not-allowed text-slate-500' : 'cursor-pointer text-slate-700'}`}
                                                            >
                                                                {att.name}
                                                            </Label>
                                                        </div>
                                                        {isScanned && (
                                                            <div className="flex items-center gap-1 text-[10px] text-green-600 font-bold px-7">
                                                                <CheckCircle2 className="w-3 h-3" />
                                                                נסרק בכניסה
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* History and Actions Section */}
            <Card className="md:col-span-2 shadow-sm border-slate-200">
                <CardHeader className="border-b border-slate-100 bg-white/50">
                    <CardTitle className="flex items-center gap-2 text-xl">
                        <History className="w-5 h-5 text-blue-600" />
                        היסטוריית פעולות ותיעוד
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                    {loadingTasks ? (
                        <div className="flex justify-center p-4"><Loader2 className="animate-spin text-blue-500" /></div>
                    ) : (
                        <div className="space-y-4">
                            {/* Inactive Wristbands (Swapped/Cancelled) */}
                            {wristbands.filter(wb => wb.status === 'inactive').map(wb => (
                                <div key={wb.id} className="flex items-start gap-4 p-4 bg-orange-50 border border-orange-100 rounded-lg">
                                    <div className="bg-orange-100 p-2 rounded-full mt-1">
                                        <RefreshCcw className="w-4 h-4 text-orange-600" />
                                    </div>
                                    <div>
                                        <div className="font-bold text-orange-900">צמיד בוטל / הוחלף</div>
                                        <div className="text-sm text-orange-800 mt-1">
                                            הצמיד של <strong>{wb.customer_name}</strong> (מספר: {wb.nfc_id?.replace(/:/g, "")}) סומן כלא פעיל במערכת.
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {/* Tasks (Refunds, Add Events, General) */}
                            {orderTasks.sort((a, b) => new Date(b.created_date) - new Date(a.created_date)).map(task => (
                                <div key={task.id} className="flex items-start gap-4 p-4 bg-slate-50 border border-slate-100 rounded-lg hover:bg-slate-100 transition-colors">
                                    <div className="bg-white p-2 rounded-full shadow-sm mt-1 border border-slate-200">
                                        {task.task_type === 'refund' ? <Receipt className="w-4 h-4 text-red-500" /> : 
                                         task.task_type === 'add_event' ? <PartyPopper className="w-4 h-4 text-purple-500" /> : 
                                         <CheckSquare className="w-4 h-4 text-blue-500" />}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex justify-between items-start">
                                            <div className="font-bold text-slate-800">{task.title}</div>
                                            <Badge variant="outline" className={task.status === 'done' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-amber-50 text-amber-700 border-amber-200'}>
                                                {task.status === 'done' ? 'בוצע' : 'ממתין לטיפול'}
                                            </Badge>
                                        </div>
                                        <div className="text-sm text-slate-600 mt-1">{task.description}</div>
                                        <div className="flex gap-3 mt-2 text-xs text-slate-500">
                                            <span>נוצר ב: {new Date(task.created_date).toLocaleDateString('he-IL')}</span>
                                            {task.sales_rep && <span>ע"י: {task.sales_rep}</span>}
                                            {task.amount > 0 && <span className="font-bold text-slate-700">סכום: {task.amount} {task.currency}</span>}
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {/* Direct Expenses (If any direct refunds were logged without a task) */}
                            {orderExpenses.filter(e => !orderTasks.some(t => t.id === e.id)).sort((a, b) => new Date(b.created_date) - new Date(a.created_date)).map(expense => (
                                <div key={expense.id} className="flex items-start gap-4 p-4 bg-red-50 border border-red-100 rounded-lg">
                                    <div className="bg-red-100 p-2 rounded-full mt-1">
                                        <CreditCard className="w-4 h-4 text-red-600" />
                                    </div>
                                    <div>
                                        <div className="font-bold text-red-900">הוצאה / החזר: {expense.reason}</div>
                                        <div className="text-sm text-red-800 mt-1">{expense.notes}</div>
                                        <div className="flex gap-3 mt-2 text-xs text-red-700">
                                            <span>תאריך: {new Date(expense.expense_date).toLocaleDateString('he-IL')}</span>
                                            <span className="font-bold">סכום: {expense.amount} {expense.currency}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {orderTasks.length === 0 && orderExpenses.length === 0 && wristbands.filter(wb => wb.status === 'inactive').length === 0 && (
                                <div className="text-center text-slate-500 py-6">
                                    לא נמצאו פעולות, בקשות או החזרים להזמנה זו.
                                </div>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>

      </div>
    </div>
  );
}