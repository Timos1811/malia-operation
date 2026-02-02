import React, { useState, useMemo, useRef } from 'react';
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, CheckCircle2, AlertOctagon, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

export default function NewSale() {
  const [formData, setFormData] = useState({ orderNumber: '', departureDate: '', customerCount: '1' });
  const [selectedAttractions, setSelectedAttractions] = useState(new Set());
  const [isScanning, setIsScanning] = useState(false);
  const [scannedIds, setScannedIds] = useState(new Set()); 
  const [isSuccess, setIsSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // מנעול קריטי למניעת ריצה מקבילה של סריקות
  const isProcessingRef = useRef(false);

  const { data: attractions = [], isLoading: isLoadingAttractions } = useQuery({
    queryKey: ['attractions'],
    queryFn: () => base44.entities.Attraction.list(),
  });

  const maxCustomers = parseInt(formData.customerCount) || 0;
  const scannedCount = scannedIds.size;
  const isAllWristbandsScanned = scannedCount >= maxCustomers && maxCustomers > 0;

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
    } catch (e) { console.error("Audio error"); }
  };

  const handleNFCScan = async () => {
    if (isAllWristbandsScanned) return;
    if (!('NDEFReader' in window)) return toast.error("NFC לא נתמך בדפדפן זה");
    if (!formData.orderNumber) return toast.error("חובה להזין מספר הזמנה לפני סריקה");

    setIsScanning(true);
    try {
      const ndef = new NDEFReader();
      await ndef.scan();
      toast.info("סורק פעיל - הצמד צמיד עכשיו");

      ndef.onreading = async (event) => {
        const nfcId = event.serialNumber;

        // הגנה 1: האם סרקנו אותו הרגע?
        if (scannedIds.has(nfcId)) {
          playSound('error');
          toast.error("כפל סריקה: הצמיד כבר מופיע ברשימה למטה");
          return;
        }

        // הגנה 2: מנעול תהליך (מונע מ-2 סריקות לרוץ יחד לשרת)
        if (isProcessingRef.current) return;
        isProcessingRef.current = true;

        try {
          // הגנה 3: בדיקה מול ה-Database - האם הצמיד שויך אי פעם?
          const existingCheck = await base44.entities.Wristband.list({
            filter: { nfc_id: nfcId }
          });

          if (existingCheck.length > 0) {
            playSound('error');
            toast.error("עצירה! הצמיד הזה כבר משויך ללקוח אחר במערכת", {
              style: { background: '#fee2e2', border: '2px solid #ef4444', color: '#991b1b' },
              duration: 5000
            });
            isProcessingRef.current = false;
            return;
          }

          // אם הגענו לכאן - הצמיד פנוי!
          const selectedNames = Array.from(selectedAttractions)
            .map(id => attractions.find(a => a.id === id)?.name)
            .filter(Boolean);

          await base44.entities.Wristband.create({
            nfc_id: nfcId,
            order_number: formData.orderNumber.toString(),
            customer_name: `לקוח ${scannedIds.size + 1}`,
            allowed_events: selectedNames
          });

          playSound('success');
          setScannedIds(prev => new Set(prev).add(nfcId));
          toast.success(`צמיד ${scannedIds.size + 1} שויך בהצלחה!`);
          
        } catch (err) {
          toast.error("שגיאה בתקשורת עם השרת");
        } finally {
          isProcessingRef.current = false;
          if (scannedIds.size + 1 >= maxCustomers) setIsScanning(false);
        }
      };
    } catch (err) {
      setIsScanning(false);
      toast.error("שגיאה בהפעלת רכיב NFC");
    }
  };

  const handleFinalSubmit = async () => {
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
      toast.error("שגיאה בשמירת נתוני המכירה");
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
        <div className="bg-green-50 p-10 rounded-full mb-6">
          <CheckCircle2 className="w-20 h-20 text-green-500" />
        </div>
        <h2 className="text-3xl font-black mb-2">מכירה בוצעה!</h2>
        <p className="text-slate-500 mb-10">הצמידים והמכירה רשומים במערכת.</p>
        <Button className="w-full max-w-xs py-8 text-xl bg-slate-900 text-white rounded-3xl" onClick={() => window.location.reload()}>מכירה חדשה</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-80" dir="rtl">
      <div className="bg-white border-b p-4 sticky top-0 z-30 flex justify-between items-center">
        <span className="font-black text-xl">סנכרון צמידים</span>
        <div className={`px-4 py-1.5 rounded-full text-sm font-black ${isAllWristbandsScanned ? 'bg-green-500 text-white' : 'bg-indigo-600 text-white'}`}>
           {scannedCount} / {maxCustomers} סרקו
        </div>
      </div>

      <div className="p-4 max-w-md mx-auto space-y-6">
        <Card className="border-none shadow-md rounded-3xl p-5 space-y-4 bg-white">
            <div className="space-y-1">
              <Label className="text-slate-400 text-xs font-bold mr-1">מספר הזמנה</Label>
              <Input type="number" className="text-xl font-bold py-7 bg-slate-50 border-none rounded-2xl" value={formData.orderNumber} onChange={(e) => setFormData({...formData, orderNumber: e.target.value})} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input type="date" className="bg-slate-50 border-none rounded-xl" value={formData.departureDate} onChange={(e) => setFormData({...formData, departureDate: e.target.value})} />
              <Input type="number" className="bg-slate-50 border-none rounded-xl font-bold" value={formData.customerCount} onChange={(e) => {
                   setFormData({...formData, customerCount: e.target.value});
                   setScannedIds(new Set());
                }} />
            </div>
        </Card>

        <div className="space-y-3">
          <p className="text-slate-500 font-bold px-1">בחר מסיבות:</p>
          {attractions.map(att => (
            <div key={att.id} onClick={() => setSelectedAttractions(prev => {
              const next = new Set(prev);
              next.has(att.id) ? next.delete(att.id) : next.add(att.id);
              return next;
            })} className={`flex items-center gap-4 p-4 rounded-2xl border-2 transition-all cursor-pointer ${selectedAttractions.has(att.id) ? 'border-indigo-500 bg-indigo-50 shadow-sm' : 'border-white bg-white'}`}>
              <Checkbox checked={selectedAttractions.has(att.id)} className="w-6 h-6 rounded-full border-slate-300" />
              <div className="flex-1 flex justify-between items-center font-bold">
                <span className="text-slate-700">{att.name}</span>
                <span className="text-indigo-600 font-black">€{att.price_eur}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t p-4 shadow-2xl z-40">
        <div className="max-w-md mx-auto space-y-4">
          
          {!isAllWristbandsScanned ? (
            <Button 
              className={`w-full py-10 text-xl font-black rounded-3xl shadow-xl transition-all border-4 ${isScanning ? 'bg-green-500 border-green-200 text-white animate-pulse' : 'bg-white border-indigo-600 text-indigo-600'}`} 
              onClick={handleNFCScan} 
              disabled={isScanning}
            >
              {isScanning ? "ממתין לצמיד..." : `סרוק צמיד ${scannedCount + 1}`}
            </Button>
          ) : (
            <div className="py-6 bg-green-50 text-green-600 text-center rounded-3xl font-black text-lg flex items-center justify-center gap-3 border-2 border-green-200">
              <ShieldAlert className="w-6 h-6" /> כל הצמידים שויכו
            </div>
          )}

          <div className="flex justify-between items-center px-4">
            <span className="text-slate-400 font-bold">סה"כ לתשלום:</span>
            <span className="text-3xl font-black text-indigo-600">€{totalPrice.toFixed(2)}</span>
          </div>

          <Button 
            className={`w-full py-8 text-xl rounded-3xl shadow-2xl transition-all font-black ${isAllWristbandsScanned && !isSubmitting ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-400'}`} 
            onClick={handleFinalSubmit} 
            disabled={isSubmitting || !isAllWristbandsScanned}
          >
            {isSubmitting ? <Loader2 className="animate-spin" /> : !isAllWristbandsScanned ? "חסר סריקות" : "שמור וסיים מכירה"}
          </Button>
        </div>
      </div>
    </div>
  );
}