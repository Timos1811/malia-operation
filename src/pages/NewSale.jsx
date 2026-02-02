import React, { useState, useMemo, useRef } from 'react';
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, CheckCircle2, ShieldAlert, Lock, PartyPopper, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export default function NewSale() {
  const [formData, setFormData] = useState({ orderNumber: '', departureDate: '', customerCount: '1' });
  const [selectedAttractions, setSelectedAttractions] = useState(new Set());
  const [isScanning, setIsScanning] = useState(false);
  const [scannedIds, setScannedIds] = useState(new Set()); 
  const [isSuccess, setIsSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // מנעול אטומי למניעת מרוץ סריקות (Race Condition)
  const isProcessingRef = useRef(false);

  const { data: attractions = [], isLoading: isLoadingAttractions } = useQuery({
    queryKey: ['attractions'],
    queryFn: () => base44.entities.Attraction.list(),
  });

  const maxCustomers = parseInt(formData.customerCount) || 0;
  const scannedCount = scannedIds.size;
  const isAllWristbandsScanned = scannedCount >= maxCustomers && maxCustomers > 0;

  // פידבק קולי מותאם
  const playSound = (type = 'success') => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.frequency.setValueAtTime(type === 'success' ? 880 : 200, audioCtx.currentTime);
      gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.12);
    } catch (e) { console.error("Audio feedback failed"); }
  };

  const handleNFCScan = async () => {
    if (isAllWristbandsScanned) return;
    if (!('NDEFReader' in window)) return toast.error("NFC לא נתמך בדפדפן זה");
    if (!formData.orderNumber) return toast.error("הכנס מספר הזמנה תחילה");

    setIsScanning(true);
    try {
      const ndef = new NDEFReader();
      await ndef.scan();
      toast.info("ממתין לצמיד...");

      ndef.onreading = async (event) => {
        const nfcId = event.serialNumber;

        // הגנה 1: בדיקה בזיכרון המקומי למניעת כפל מיידי
        if (scannedIds.has(nfcId)) {
          playSound('error');
          toast.error("צמיד זה כבר נסרק במכירה הנוכחית");
          return;
        }

        // הגנה 2: מנעול לחיצה/סריקה (מונע מ-2 בקשות לצאת יחד)
        if (isProcessingRef.current) return;
        isProcessingRef.current = true;

        try {
          // הגנה 3: בדיקה עמוקה ב-Database - האם הצמיד שויך אי פעם בעבר?
          const existingCheck = await base44.entities.Wristband.list({
            filter: { nfc_id: nfcId }
          });

          if (existingCheck.length > 0) {
            playSound('error');
            toast.error("עצירה! הצמיד הזה כבר רשום במערכת ללקוח אחר", {
              style: { background: '#fee2e2', border: '2px solid #ef4444', color: '#991b1b' },
              duration: 5000
            });
            isProcessingRef.current = false;
            return;
          }

          const selectedNames = Array.from(selectedAttractions)
            .map(id => attractions.find(a => a.id === id)?.name)
            .filter(Boolean);

          // רישום הצמיד
          await base44.entities.Wristband.create({
            nfc_id: nfcId,
            order_number: formData.orderNumber.toString(),
            customer_name: `לקוח ${scannedIds.size + 1}`,
            allowed_events: selectedNames
          });

          playSound('success');
          setScannedIds(prev => new Set(prev).add(nfcId));
          toast.success(`צמיד ${scannedIds.size + 1} שויך`);
          
        } catch (err) {
          toast.error("שגיאה ברישום הצמיד בשרת");
        } finally {
          isProcessingRef.current = false;
          if (scannedIds.size + 1 >= maxCustomers) setIsScanning(false);
        }
      };
    } catch (err) {
      setIsScanning(false);
      toast.error("שגיאה בהפעלת הסורק");
    }
  };

  const handleFinalSubmit = async () => {
    // הגנה מפני לחיצה כפולה ושמירה לא מושלמת
    if (isSubmitting || !isAllWristbandsScanned) return;
    
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
      toast.error("שגיאה בשמירת נתוני המכירה הכלליים");
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

  // מסך הצלחה - מופיע רק כש-isSuccess הופך ל-true
  if (isSuccess) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-500" dir="rtl">
        <div className="bg-green-100 p-8 rounded-full mb-6">
          <CheckCircle2 className="w-16 h-16 text-green-600" />
        </div>
        <h2 className="text-3xl font-black text-slate-900 mb-2">המכירה הסתיימה!</h2>
        <p className="text-slate-500 mb-10 text-lg font-medium">הזמנה {formData.orderNumber} נשמרה בבסיס הנתונים.</p>
        <Button 
          className="w-full max-w-xs py-8 text-xl bg-slate-900 text-white rounded-3xl shadow-xl active:scale-95 transition-transform" 
          onClick={() => window.location.reload()}
        >
          מכירה חדשה
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-80" dir="rtl">
      {/* Navbar */}
      <div className="bg-white border-b p-4 sticky top-0 z-30 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-2 font-black text-xl">
          <PartyPopper className="text-indigo-600" /> קופה מהירה
        </div>
        <div className={`px-4 py-1.5 rounded-full text-sm font-black transition-all shadow-sm ${isAllWristbandsScanned ? 'bg-green-500 text-white animate-pulse' : 'bg-indigo-600 text-white'}`}>
           {scannedCount} / {maxCustomers} צמידים
        </div>
      </div>

      <div className="p-4 max-w-md mx-auto space-y-6">
        {/* טופס פרטים */}
        <Card className="border-none shadow-md rounded-3xl p-5 space-y-4 bg-white">
          <div className="space-y-1">
            <Label className="text-slate-400 text-xs font-bold mr-1">מספר הזמנה</Label>
            <Input 
              type="number" 
              className="text-xl font-bold py-7 bg-slate-50 border-none rounded-2xl focus-visible:ring-indigo-500" 
              value={formData.orderNumber} 
              onChange={(e) => setFormData({...formData, orderNumber: e.target.value})} 
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-slate-400 text-xs font-bold mr-1">תאריך</Label>
              <Input type="date" className="bg-slate-50 border-none rounded-xl" value={formData.departureDate} onChange={(e) => setFormData({...formData, departureDate: e.target.value})} />
            </div>
            <div className="space-y-1">
              <Label className="text-slate-400 text-xs font-bold mr-1">כמות</Label>
              <Input type="number" className="bg-slate-50 border-none rounded-xl font-bold" value={formData.customerCount} onChange={(e) => {
                 setFormData({...formData, customerCount: e.target.value});
                 setScannedIds(new Set());
              }} />
            </div>
          </div>
        </Card>

        {/* בחירת אירועים */}
        <div className="space-y-3">
          <p className="text-slate-500 font-black px-1 flex items-center gap-2">בחירת אירועים כלולים</p>
          {isLoadingAttractions ? <div className="flex justify-center p-10"><Loader2 className="animate-spin text-indigo-500" /></div> : 
            attractions.map(att => (
              <div 
                key={att.id} 
                onClick={() => setSelectedAttractions(prev => {
                  const next = new Set(prev);
                  next.has(att.id) ? next.delete(att.id) : next.add(att.id);
                  return next;
                })} 
                className={`flex items-center gap-4 p-4 rounded-2xl border-2 transition-all cursor-pointer ${selectedAttractions.has(att.id) ? 'border-indigo-500 bg-indigo-50 shadow-sm' : 'border-white bg-white shadow-sm'}`}
              >
                <Checkbox checked={selectedAttractions.has(att.id)} className="w-6 h-6 rounded-full border-slate-300" />
                <div className="flex-1 flex justify-between items-center font-bold">
                  <span className="text-slate-700">{att.name}</span>
                  <span className="text-indigo-600">€{att.price_eur}</span>
                </div>
              </div>
            ))
          }
        </div>

        {/* כפתור איפוס במידת הצורך */}
        {scannedCount > 0 && !isAllWristbandsScanned && (
          <Button variant="ghost" className="w-full text-slate-400 text-xs gap-2" onClick={() => { if(confirm("לאפס סריקות?")) setScannedIds(new Set()); }}>
            <RefreshCw className="w-3 h-3" /> אפס סריקות והתחל מחדש
          </Button>
        )}
      </div>

      {/* Footer קבוע */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t p-4 shadow-[0_-10px_40px_rgba(0,0,0,0.1)] z-40">
        <div className="max-w-md mx-auto space-y-4">
          
          {!isAllWristbandsScanned ? (
            <Button 
              className={`w-full py-10 text-xl font-black rounded-3xl shadow-xl transition-all border-4 ${isScanning ? 'bg-green-500 border-green-200 text-white animate-pulse' : 'bg-white border-indigo-600 text-indigo-600'}`} 
              onClick={handleNFCScan} 
              disabled={isScanning}
            >
              {isScanning ? "הצמד צמיד עכשיו..." : `סרוק צמיד ${scannedCount + 1}`}
            </Button>
          ) : (
            <div className="py-6 bg-green-50 text-green-600 text-center rounded-3xl font-black text-lg flex items-center justify-center gap-3 border-2 border-green-200 shadow-inner">
              <ShieldAlert className="w-6 h-6" /> כל הצמידים מוכנים
            </div>
          )}

          <div className="flex justify-between items-center px-4 font-black">
            <span className="text-slate-400 text-lg uppercase tracking-tight">Total Payment:</span>
            <span className="text-3xl text-indigo-600">€{totalPrice.toFixed(2)}</span>
          </div>

          <Button 
            className={`w-full py-8 text-xl rounded-3xl shadow-2xl transition-all font-black ${isAllWristbandsScanned && !isSubmitting ? 'bg-slate-900 text-white active:scale-95' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`} 
            onClick={handleFinalSubmit} 
            disabled={isSubmitting || !isAllWristbandsScanned}
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2"><Loader2 className="animate-spin" /> שומר נתונים...</span>
            ) : !isAllWristbandsScanned ? (
              <span className="flex items-center gap-2 opacity-60 font-medium"><Lock className="w-5 h-5" /> חסר עוד {maxCustomers - scannedCount} צמידים</span>
            ) : "שמור וסיים מכירה"}
          </Button>
        </div>
      </div>
    </div>
  );
}