import React, { useState, useMemo } from 'react';
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, PartyPopper, CheckCircle2, Lock, AlertTriangle, RefreshCcw } from "lucide-react";
import { toast } from "sonner";

export default function NewSale() {
  const [formData, setFormData] = useState({ orderNumber: '', departureDate: '', customerCount: '1' });
  const [selectedAttractions, setSelectedAttractions] = useState(new Set());
  const [isScanning, setIsScanning] = useState(false);
  const [scannedIds, setScannedIds] = useState(new Set()); 
  const [isSuccess, setIsSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: attractions = [], isLoading: isLoadingAttractions } = useQuery({
    queryKey: ['attractions'],
    queryFn: () => base44.entities.Attraction.list(),
  });

  const maxCustomers = parseInt(formData.customerCount) || 0;
  const scannedCount = scannedIds.size;
  const isAllWristbandsScanned = scannedCount >= maxCustomers && maxCustomers > 0;
  const hasStartedScanning = scannedCount > 0;

  const playBeep = (type = 'success') => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      // צליל שונה להצלחה לעומת שגיאה
      oscillator.frequency.setValueAtTime(type === 'success' ? 880 : 220, audioCtx.currentTime);
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.15);
    } catch (e) { console.log("Audio error"); }
  };

  const handleNFCScan = async () => {
    if (!('NDEFReader' in window)) return toast.error("NFC לא נתמך");
    if (!formData.orderNumber) return toast.error("הכנס מספר הזמנה");

    setIsScanning(true);
    try {
      const ndef = new NDEFReader();
      await ndef.scan();
      toast.info("ממתין לצמיד...");

      ndef.onreading = async (event) => {
        const nfcId = event.serialNumber;

        // הגנה 1: זיהוי כפול בסשן הנוכחי
        if (scannedIds.has(nfcId)) {
          playBeep('error');
          toast.error("צמיד זה כבר נסרק במכירה הנוכחית!", { duration: 4000 });
          return;
        }

        try {
          // הגנה 2: בדיקה מול בסיס הנתונים
          const existing = await base44.entities.Wristband.list({ filter: { nfc_id: nfcId } });
          if (existing.length > 0) {
            playBeep('error');
            toast.error("צמיד זה כבר רשום במערכת ומשויך ללקוח אחר!", { duration: 4000 });
            return;
          }

          const selectedNames = Array.from(selectedAttractions)
            .map(id => attractions.find(a => a.id === id)?.name)
            .filter(Boolean);

          await base44.entities.Wristband.create({
            nfc_id: nfcId,
            order_number: formData.orderNumber.toString(),
            customer_name: `לקוח ${scannedIds.size + 1}`,
            allowed_events: selectedNames
          });

          playBeep('success');
          setScannedIds(prev => new Set(prev).add(nfcId));
          toast.success(`צמיד ${scannedIds.size + 1} שויך`);
          if (scannedIds.size + 1 >= maxCustomers) setIsScanning(false);
        } catch (err) {
          toast.error("שגיאה ברישום הצמיד");
        }
      };
    } catch (err) {
      setIsScanning(false);
    }
  };

  const handleFinalSubmit = async () => {
    if (!isAllWristbandsScanned || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await base44.entities.TableData.create({
        order_number: formData.orderNumber,
        departure_date: formData.departureDate,
        customer: formData.customerCount,
        requested_amount: (totalPrice).toString(),
        eur_amount: (totalPrice).toString(),
        eur_status: "0"
      });
      setIsSuccess(true);
    } catch (err) {
      toast.error("שגיאה בשמירת המכירה");
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalPrice = useMemo(() => {
    let sum = 0;
    selectedAttractions.forEach(id => {
      const att = attractions.find(a => a.id === id);
      if (att) sum += (att.price_eur || 0);
    });
    return sum * maxCustomers;
  }, [selectedAttractions, maxCustomers, attractions]);

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center" dir="rtl">
        <div className="bg-green-100 p-8 rounded-full mb-6 animate-in zoom-in duration-300">
          <CheckCircle2 className="w-16 h-16 text-green-600" />
        </div>
        <h2 className="text-3xl font-black mb-2">המכירה הסתיימה!</h2>
        <p className="text-slate-500 mb-8 text-lg">הזמנה {formData.orderNumber} נרשמה בהצלחה.</p>
        <Button className="w-full max-w-xs py-8 text-xl bg-slate-900 rounded-3xl" onClick={() => window.location.reload()}>מכירה חדשה</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-80 font-sans" dir="rtl">
      {/* Header */}
      <div className="bg-white border-b p-4 sticky top-0 z-30 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-2">
          <PartyPopper className="text-indigo-600 w-6 h-6" />
          <span className="font-black text-xl">קופה מהירה</span>
        </div>
        <div className={`px-4 py-1.5 rounded-full text-sm font-black transition-all ${isAllWristbandsScanned ? 'bg-green-500 text-white shadow-lg' : 'bg-indigo-600 text-white'}`}>
           {scannedCount} / {maxCustomers} צמידים
        </div>
      </div>

      <div className="p-4 max-w-md mx-auto space-y-6">
        {/* פרטי הזמנה */}
        <Card className="border-none shadow-md rounded-3xl overflow-hidden">
          <CardContent className="p-5 space-y-4">
            <div className="space-y-1">
              <Label className="text-slate-400 text-xs font-bold mr-1">מספר הזמנה</Label>
              <Input 
                type="number" 
                disabled={hasStartedScanning}
                className="text-xl font-bold py-7 bg-slate-50 border-none rounded-2xl focus-visible:ring-indigo-500" 
                value={formData.orderNumber} 
                onChange={(e) => setFormData({...formData, orderNumber: e.target.value})} 
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-slate-400 text-xs font-bold mr-1">תאריך</Label>
                <Input type="date" disabled={hasStartedScanning} className="bg-slate-50 border-none rounded-xl" value={formData.departureDate} onChange={(e) => setFormData({...formData, departureDate: e.target.value})} />
              </div>
              <div className="space-y-1">
                <Label className="text-slate-400 text-xs font-bold mr-1">כמות לקוחות</Label>
                <Input type="number" disabled={hasStartedScanning} className="bg-slate-50 border-none rounded-xl font-bold" value={formData.customerCount} onChange={(e) => setFormData({...formData, customerCount: e.target.value})} />
              </div>
            </div>
            {hasStartedScanning && (
              <p className="text-[10px] text-amber-600 font-bold flex items-center gap-1">
                <Lock className="w-3 h-3" /> שדות נעולים בזמן סריקה (אפס למטה לשינוי)
              </p>
            )}
          </CardContent>
        </Card>

        {/* בחירת מסיבות */}
        <div className="space-y-3">
          <div className="flex justify-between items-center px-1">
            <Label className="text-slate-500 font-black">מסיבות ואירועים</Label>
            <span className="text-[10px] bg-slate-200 px-2 py-0.5 rounded text-slate-600 uppercase">Multi-select</span>
          </div>
          {isLoadingAttractions ? <Loader2 className="animate-spin mx-auto mt-10 text-indigo-500" /> : 
            attractions.map(att => (
              <div key={att.id} onClick={() => !hasStartedScanning && setSelectedAttractions(prev => {
                const next = new Set(prev);
                next.has(att.id) ? next.delete(att.id) : next.add(att.id);
                return next;
              })} className={`flex items-center gap-4 p-4 rounded-2xl border-2 transition-all cursor-pointer ${selectedAttractions.has(att.id) ? 'border-indigo-500 bg-indigo-50 shadow-sm' : 'border-white bg-white shadow-sm'} ${hasStartedScanning ? 'opacity-70 cursor-not-allowed' : ''}`}>
                <Checkbox checked={selectedAttractions.has(att.id)} className="w-6 h-6 rounded-full border-slate-300" />
                <div className="flex-1 flex justify-between items-center font-bold">
                  <span className="text-slate-700">{att.name}</span>
                  <span className="text-indigo-600">€{att.price_eur}</span>
                </div>
              </div>
            ))
          }
        </div>

        {/* כפתור איפוס למקרה של טעות */}
        {hasStartedScanning && !isAllWristbandsScanned && (
          <Button variant="ghost" className="w-full text-slate-400 text-xs flex gap-2 items-center justify-center hover:text-red-500 transition-colors" onClick={() => {
            if(confirm("למחוק סריקות ולהתחיל מחדש?")) setScannedIds(new Set());
          }}>
            <RefreshCcw className="w-3 h-3" /> אפס סריקות והתחל מחדש
          </Button>
        )}
      </div>

      {/* Fixed Footer UI */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t p-4 shadow-[0_-10px_40px_rgba(0,0,0,0.1)] z-40">
        <div className="max-w-md mx-auto space-y-4">
          {!isAllWristbandsScanned ? (
            <Button 
              className={`w-full py-10 text-xl font-black rounded-3xl shadow-xl transition-all border-4 ${isScanning ? 'bg-green-500 border-green-200 text-white animate-pulse' : 'bg-white border-indigo-600 text-indigo-600 hover:bg-indigo-50'}`} 
              onClick={handleNFCScan} 
              disabled={isScanning}
            >
              {isScanning ? "הצמד צמיד עכשיו..." : `סרוק צמיד ${scannedCount + 1}`}
            </Button>
          ) : (
            <div className="py-6 bg-green-500 text-white text-center rounded-3xl font-black text-lg flex items-center justify-center gap-3 shadow-lg animate-in fade-in slide-in-from-bottom-2">
              <CheckCircle2 className="w-6 h-6" /> כל הצמידים שויכו בהצלחה
            </div>
          )}

          <div className="flex justify-between items-center px-4">
            <span className="text-slate-400 font-bold">סה"כ לתשלום:</span>
            <span className="text-3xl font-black text-indigo-600">€{totalPrice.toFixed(2)}</span>
          </div>

          <Button 
            className={`w-full py-8 text-xl rounded-3xl shadow-2xl transition-all font-black ${isAllWristbandsScanned ? 'bg-slate-900 text-white hover:bg-black active:scale-95' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`} 
            onClick={handleFinalSubmit} 
            disabled={isSubmitting || !isAllWristbandsScanned}
          >
            {isSubmitting ? <Loader2 className="animate-spin" /> : 
             !isAllWristbandsScanned ? (
               <span className="flex items-center gap-2"><Lock className="w-5 h-5" /> חסר עוד {maxCustomers - scannedCount} צמידים</span>
             ) : "שמור וסיים מכירה"}
          </Button>
        </div>
      </div>
    </div>
  );
}