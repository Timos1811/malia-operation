import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { base44, supabase } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useOnlineStatus } from '@/lib/useOnlineStatus';
import {
  cacheWristbandsForEvent,
  lookupWristbandLocal,
  isAlreadyScannedLocal,
  markScannedLocal,
  getScannedCountLocal,
  getLastSync,
  enqueueScan,
  getQueueCount,
} from '@/lib/offlineStore';
import { syncEventData, flushScanQueue } from '@/lib/syncManager';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Loader2, Scan, CheckCircle2, XCircle, AlertTriangle, ThumbsUp,
  FileCheck, Home, Wifi, WifiOff, Cloud, CloudOff, RefreshCw,
} from 'lucide-react';
import { getNextEventDate } from '@/utils/dateHelpers';
import { toast } from 'sonner';

export default function EventScanner() {
  const [attractions, setAttractions] = useState([]);
  const [eventInstances, setEventInstances] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState('');
  const [uniqueScans, setUniqueScans] = useState(0);
  const [totalBuyers, setTotalBuyers] = useState(0);
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const { user: currentUser } = useAuth();
  const online = useOnlineStatus();
  const [showFinishDialog, setShowFinishDialog] = useState(false);
  const [signaturesCount, setSignaturesCount] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [lastSyncInfo, setLastSyncInfo] = useState(null);
  const [queueCount, setQueueCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const isProcessing = useRef(false);
  const navigate = useNavigate();

  const audioCtxRef = useRef(null);

  const ensureAudioCtx = () => {
    if (!audioCtxRef.current) {
      try {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      } catch {}
    }
    return audioCtxRef.current;
  };

  useEffect(() => {
    const fetchAttractions = async () => {
      try {
        const data = await base44.entities.Attraction.list();
        setAttractions(data);
        const nextEvents = data.map((att) => {
          const nextDateStr = getNextEventDate(att.event_days, att.start_time);
          return nextDateStr ? `${att.name} - ${nextDateStr.split('-').reverse().join('/')}` : att.name;
        });
        setEventInstances([...new Set(nextEvents)].sort());
      } catch (error) {
        toast.error(`שגיאה בטעינת אירועים: ${error.message || 'בדוק חיבור'}`);
      }
    };
    fetchAttractions();
    refreshQueueCount();
  }, []);

  // Flush queue automatically when back online
  useEffect(() => {
    if (online) {
      flushScanQueue()
        .then((res) => {
          if (res?.flushed) {
            toast.success(`סונכרנו ${res.flushed} סריקות שהמתינו`);
          }
        })
        .catch(() => {})
        .finally(refreshQueueCount);
    }
  }, [online]);

  useEffect(() => {
    if (!selectedEvent) {
      setUniqueScans(0);
      setTotalBuyers(0);
      setLastSyncInfo(null);
      return;
    }
    loadLocalStats();
    loadLastSyncInfo();
  }, [selectedEvent]);

  const refreshQueueCount = async () => {
    const c = await getQueueCount();
    setQueueCount(c);
  };

  const loadLocalStats = async () => {
    if (!selectedEvent) return;
    const count = await getScannedCountLocal(selectedEvent);
    setUniqueScans(count);
  };

  const loadLastSyncInfo = async () => {
    if (!selectedEvent) return;
    const info = await getLastSync(selectedEvent);
    setLastSyncInfo(info);
    if (info) setTotalBuyers(info.count || 0);
  };

  const handleSync = async () => {
    if (!selectedEvent) return toast.error('בחר אירוע');
    if (!online) return toast.error('אין רשת - לא ניתן לסנכרן');
    setSyncing(true);
    try {
      const data = await syncEventData(selectedEvent);
      const wbCount = (data.wristbands || []).length;
      const scannedCount = (data.already_scanned_ids || []).length;
      setTotalBuyers(wbCount);
      setUniqueScans(scannedCount);
      await loadLastSyncInfo();
      toast.success(`סונכרנו ${wbCount} צמידים`);
    } catch (e) {
      toast.error(`שגיאת סנכרון: ${e.message || e}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleFinishEvent = async () => {
    if (!selectedEvent) return;
    if (!online) return toast.error('סיום אירוע דורש חיבור לאינטרנט');
    setLoading(true);
    try {
      // Make sure queue is flushed before finalizing
      await flushScanQueue().catch(() => {});

      const baseEventName = selectedEvent.split(' - ')[0];
      const attraction = attractions.find((a) => a.name === baseEventName);
      const costPrice = attraction?.cost_price_eur || 0;
      const signatures = parseInt(signaturesCount) || 0;
      const paymentCount = uniqueScans + signatures;
      const totalAmount = paymentCount * costPrice;

      let eventDate = new Date().toISOString().split('T')[0];
      try {
        const firstLog = await base44.entities.WristbandScanLog.filter(
          { event_name: selectedEvent, status: 'success' },
          'scan_time',
          1
        );
        if (firstLog?.length > 0) eventDate = new Date(firstLog[0].scan_time).toISOString().split('T')[0];
      } catch {}

      await base44.entities.Task.create({
        title: `תשלום לספק - ${selectedEvent}`,
        description: `סיכום אירוע: ${selectedEvent}\nכרטיסים שנמכרו: ${totalBuyers}\nנסרקו: ${uniqueScans}\nחתימות: ${signatures}\nסה"כ לתשלום: ${paymentCount}\nמחיר עלות לאדם: €${costPrice}`,
        status: 'todo',
        task_type: 'supplier_payment',
        amount: totalAmount,
        currency: 'EUR',
        due_date: new Date().toISOString().split('T')[0],
        sales_rep: currentUser?.full_name || 'System',
        people_count: paymentCount,
        scanned_count: uniqueScans,
        buyers_count: totalBuyers,
        event_date: eventDate,
        event_name: selectedEvent,
      });

      await base44.functions.invoke('resetEventScans', { event_name: selectedEvent });
      setUniqueScans(0);
      toast.success('סיכום האירוע נשלח והסריקות אופסו!');
      setShowFinishDialog(false);
      setIsSuccess(true);
    } catch (error) {
      toast.error(`שגיאה ביצירת משימת תשלום: ${error.message || 'נסה שוב'}`);
    } finally {
      setLoading(false);
    }
  };

  const playSound = (type) => {
    try {
      const ctx = ensureAudioCtx();
      if (ctx) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(type === 'success' ? 880 : 200, ctx.currentTime);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
        osc.start();
        osc.stop(ctx.currentTime + 0.2);
      }
      if (navigator.vibrate) navigator.vibrate(type === 'success' ? 100 : [80, 60, 80]);
    } catch {}
  };

  const startScanning = async () => {
    if (!selectedEvent) return toast.error('בחר אירוע לפני הסריקה');
    if (!lastSyncInfo && online) {
      toast.message('מסנכרן צמידים לפני סריקה...');
      await handleSync();
    }
    if (!('NDEFReader' in window)) return toast.error('הדפדפן אינו תומך ב-NFC');

    try {
      const ndef = new window.NDEFReader();
      await ndef.scan();
      setIsScanning(true);
      toast.success('מוכן לסריקה...');
      ndef.onreading = async ({ serialNumber }) => {
        if (isProcessing.current) return;
        isProcessing.current = true;
        await handleScan(serialNumber);
        setTimeout(() => { isProcessing.current = false; }, 500);
      };
      ndef.onreadingerror = () => toast.error('שגיאה בקריאה, נסה שוב');
    } catch (error) {
      toast.error(`לא ניתן להפעיל NFC: ${error.message}`);
      setIsScanning(false);
    }
  };

  const handleScan = async (serialNumber) => {
    setLoading(true);
    setScanResult(null);
    const nfcId = serialNumber.replace(/:/g, '').toLowerCase();

    try {
      // OFFLINE-FIRST: check local cache first
      const cached = await lookupWristbandLocal(nfcId, selectedEvent);

      let resultStatus, resultMessage = '', resultDetails = {};
      let customerName = '', orderNumber = '';

      if (cached) {
        // Local hit
        customerName = cached.customer_name || '';
        orderNumber = cached.order_number || '';

        if (cached.status !== 'active') {
          resultStatus = 'error';
          resultMessage = 'הצמיד אינו פעיל';
        } else if (cached.valid_until && new Date().toISOString().split('T')[0] > cached.valid_until) {
          resultStatus = 'error';
          resultMessage = 'תוקף הצמיד פג';
          resultDetails = { valid_until: cached.valid_until };
        } else {
          const already = await isAlreadyScannedLocal(nfcId, selectedEvent);
          resultStatus = already ? 'already_scanned' : 'success';
        }
      } else if (online) {
        // Fall through to server RPC if not in local cache and we have network
        const { data: rpcResult, error: rpcError } = await supabase.rpc('scan_wristband', {
          p_nfc_id: nfcId,
          p_event_name: selectedEvent,
        });
        if (rpcError) throw rpcError;
        const status = rpcResult?.status;
        const wb = rpcResult?.wristband;
        customerName = wb?.customer_name || '';
        orderNumber = wb?.order_number || '';
        if (status === 'not_found') {
          resultStatus = 'error';
          resultMessage = 'צמיד לא מזוהה במערכת';
          resultDetails = { nfc_id: nfcId };
        } else if (status === 'inactive') {
          resultStatus = 'error';
          resultMessage = 'הצמיד אינו פעיל';
        } else if (status === 'expired') {
          resultStatus = 'error';
          resultMessage = 'תוקף הצמיד פג';
        } else if (status === 'warning') {
          resultStatus = 'warning';
        } else {
          resultStatus = status; // success | already_scanned
        }
      } else {
        // Offline + not in cache = unknown
        resultStatus = 'warning';
        resultMessage = 'צמיד לא נמצא במאגר המקומי';
        resultDetails = { nfc_id: nfcId };
      }

      setScanResult({ status: resultStatus, message: resultMessage, details: resultDetails });
      playSound(resultStatus === 'success' || resultStatus === 'already_scanned' ? 'success' : 'error');

      // Update local state and queue
      if (resultStatus === 'success') {
        await markScannedLocal(nfcId, selectedEvent);
        setUniqueScans((c) => c + 1);
      }

      const logStatus = resultStatus === 'already_scanned' ? 'success' : resultStatus;
      const logEntry = {
        nfc_id: nfcId,
        event_name: selectedEvent,
        scan_time: new Date().toISOString(),
        status: logStatus,
        message: resultStatus === 'already_scanned' ? 'Already Scanned' : resultMessage,
        scanned_by: currentUser?.full_name || 'Unknown',
        customer_name: customerName,
        order_number: orderNumber,
      };

      if (online) {
        // Try direct insert
        try {
          await base44.entities.WristbandScanLog.create(logEntry);
        } catch {
          await enqueueScan(logEntry);
          refreshQueueCount();
        }
      } else {
        // Queue for later
        await enqueueScan(logEntry);
        refreshQueueCount();
      }
    } catch (error) {
      setScanResult({ status: 'error', message: 'שגיאה בעיבוד', details: {} });
      playSound('error');
    } finally {
      setLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4" dir="rtl">
        <Card className="max-w-md w-full shadow-xl border-green-100">
          <CardContent className="pt-12 pb-8 px-8 text-center space-y-6">
            <div className="flex justify-center">
              <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center animate-bounce">
                <CheckCircle2 className="w-12 h-12 text-green-600" />
              </div>
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-slate-900">המשימה נשלחה בהצלחה!</h1>
              <p className="text-slate-500">דוח האירוע הועבר למנהל ותושלם ספירת הסריקות אופסה.</p>
            </div>
            <div className="grid gap-3 pt-4">
              <Button
                onClick={() => {
                  setIsSuccess(false);
                  setSelectedEvent('');
                  setSignaturesCount('');
                  setUniqueScans(0);
                  setScanResult(null);
                }}
                className="w-full bg-slate-900 hover:bg-slate-800 h-12 text-lg gap-2"
              >
                <Scan className="w-5 h-5" />
                סרוק אירוע חדש
              </Button>
              <Button variant="outline" onClick={() => navigate(createPageUrl('SellerDashboard'))} className="w-full h-12 text-lg gap-2">
                <Home className="w-5 h-5" />
                חזור לדף הבית
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8" dir="rtl">
      <div className="max-w-md mx-auto space-y-6">
        {/* Online indicator */}
        <div className={`flex items-center justify-between gap-2 px-3 py-2 rounded-full text-sm font-medium ${
          online ? 'bg-emerald-50 text-emerald-700' : 'bg-orange-50 text-orange-700'
        }`}>
          <div className="flex items-center gap-2">
            {online ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
            <span>{online ? 'מחובר' : 'לא מקוון'}</span>
          </div>
          {queueCount > 0 && (
            <div className="flex items-center gap-1 text-xs">
              <CloudOff className="w-3 h-3" />
              <span>{queueCount} בתור</span>
            </div>
          )}
        </div>

        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-slate-800 flex items-center justify-center gap-2">
            <Scan className="w-8 h-8" />
            סורק כניסה לאירועים
          </h1>
          <p className="text-slate-500">בחר אירוע, סנכרן ואז סרוק</p>
        </div>

        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">בחר אירוע</label>
              <Select value={selectedEvent} onValueChange={(val) => {
                setSelectedEvent(val);
                setScanResult(null);
                setIsScanning(false);
              }}>
                <SelectTrigger className="h-12 text-lg">
                  <SelectValue placeholder="בחר אירוע מהרשימה..." />
                </SelectTrigger>
                <SelectContent>
                  {eventInstances.map((name, idx) => (
                    <SelectItem key={idx} value={name}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedEvent && (
              <div className="space-y-3">
                <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 flex items-center justify-between">
                  <span className="text-indigo-700 font-medium">נסרקו לאירוע זה:</span>
                  <span className="text-2xl font-bold text-indigo-900">{uniqueScans}</span>
                </div>

                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={handleSync}
                  disabled={syncing || !online}
                >
                  {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Cloud className="w-4 h-4" />}
                  {lastSyncInfo
                    ? `סנכרן שוב (${lastSyncInfo.count} צמידים, ${new Date(lastSyncInfo.at).toLocaleTimeString('he-IL')})`
                    : 'סנכרן צמידים לפני האירוע'}
                </Button>

                <Button
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => setShowFinishDialog(true)}
                >
                  <FileCheck className="w-4 h-4 ml-2" />
                  סיים אירוע וצור דוח
                </Button>
              </div>
            )}

            {!isScanning ? (
              <Button
                className="w-full h-16 text-lg gap-3 bg-slate-900 hover:bg-slate-800"
                onClick={startScanning}
                disabled={!selectedEvent}
              >
                <Scan className="w-6 h-6" />
                התחל סריקה
              </Button>
            ) : (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center animate-pulse">
                <p className="text-blue-700 font-medium">מצב סריקה פעיל...</p>
                <p className="text-sm text-blue-500">קרב צמיד למכשיר</p>
              </div>
            )}
          </CardContent>
        </Card>

        {loading && (
          <div className="flex justify-center py-8">
            <Loader2 className="w-10 h-10 animate-spin text-slate-400" />
          </div>
        )}

        {scanResult && !loading && (
          <Card className={`border-8 overflow-hidden ${
            scanResult.status === 'success' ? 'border-green-500 shadow-green-200' :
            scanResult.status === 'already_scanned' ? 'border-yellow-500 shadow-yellow-200' :
            scanResult.status === 'warning' ? 'border-red-500 shadow-red-200' : 'border-slate-300'
          } shadow-2xl transform transition-all duration-300 scale-110`}>
            <div className={`p-12 flex items-center justify-center ${
              scanResult.status === 'success' ? 'bg-green-50' :
              scanResult.status === 'already_scanned' ? 'bg-yellow-50' :
              scanResult.status === 'warning' ? 'bg-red-50' : 'bg-slate-50'
            }`}>
              {scanResult.status === 'success' && <CheckCircle2 className="w-40 h-40 text-green-600 animate-bounce" />}
              {scanResult.status === 'already_scanned' && <ThumbsUp className="w-40 h-40 text-yellow-500 animate-bounce" />}
              {scanResult.status === 'warning' && <XCircle className="w-40 h-40 text-red-600 animate-pulse" />}
              {scanResult.status === 'error' && <AlertTriangle className="w-40 h-40 text-slate-400" />}
            </div>
            {scanResult.message && (
              <div className="bg-white p-3 text-center text-slate-700 font-medium border-t">
                {scanResult.message}
              </div>
            )}
          </Card>
        )}
      </div>

      <Dialog open={showFinishDialog} onOpenChange={setShowFinishDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>סיכום אירוע - {selectedEvent}</DialogTitle>
            <DialogDescription>אשר את נתוני האירוע ושלח לתשלום</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex justify-between items-center">
              <span className="text-slate-600 font-medium">כמות נסרקים</span>
              <span className="font-bold text-2xl text-slate-900">{uniqueScans}</span>
            </div>
            <div className="space-y-2">
              <Label>חתימות (תוספת ידנית)</Label>
              <Input
                type="number"
                inputMode="numeric"
                placeholder="הכנס כמות חתימות..."
                value={signaturesCount}
                onChange={(e) => setSignaturesCount(e.target.value)}
                className="text-lg"
              />
            </div>
            <div className="flex justify-between items-center text-sm px-2 pt-2 border-t">
              <span className="text-slate-600">סה"כ לתשלום:</span>
              <span className="font-semibold">{uniqueScans + (parseInt(signaturesCount) || 0)}</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFinishDialog(false)}>ביטול</Button>
            <Button onClick={handleFinishEvent} disabled={loading || !online} className="bg-emerald-600 hover:bg-emerald-700">
              {loading && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
              שלח למשימות
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
