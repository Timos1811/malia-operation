import React, { useState, useMemo, useRef } from 'react';
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, CheckCircle2, ShieldAlert, Lock, PartyPopper, Wifi, ScanLine, XCircle, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

export default function NewSale() {
  const [formData, setFormData] = useState({ orderNumber: '', departureDate: '', customerCount: '1' });
  const [selectedAttractions, setSelectedAttractions] = useState(new Set());
  const [isScanning, setIsScanning] = useState(false);
  const [scannedIds, setScannedIds] = useState(new Set()); 
  const [isSuccess, setIsSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastScanned, setLastScanned] = useState(null); // { id: string, status: 'success' | 'error', message: string, owner?: string }
  
  // ה-Ref הזה הוא המפתח: הוא נשאר יציב בין רינדורים ומונע כפל ריצה
  const isCurrentlyRegistering = useRef(false);

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
    } catch (e) { console.error(e); }
  };

  const handleNFCScan = async () => {
    if (isAllWristbandsScanned) return;
    if (!('NDEFReader' in window)) return toast.error("NFC לא נתמך");
    if (!formData.orderNumber) return toast.error("הכנס מספר הזמנה תחילה");

    setIsScanning(true);
    try {
      const ndef = new NDEFReader();
      await ndef.scan();
      toast.info("ממתין לצמיד...");

      ndef.onreading = async (event) => {
        const nfcId = event.serialNumber;

        // הגנה 1: בדיקה בזיכרון המקומי (מיידי)
        if (scannedIds.has(nfcId)) {
          return; // התעלמות שקטה מכפל קריאה של אותו צמיד באותו רגע
        }

        // הגנה 2: מניעת מרוץ (Race Condition) - אם אנחנו כבר בתהליך רישום, תתעלם מהקריאה הבאה
        if (isCurrentlyRegistering.current) return;
        isCurrentlyRegistering.current = true;

        try {
          // הגנה 3: בדיקה קפדנית מול ה-Database
          const existingCheck = await base44.entities.Wristband.list({
            filter: { nfc_id: nfcId }
          });

          if (existingCheck.length > 0) {
            const existing = existingCheck[0];
            playSound('error');
            setLastScanned({
              id: nfcId,
              status: 'error',
              message: 'הצמיד כבר בשימוש',
              owner: `הזמנה ${existing.order_number} (${existing.customer_name || 'ללא שם'})`
            });
            toast.error(`צמיד תפוס!`, { description: `שייך להזמנה ${existing.order_number}` });
            isCurrentlyRegistering.current = false; 
            return;
          }

          const selectedNames = Array.from(selectedAttractions)
            .map(id => attractions.find(a => a.id === id)?.name)
            .filter(Boolean);

          // רישום הצמיד בבסיס הנתונים
          await base44.entities.Wristband.create({
            nfc_id: nfcId,
            order_number: formData.orderNumber.toString(),
            customer_name: `לקוח ${scannedIds.size + 1}`,
            allowed_events: selectedNames
          });

          playSound('success');
          setLastScanned({
            id: nfcId,
            status: 'success',
            message: 'צמיד שויך בהצלחה',
            owner: `לקוח ${scannedIds.size + 1}`
          });
          setScannedIds(prev => new Set(prev).add(nfcId));
          toast.success("צמיד שויך בהצלחה");
          
        } catch (err) {
          console.error(err);
          setLastScanned({ id: nfcId, status: 'error', message: 'שגיאת תקשורת' });
          toast.error("שגיאה בתקשורת");
        } finally {
          // שחרור המנעול רק בסוף התהליך
          isCurrentlyRegistering.current = false;
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
        <h2 className="text-3xl font-black mb-2 text-slate-900">בוצע בהצלחה!</h2>
        <p className="text-slate-500 mb-10">הזמנה {formData.orderNumber} סגורה.</p>
        <Button className="w-full max-w-xs py-8 bg-slate-900 rounded-3xl font-bold" onClick={() => window.location.reload()}>מכירה חדשה</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-80" dir="rtl">
      <div className="bg-white border-b p-4 sticky top-0 z-30 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-2 font-black text-xl">
          <PartyPopper className="text-indigo-600" /> קופה
        </div>
        <div className={`px-4 py-1 rounded-full text-sm font-black ${isAllWristbandsScanned ? 'bg-green-500 text-white' : 'bg-indigo-600 text-white'}`}>
           {scannedCount} / {maxCustomers}
        </div>
      </div>

      <div className="p-4 max-w-md mx-auto space-y-6">
        <Card className="border-none shadow-md rounded-3xl p-5 bg-white">
          <CardContent className="p-0 space-y-4">
            <div className="space-y-1">
              <Label className="text-slate-400 text-xs font-bold mr-1">מספר הזמנה</Label>
              <Input type="number" className="text-xl font-bold py-7 bg-slate-50 border-none rounded-2xl" value={formData.orderNumber} onChange={(e) => setFormData({...formData, orderNumber: e.target.value})} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input type="date" className="bg-slate-50 border-none rounded-xl" value={formData.departureDate} onChange={(e) => setFormData({...formData, departureDate: e.target.value})} />
              <Input type="number" className="bg-slate-50 border-none rounded-xl font-bold" value={formData.customerCount} onChange={(e) => { setFormData({...formData, customerCount: e.target.value}); setScannedIds(new Set()); }} />
            </div>
          </CardContent>
        </Card>

        <div className="space-y-3">
          {attractions.map(att => (
            <div key={att.id} onClick={() => setSelectedAttractions(prev => {
              const next = new Set(prev);
              next.has(att.id) ? next.delete(att.id) : next.add(att.id);
              return next;
            })} className={`flex items-center gap-4 p-4 rounded-2xl border-2 transition-all cursor-pointer ${selectedAttractions.has(att.id) ? 'border-indigo-500 bg-indigo-50' : 'border-white bg-white shadow-sm'}`}>
              <Checkbox checked={selectedAttractions.has(att.id)} className="w-6 h-6 rounded-full border-slate-300" />
              <div className="flex-1 flex justify-between items-center font-bold">
                <span className="text-slate-700">{att.name}</span>
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
              {isScanning ? "ממתין לצמיד..." : `סרוק צמיד ${scannedCount + 1}`}
            </Button>
          ) : (
            <div className="py-6 bg-green-50 text-green-600 text-center rounded-3xl font-black text-lg flex items-center justify-center gap-3 border-2 border-green-200 shadow-inner">
              <ShieldAlert /> הצמידים הוקצו
            </div>
          )}

          <div className="flex justify-between items-center px-4 font-black">
            <span className="text-slate-400 text-lg uppercase">Total:</span>
            <span className="text-3xl text-indigo-600">€{totalPrice.toFixed(2)}</span>
          </div>

          <Button className={`w-full py-8 text-xl rounded-3xl shadow-2xl transition-all font-black ${isAllWristbandsScanned && !isSubmitting ? 'bg-slate-900 text-white active:scale-95' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`} onClick={handleFinalSubmit} disabled={isSubmitting || !isAllWristbandsScanned}>
            {isSubmitting ? <Loader2 className="animate-spin" /> : "שמור וסיים מכירה"}
          </Button>
        </div>
      </div>
    </div>
  );
}