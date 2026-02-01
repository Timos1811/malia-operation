import React, { useState, useMemo, useRef } from 'react';
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, PartyPopper, CheckCircle2, Lock, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export default function NewSale() {
  const [formData, setFormData] = useState({ orderNumber: '', departureDate: '', customerCount: '1' });
  const [selectedAttractions, setSelectedAttractions] = useState(new Set());
  const [isScanning, setIsScanning] = useState(false);
  const [scannedIds, setScannedIds] = useState(new Set()); 
  const [isSuccess, setIsSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Ref למניעת מרוץ (Race Condition) - חיוני לעבודה עם NFC מהיר
  const isProcessingRef = useRef(false);

  const { data: attractions = [], isLoading: isLoadingAttractions } = useQuery({
    queryKey: ['attractions'],
    queryFn: () => base44.entities.Attraction.list(),
  });

  const maxCustomers = parseInt(formData.customerCount) || 0;
  const scannedCount = scannedIds.size;
  const isAllWristbandsScanned = scannedCount >= maxCustomers && maxCustomers > 0;

  const playBeep = (type = 'success') => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.frequency.setValueAtTime(type === 'success' ? 880 : 220, audioCtx.currentTime);
      gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.1);
    } catch (e) { console.log("Audio error"); }
  };

  const handleNFCScan = async () => {
    if (isAllWristbandsScanned) return;
    if (!('NDEFReader' in window)) return toast.error("NFC לא נתמך");
    if (!formData.orderNumber) return toast.error("הזן מספר הזמנה תחילה");

    setIsScanning(true);
    try {
      const ndef = new NDEFReader();
      await ndef.scan();
      
      ndef.onreading = async (event) => {
        const nfcId = event.serialNumber;

        // הגנה 1: בדיקה בזיכרון המקומי (מיידית, ללא Delay של שרת)
        if (scannedIds.has(nfcId)) {
          playBeep('error');
          toast.error("עצירה! הצמיד הזה כבר נסרק במכירה הזו");
          return;
        }

        // הגנה 2: מניעת כפילות בזמן שהבקשה הקודמת עדיין בדרך (Atomic Lock)
        if (isProcessingRef.current) return;
        isProcessingRef.current = true;

        try {
          // הגנה 3: בדיקה מול ה-DB (למקרה שהצמיד משויך להזמנה אחרת לגמרי)
          const existing = await base44.entities.Wristband.list({ filter: { nfc_id: nfcId } });
          if (existing.length > 0) {
            playBeep('error');
            toast.error("הצמיד כבר רשום במערכת ללקוח אחר");
            isProcessingRef.current = false;
            return;
          }

          const selectedNames = Array.from(selectedAttractions)
            .map(id => attractions.find(a => a.id === id)?.name)
            .filter(Boolean);

          await base44.entities.Wristband.create({
            nfc_id: nfcId,
            order_number: formData.orderNumber.toString(),
            customer_name: `צמיד ${scannedIds.size + 1}`,
            allowed_events: selectedNames
          });

          playBeep('success');
          // עדכון הזיכרון המקומי מייד בסיום הרישום
          setScannedIds(prev => new Set(prev).add(nfcId));
          toast.success(`צמיד ${scannedIds.size + 1} שויך`);
          
        } catch (err) {
          toast.error("שגיאה ברישום");
        } finally {
          isProcessingRef.current = false; // שחרור המנעול
          if (scannedIds.size + 1 >= maxCustomers) setIsScanning(false);
        }
      };
    } catch (err) {
      setIsScanning(false);
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
      toast.error("שגיאה בשמירה");
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
        <CheckCircle2 className="w-20 h-20 text-green-500 mb-6" />
        <h2 className="text-3xl font-black mb-2">נשמר בהצלחה</h2>
        <Button className="w-full max-w-xs py-8 text-xl bg-indigo-600 rounded-3xl" onClick={() => window.location.reload()}>מכירה חדשה</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-80" dir="rtl">
      <div className="bg-white border-b p-4 sticky top-0 z-30 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-2 font-black text-xl"> קופה מהירה </div>
        <div className={`px-4 py-1.5 rounded-full text-sm font-black transition-all ${isAllWristbandsScanned ? 'bg-green-500 text-white' : 'bg-indigo-600 text-white'}`}>
           {scannedCount} / {maxCustomers}
        </div>
      </div>

      <div className="p-4 max-w-md mx-auto space-y-6">
        <Card className="border-none shadow-md rounded-3xl p-5 space-y-4">
            <div className="space-y-1">
              <Label className="text-slate-400 text-xs">מספר הזמנה</Label>
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
          {attractions.map(att => (
            <div key={att.id} onClick={() => setSelectedAttractions(prev => {
              const next = new Set(prev);
              next.has(att.id) ? next.delete(att.id) : next.add(att.id);
              return next;
            })} className={`flex items-center gap-4 p-4 rounded-2xl border-2 transition-all cursor-pointer ${selectedAttractions.has(att.id) ? 'border-indigo-500 bg-indigo-50' : 'border-white bg-white shadow-sm'}`}>
              <Checkbox checked={selectedAttractions.has(att.id)} className="w-6 h-6 rounded-full" />
              <div className="flex-1 flex justify-between items-center font-bold text-slate-700">
                <span>{att.name}</span>
                <span className="text-indigo-600">€{att.price_eur}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t p-4 shadow-2xl z-40">
        <div className="max-w-md mx-auto space-y-4">
          {!isAllWristbandsScanned ? (
            <Button className={`w-full py-10 text-xl font-black rounded-3xl shadow-xl transition-all border-4 ${isScanning ? 'bg-green-500 border-green-200 text-white animate-pulse' : 'bg-white border-indigo-600 text-indigo-600'}`} onClick={handleNFCScan} disabled={isScanning}>
              {isScanning ? "הצמד צמיד..." : `סרוק צמיד ${scannedCount + 1}`}
            </Button>
          ) : (
            <div className="py-6 bg-green-50 text-green-600 text-center rounded-3xl font-black text-lg flex items-center justify-center gap-3 border-2 border-green-200">
              <ShieldCheck /> כל הצמידים נסרקו
            </div>
          )}

          <div className="flex justify-between items-center px-4 font-black text-2xl">
            <span className="text-slate-400 text-lg">סה"כ:</span>
            <span className="text-indigo-600">€{totalPrice.toFixed(2)}</span>
          </div>

          <Button className={`w-full py-8 text-xl rounded-3xl shadow-2xl transition-all font-black ${isAllWristbandsScanned && !isSubmitting ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-400'}`} onClick={handleFinalSubmit} disabled={isSubmitting || !isAllWristbandsScanned}>
            {isSubmitting ? <Loader2 className="animate-spin" /> : !isAllWristbandsScanned ? `חסר עוד ${maxCustomers - scannedCount} סריקות` : "שמור וסיים מכירה"}
          </Button>
        </div>
      </div>
    </div>
  );
}