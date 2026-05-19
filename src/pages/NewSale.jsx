import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44, supabase } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useOnlineStatus } from '@/lib/useOnlineStatus';
import {
  isNfcIdTaken,
  isOrderNumberTaken,
  getCachedLookup,
  enqueueSale,
  getLastNewSaleSync,
  getSalesQueueCount,
  getQueuedSales,
  removeQueuedSale,
} from '@/lib/offlineStore';
import { syncNewSaleData, flushSalesQueue } from '@/lib/syncManager';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Loader2, CheckCircle2, ShieldAlert, PartyPopper, ScanLine, AlertTriangle,
  Building2, User, Wifi, WifiOff, CloudOff, Cloud, RefreshCw,
} from 'lucide-react';
import { getNextEventDate } from '@/utils/dateHelpers';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

export default function NewSale() {
  const online = useOnlineStatus();
  const { user: currentUser } = useAuth();

  const [formData, setFormData] = useState({
    orderNumber: '',
    departureDate: '',
    customerCount: '1',
    gender: 'mixed',
    hotel: '',
    company: '',
  });

  const [selectedAttractions, setSelectedAttractions] = useState(new Set());
  const [isScanning, setIsScanning] = useState(false);
  const [scannedIds, setScannedIds] = useState(new Set());
  const scannedIdsRef = useRef(new Set());
  const [scannedWristbands, setScannedWristbands] = useState([]); // [{nfc_id, customer_name, allowed_events, valid_until}]
  const [lastScanned, setLastScanned] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [savedOffline, setSavedOffline] = useState(false);

  const isProcessingRef = useRef(false);
  const audioCtxRef = useRef(null);

  // Offline support state
  const [lastSync, setLastSync] = useState(null);
  const [salesQueueCount, setSalesQueueCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  // Cached lookups (fallback to server data when online)
  const [cachedAttractions, setCachedAttractions] = useState([]);
  const [cachedHotels, setCachedHotels] = useState([]);
  const [cachedCombos, setCachedCombos] = useState([]);
  const [cachedComboPrice, setCachedComboPrice] = useState('550');

  // --- Server-backed queries (used when online) ---
  const { data: attractionsOnline = [] } = useQuery({
    queryKey: ['attractions'],
    queryFn: () => base44.entities.Attraction.list(),
    staleTime: 1000 * 60 * 5,
    enabled: online,
  });

  const { data: hotelsOnline = [] } = useQuery({
    queryKey: ['hotels'],
    queryFn: () => base44.entities.Hotel.list(),
    staleTime: 1000 * 60 * 5,
    enabled: online,
  });

  const { data: comboPriceOnline } = useQuery({
    queryKey: ['appSettings', 'combo_price_eur'],
    queryFn: async () => {
      const settings = await base44.entities.AppSetting.filter({ key: 'combo_price_eur' });
      return settings[0]?.value || '550';
    },
    staleTime: 1000 * 60 * 5,
    enabled: online,
  });

  // Effective data (online first, fallback to cache)
  const attractions = attractionsOnline.length > 0 ? attractionsOnline : cachedAttractions;
  const hotels = hotelsOnline.length > 0 ? hotelsOnline : cachedHotels;
  const comboPrice = parseFloat(comboPriceOnline || cachedComboPrice) || 550;

  // --- Init: load cache + try syncing if online ---
  useEffect(() => {
    (async () => {
      const [att, hot, comb, sett, last, queued] = await Promise.all([
        getCachedLookup('attractions'),
        getCachedLookup('hotels'),
        getCachedLookup('combos'),
        getCachedLookup('app_settings'),
        getLastNewSaleSync(),
        getSalesQueueCount(),
      ]);
      setCachedAttractions(att || []);
      setCachedHotels(hot || []);
      setCachedCombos(comb || []);
      const cp = (sett || []).find((s) => s.key === 'combo_price_eur');
      if (cp?.value) setCachedComboPrice(cp.value);
      setLastSync(last);
      setSalesQueueCount(queued);
    })();
  }, []);

  // Refresh cache when going online
  useEffect(() => {
    if (online) {
      handleSyncCache().catch(() => {});
      flushSalesQueue()
        .then((r) => {
          if (r?.created) toast.success(`סונכרנו ${r.created} מכירות שהמתינו`);
          if (r?.conflicts) toast.warning(`${r.conflicts} מכירות בקונפליקט - דרושה התערבות`);
        })
        .finally(refreshQueueCount);
    }
  }, [online]);

  const refreshQueueCount = async () => setSalesQueueCount(await getSalesQueueCount());

  const handleSyncCache = async () => {
    if (!online) return toast.error('אין חיבור לאינטרנט');
    setSyncing(true);
    try {
      // 1. Refresh cached lookup data from server
      const data = await syncNewSaleData();
      setCachedAttractions(data.attractions || []);
      setCachedHotels(data.hotels || []);
      setCachedCombos(data.combos || []);
      const cp = (data.app_settings || []).find((s) => s.key === 'combo_price_eur');
      if (cp?.value) setCachedComboPrice(cp.value);
      const last = await getLastNewSaleSync();
      setLastSync(last);

      // 2. Push any pending offline sales to server
      const queuedBefore = await getQueuedSales();
      if (queuedBefore.length > 0) {
        const result = await flushSalesQueue();
        await refreshQueueCount();

        if (result.created > 0) toast.success(`✓ סונכרנו ${result.created} מכירות לשרת`);
        if (result.conflicts > 0) {
          const conflicts = await getQueuedSales();
          const conflictDetails = conflicts
            .filter((s) => s.status === 'conflict')
            .map((s) => `הזמנה ${s.order_number}: ${s.conflict?.status === 'conflict_order' ? 'מספר הזמנה תפוס' : 'צמיד תפוס'}`)
            .join('\n');
          toast.error(`${result.conflicts} מכירות בקונפליקט:\n${conflictDetails}`, { duration: 10000 });
        }
        if (result.errors > 0) {
          const queued = await getQueuedSales();
          const errs = queued.filter((s) => s.last_error).map((s) => s.last_error).join(' | ');
          toast.error(`${result.errors} שגיאות: ${errs}`, { duration: 10000 });
        }
        if (result.created === 0 && result.conflicts === 0 && result.errors === 0) {
          toast.message('הקאש סונכרן (אין מכירות ממתינות)');
        }
      } else {
        toast.success('הנתונים סונכרנו');
      }
    } catch (e) {
      console.error('sync failed', e);
      toast.error(`שגיאת סנכרון: ${e.message || String(e)}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleDiscardConflict = async (local_id) => {
    if (!window.confirm('למחוק את המכירה הזו מהתור? לא ניתן לשחזר.')) return;
    await removeQueuedSale(local_id);
    await refreshQueueCount();
    toast.success('המכירה נמחקה מהתור');
  };

  // Detailed queue inspection state (visible to user)
  const [queueDetails, setQueueDetails] = useState([]);
  useEffect(() => {
    if (salesQueueCount > 0) {
      getQueuedSales().then(setQueueDetails);
    } else {
      setQueueDetails([]);
    }
  }, [salesQueueCount]);

  // --- Calculated values ---
  const maxCustomers = parseInt(formData.customerCount) || 1;
  const maxCustomersRef = useRef(maxCustomers);
  useEffect(() => { maxCustomersRef.current = maxCustomers; }, [maxCustomers]);

  const scannedCount = scannedIds.size;
  const isAllWristbandsScanned = scannedCount >= maxCustomers;
  const isCombo = attractions.length > 0 && selectedAttractions.size === attractions.length;

  const totalPrice = useMemo(() => {
    if (attractions.length > 0 && selectedAttractions.size === attractions.length) {
      return comboPrice * maxCustomers;
    }
    let sum = 0;
    selectedAttractions.forEach((id) => {
      const att = attractions.find((a) => a.id === id);
      if (att) sum += att.price_eur || 0;
    });
    return sum * maxCustomers;
  }, [selectedAttractions, maxCustomers, attractions, comboPrice]);

  // --- Order duplicate check (works offline against cache) ---
  const [casparLoaded, setCasparLoaded] = useState(false);

  const checkOrderDuplicate = async () => {
    if (!formData.orderNumber || formData.orderNumber.length < 3) return false;

    try {
      // Try unclaimed pending sale auto-fill (from cache if offline)
      let unclaimedEntry = null;
      if (online) {
        const existingPending = await base44.entities.PendingSale.filter({
          order_number: formData.orderNumber.toString(),
        });
        unclaimedEntry = existingPending.find((ps) => !ps.sales_rep);
      } else {
        const cached = (await getCachedLookup('unclaimed_pending_sales')) || [];
        unclaimedEntry = cached.find((ps) => String(ps.order_number) === formData.orderNumber.toString());
      }

      if (unclaimedEntry) {
        const peopleCount = parseInt(unclaimedEntry.customer, 10);
        const genderReverseMap = { 'גברים': 'male', 'נשים': 'female', 'מעורב': 'mixed' };
        setFormData((prev) => ({
          ...prev,
          departureDate: unclaimedEntry.departure_date || prev.departureDate,
          hotel: unclaimedEntry.hotel || prev.hotel,
          company: unclaimedEntry.company || prev.company,
          customerCount: peopleCount > 0 ? peopleCount.toString() : prev.customerCount,
          gender: genderReverseMap[unclaimedEntry.gender] || prev.gender,
        }));
        setCasparLoaded(true);
        toast.success(`נטענו פרטי הזמנה ממתינה${peopleCount ? ` (${peopleCount} אנשים)` : ''}`);
        return false;
      }

      const taken = await isOrderNumberTaken(formData.orderNumber.toString());
      if (taken) {
        toast.error('מספר הזמנה זה כבר קיים במערכת!');
        return true;
      }
    } catch (e) {
      console.error('dup check', e);
    }
    return false;
  };

  // --- Audio feedback ---
  const playSound = (type) => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(type === 'success' ? 880 : 200, ctx.currentTime);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
      if (navigator.vibrate) navigator.vibrate(type === 'success' ? 80 : [80, 60, 80]);
    } catch {}
  };

  // --- NFC Scanning ---
  const handleNFCScan = async () => {
    if (isAllWristbandsScanned) return;
    if (!formData.orderNumber) return toast.error('נא להזין מספר הזמנה');
    if (!('NDEFReader' in window)) return toast.error('דפדפן זה לא תומך ב-NFC');

    setIsScanning(true);
    try {
      const ndef = new window.NDEFReader();
      await ndef.scan();
      toast.info('מוכן לסריקה: הצמד צמיד...');

      ndef.onreading = async (event) => {
        const nfcId = event.serialNumber.replace(/:/g, '').toLowerCase();
        if (scannedIdsRef.current.has(nfcId)) return;
        if (scannedIdsRef.current.size >= maxCustomersRef.current) {
          setIsScanning(false);
          return;
        }
        if (isProcessingRef.current) return;
        isProcessingRef.current = true;

        try {
          // Duplicate check against cache (works offline)
          const taken = await isNfcIdTaken(nfcId);
          if (taken) {
            playSound('error');
            setLastScanned({
              status: 'error',
              id: nfcId,
              message: 'צמיד זה כבר בשימוש',
              details: 'הצמיד מופיע במאגר המקומי',
            });
            toast.error('צמיד תפוס');
            return;
          }

          // Add to local scan list (NOT yet to server)
          const selectedNames = Array.from(selectedAttractions)
            .map((id) => {
              const att = attractions.find((a) => a.id === id);
              if (!att) return null;
              const nextDateStr = getNextEventDate(att.event_days, att.start_time);
              return nextDateStr ? `${att.name} - ${nextDateStr.split('-').reverse().join('/')}` : att.name;
            })
            .filter(Boolean);

          const guestNumber = scannedIdsRef.current.size + 1;
          const wbEntry = {
            nfc_id: nfcId,
            customer_name: `אורח ${guestNumber}`,
            allowed_events: selectedNames,
            valid_until: formData.departureDate || null,
          };

          playSound('success');
          scannedIdsRef.current.add(nfcId);
          setScannedIds(new Set(scannedIdsRef.current));
          setScannedWristbands((prev) => [...prev, wbEntry]);

          setLastScanned({
            status: 'success',
            id: nfcId,
            message: 'צמיד נסרק',
            details: `אורח ${guestNumber}`,
          });
          toast.success('צמיד נוסף');
        } catch (e) {
          console.error(e);
          toast.error('שגיאה ברישום הצמיד');
        } finally {
          isProcessingRef.current = false;
          if (scannedIdsRef.current.size >= maxCustomersRef.current) {
            setIsScanning(false);
            toast.success('כל הצמידים נסרקו!');
          }
        }
      };
    } catch (error) {
      console.error(error);
      setIsScanning(false);
      toast.error('שגיאה בהפעלת NFC');
    }
  };

  // --- Finish Sale (online: server / offline: queue) ---
  const handleFinishSale = async () => {
    if (!formData.orderNumber) return toast.error('חסר מספר הזמנה');
    if (scannedCount === 0) return toast.error('יש לסרוק לפחות צמיד אחד');
    if (scannedCount < maxCustomers) {
      const ok = window.confirm(
        `הוגדרו ${maxCustomers} לקוחות, נסרקו ${scannedCount}. להמשיך?`
      );
      if (!ok) return;
    }

    setIsSubmitting(true);
    try {
      const genderMap = { male: 'גברים', female: 'נשים', mixed: 'מעורב' };
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const departure = new Date(formData.departureDate); departure.setHours(0, 0, 0, 0);
      const calculatedNights = Math.max(0, Math.ceil((departure - today) / (1000 * 60 * 60 * 24))).toString();

      const salePayload = {
        order_number: formData.orderNumber.toString(),
        departure_date: formData.departureDate,
        customer: formData.customerCount.toString(),
        nights: calculatedNights,
        gender: genderMap[formData.gender] || formData.gender,
        hotel: formData.hotel,
        company: formData.company,
        requested_amount: totalPrice.toString(),
        sales_rep: currentUser?.full_name || '',
        is_combo: isCombo,
        wristbands: scannedWristbands,
      };

      if (online) {
        const { data, error } = await supabase.rpc('create_sale_atomic', { p_sale: salePayload });
        if (error) throw error;
        if (data?.status === 'created') {
          setIsSuccess(true);
        } else if (data?.status === 'conflict_order') {
          toast.error('מספר הזמנה כבר קיים במערכת');
        } else if (data?.status === 'conflict_wristbands') {
          toast.error(`צמידים שכבר בשימוש: ${(data.conflicting || []).join(', ')}`);
        } else {
          toast.error(`תגובה לא צפויה מהשרת: ${data?.status}`);
        }
      } else {
        // OFFLINE: queue it
        await enqueueSale(salePayload);
        await refreshQueueCount();
        setSavedOffline(true);
        setIsSuccess(true);
      }
    } catch (error) {
      console.error(error);
      toast.error(`שגיאה בשמירה: ${error.message || 'נסה שוב'}`);
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center" dir="rtl">
        {savedOffline ? (
          <>
            <CloudOff className="w-24 h-24 text-orange-500 mb-6" />
            <h1 className="text-3xl font-black text-slate-900 mb-2">נשמר מקומית</h1>
            <p className="text-slate-500 text-lg mb-2">
              המכירה {formData.orderNumber} נשמרה בזכרון המכשיר.
            </p>
            <p className="text-slate-500 text-base mb-8">
              כשתחזור הרשת - המכירה תסונכרן אוטומטית לשרת.
            </p>
          </>
        ) : (
          <>
            <CheckCircle2 className="w-24 h-24 text-green-500 mb-6" />
            <h1 className="text-3xl font-black text-slate-900 mb-2">המכירה הושלמה!</h1>
            <p className="text-slate-500 text-lg mb-8">
              הזמנה {formData.orderNumber} נשמרה עם {scannedIds.size} צמידים.
            </p>
          </>
        )}
        <Button size="lg" className="rounded-full font-bold text-lg px-8" onClick={() => window.location.reload()}>
          התחל מכירה חדשה
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-40" dir="rtl">
      {/* Header */}
      <div className="bg-white border-b p-4 sticky top-0 z-30 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-2 font-black text-xl text-slate-800">
          <PartyPopper className="text-indigo-600" /> מכירה חדשה
        </div>
        <div className="flex items-center gap-2">
          <div className={`px-2 py-1 rounded-full text-xs font-bold flex items-center gap-1 ${
            online ? 'bg-emerald-50 text-emerald-700' : 'bg-orange-50 text-orange-700'
          }`}>
            {online ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            {online ? 'מקוון' : 'לא מקוון'}
          </div>
          <div className={`px-3 py-1 rounded-full text-sm font-black flex items-center gap-1 ${
            isAllWristbandsScanned ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-700'
          }`}>
            <ScanLine className="w-3 h-3" /> {scannedCount} / {maxCustomers}
          </div>
        </div>
      </div>

      <div className="max-w-xl mx-auto p-4 space-y-4">
        {/* Sync status / Queue indicator */}
        {(salesQueueCount > 0 || !lastSync) && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm text-blue-800 font-medium">
                {salesQueueCount > 0 ? (
                  <>
                    <CloudOff className="w-4 h-4" />
                    <span>{salesQueueCount} מכירות ממתינות לסנכרון</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span>טרם סונכרן - צריך אינטרנט לעבודה offline</span>
                  </>
                )}
              </div>
              {online && (
                <Button size="sm" onClick={handleSyncCache} disabled={syncing} className="h-8 bg-blue-600 hover:bg-blue-700">
                  {syncing ? <Loader2 className="w-3 h-3 animate-spin ml-1" /> : <Cloud className="w-3 h-3 ml-1" />}
                  סנכרן עכשיו
                </Button>
              )}
            </div>

            {queueDetails.length > 0 && (
              <div className="bg-white rounded-lg p-2 space-y-1 max-h-48 overflow-y-auto border border-blue-100">
                {queueDetails.map((sale) => (
                  <div key={sale.local_id} className="text-xs flex items-center justify-between gap-2 py-1 border-b last:border-0">
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-slate-800 truncate">
                        הזמנה {sale.order_number}
                        <span className={`mr-2 px-1.5 py-0.5 rounded text-[10px] ${
                          sale.status === 'queued' ? 'bg-blue-100 text-blue-700' :
                          sale.status === 'syncing' ? 'bg-yellow-100 text-yellow-700' :
                          sale.status === 'conflict' ? 'bg-red-100 text-red-700' : 'bg-slate-100'
                        }`}>
                          {sale.status === 'queued' ? 'בתור' :
                           sale.status === 'syncing' ? 'מסנכרן...' :
                           sale.status === 'conflict' ? 'קונפליקט' : sale.status}
                        </span>
                      </div>
                      <div className="text-slate-500 text-[11px]">
                        {sale.wristbands?.length || 0} צמידים · €{sale.requested_amount || 0}
                      </div>
                      {sale.last_error && (
                        <div className="text-red-600 text-[10px] mt-0.5 truncate" title={sale.last_error}>
                          ⚠ {sale.last_error}
                        </div>
                      )}
                      {sale.conflict && (
                        <div className="text-red-600 text-[10px] mt-0.5">
                          {sale.conflict.status === 'conflict_order' ? 'מספר הזמנה תפוס' : `צמיד תפוס: ${(sale.conflict.conflicting || []).join(', ')}`}
                        </div>
                      )}
                    </div>
                    {sale.status === 'conflict' && (
                      <button
                        onClick={() => handleDiscardConflict(sale.local_id)}
                        className="text-red-600 hover:text-red-800 text-[10px] font-medium px-2 py-1 hover:bg-red-50 rounded"
                      >
                        מחק
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 1: Order Details */}
        <Card className="border-none shadow-sm rounded-3xl overflow-hidden">
          <CardHeader className="bg-slate-900 text-white p-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <User className="w-5 h-5" /> פרטי הזמנה
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2 space-y-1">
              <Label className="text-xs text-slate-500 flex items-center gap-2">
                מספר הזמנה
                {casparLoaded && (
                  <span className="text-[10px] font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                    ✓ נטענו פרטי כספר
                  </span>
                )}
              </Label>
              <Input
                type="number"
                inputMode="numeric"
                autoComplete="off"
                className={`text-lg font-bold border-slate-200 ${casparLoaded ? 'bg-green-50 border-green-300' : 'bg-slate-50'}`}
                value={formData.orderNumber}
                onChange={(e) => {
                  setFormData({ ...formData, orderNumber: e.target.value });
                  setCasparLoaded(false);
                }}
                onBlur={checkOrderDuplicate}
                placeholder="123456"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-slate-500">מספר לקוחות</Label>
              <Input
                type="number"
                inputMode="numeric"
                value={formData.customerCount}
                onChange={(e) => {
                  setFormData({ ...formData, customerCount: e.target.value });
                  setScannedIds(new Set());
                  scannedIdsRef.current = new Set();
                  setScannedWristbands([]);
                }}
                className="bg-slate-50 border-slate-200 font-bold"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-slate-500">תאריך עזיבה</Label>
              <Input
                type="date"
                value={formData.departureDate}
                onChange={(e) => setFormData({ ...formData, departureDate: e.target.value })}
                className="bg-slate-50 border-slate-200"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-slate-500">מגדר</Label>
              <Select value={formData.gender} onValueChange={(val) => setFormData({ ...formData, gender: val })}>
                <SelectTrigger className="bg-slate-50 border-slate-200"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mixed">מעורב</SelectItem>
                  <SelectItem value="male">גברים</SelectItem>
                  <SelectItem value="female">נשים</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="sm:col-span-2 space-y-1">
              <Label className="text-xs text-slate-500">מלון</Label>
              <Select value={formData.hotel} onValueChange={(val) => setFormData({ ...formData, hotel: val })}>
                <SelectTrigger className="bg-slate-50 border-slate-200"><SelectValue placeholder="בחר מלון" /></SelectTrigger>
                <SelectContent>
                  {hotels.map((h) => <SelectItem key={h.id} value={h.name}>{h.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="sm:col-span-2 space-y-1">
              <Label className="text-xs text-slate-500">חברה</Label>
              <Select value={formData.company} onValueChange={(val) => setFormData({ ...formData, company: val })}>
                <SelectTrigger className="bg-slate-50 border-slate-200"><SelectValue placeholder="בחר חברה" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ק">ק - קשרי תעופה</SelectItem>
                  <SelectItem value="נ">נ - נטו פאן</SelectItem>
                  <SelectItem value="כ">כ - כספר</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Step 2: Parties */}
        <div className="space-y-3">
          <h3 className="font-bold text-slate-700 px-1">בחירת מסיבות</h3>
          {attractions.map((att) => {
            const isSelected = selectedAttractions.has(att.id);
            return (
              <div
                key={att.id}
                className={`flex flex-col gap-3 p-4 rounded-2xl border transition-all ${
                  isSelected ? 'bg-indigo-50 border-indigo-500 shadow-sm' : 'bg-white border-slate-100 hover:border-slate-300'
                }`}
              >
                <div
                  onClick={() => setSelectedAttractions((prev) => {
                    const next = new Set(prev);
                    next.has(att.id) ? next.delete(att.id) : next.add(att.id);
                    return next;
                  })}
                  className="flex items-center gap-4 cursor-pointer"
                >
                  <Checkbox checked={isSelected} className="w-5 h-5 rounded-full" />
                  <div className="flex-1 flex justify-between items-center font-medium">
                    <span>{att.name}</span>
                    <span className="text-indigo-600 font-bold">€{att.price_eur}</span>
                  </div>
                </div>
                {isSelected && getNextEventDate(att.event_days, att.start_time) && (
                  <div className="pl-9 pr-2 pb-2">
                    <span className="text-xs font-medium text-indigo-600 bg-indigo-100 px-2 py-1 rounded-md block w-fit">
                      תאריך נבחר: {getNextEventDate(att.event_days, att.start_time).split('-').reverse().join('/')}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Scan Feedback */}
        <AnimatePresence mode="wait">
          {lastScanned && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={`p-4 rounded-2xl border flex items-start gap-4 ${
                lastScanned.status === 'success' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
              }`}
            >
              <div className={`p-2 rounded-full ${
                lastScanned.status === 'success' ? 'bg-green-200 text-green-700' : 'bg-red-200 text-red-700'
              }`}>
                {lastScanned.status === 'success' ? <CheckCircle2 size={24} /> : <AlertTriangle size={24} />}
              </div>
              <div>
                <div className={`font-bold text-lg ${lastScanned.status === 'success' ? 'text-green-800' : 'text-red-800'}`}>
                  {lastScanned.message}
                </div>
                <div className="text-slate-600 text-sm mt-1">{lastScanned.details}</div>
                <div className="text-slate-400 text-xs mt-1 font-mono">{lastScanned.id}</div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-lg border-t p-4 z-40 shadow-[0_-5px_20px_rgba(0,0,0,0.05)] pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="max-w-xl mx-auto space-y-3">
          {!isAllWristbandsScanned ? (
            <Button
              className={`w-full py-8 text-xl font-black rounded-2xl shadow-lg transition-all ${
                isScanning ? 'bg-indigo-100 text-indigo-700 animate-pulse' : 'bg-indigo-600 text-white hover:bg-indigo-700'
              }`}
              onClick={handleNFCScan}
              disabled={isScanning}
            >
              {isScanning
                ? <span className="flex items-center gap-2"><Loader2 className="animate-spin" /> סורק...</span>
                : <span className="flex items-center gap-2"><ScanLine /> סרוק צמיד {scannedCount + 1}</span>}
            </Button>
          ) : (
            <div className="w-full py-4 bg-green-50 text-green-700 rounded-2xl border border-green-200 text-center font-bold flex items-center justify-center gap-2">
              <ShieldAlert className="w-5 h-5" /> כל הצמידים שויכו
            </div>
          )}

          <div className="flex items-center justify-between px-2">
            <div>
              <span className="text-slate-400 text-xs block font-bold">סה"כ לתשלום</span>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-black text-slate-800">€{totalPrice.toFixed(2)}</span>
                {isCombo && (
                  <span className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white text-xs px-2 py-0.5 rounded-full font-bold shadow-sm animate-pulse">
                    COMBO DEAL!
                  </span>
                )}
              </div>
            </div>

            <Button
              className={`px-8 py-6 text-lg font-bold rounded-xl transition-all ${
                scannedCount > 0 && !isSubmitting
                  ? 'bg-slate-900 text-white shadow-xl hover:scale-105'
                  : 'bg-slate-100 text-slate-300 cursor-not-allowed'
              }`}
              onClick={handleFinishSale}
              disabled={scannedCount === 0 || isSubmitting}
            >
              {isSubmitting ? <Loader2 className="animate-spin" /> : online ? 'סיים מכירה' : 'שמור (offline)'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
