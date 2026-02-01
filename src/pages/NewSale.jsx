import React, { useState, useMemo, useRef } from 'react';
import { useQuery, useMutation } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, PartyPopper, CheckCircle2, Lock, Radio } from "lucide-react";
import { toast } from "sonner";

export default function NewSale() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    orderNumber: '',
    departureDate: '',
    customerCount: '1',
  });
  const [selectedAttractions, setSelectedAttractions] = useState(new Set());
  const [isScanning, setIsScanning] = useState(false);
  const [isProcessingScan, setIsProcessingScan] = useState(false); // הגנה מכפל סריקה
  const [scannedCount, setScannedCount] = useState(0);
  const [isSuccess, setIsSuccess] = useState(false);

  const { data: attractions = [], isLoading: isLoadingAttractions } = useQuery({
    queryKey: ['attractions'],
    queryFn: () => base44.entities.Attraction.list(),
  });

  const maxCustomers = parseInt(formData.customerCount) || 0;
  const isAllWristbandsScanned = scannedCount >= maxCustomers && maxCustomers > 0;

  // פונקציית סריקה עם הגנה מריבוי קריאות
  const handleNFCScan = async () => {
    if (!('NDEFReader' in window)) {
      toast.error("NFC לא נתמך בדפדפן זה");
      return;
    }

    if (!formData.orderNumber) {
      toast.error("הכנס מספר הזמנה תחילה");
      return;
    }

    setIsScanning(true);
    try {
      const ndef = new NDEFReader();
      await ndef.scan();
      toast.info("סורק פעיל - הצמד צמיד אחד");

      ndef.onreading = async (event) => {
        // אם המערכת כבר באמצע עיבוד של צמיד - תתעלמי מהקריאה הנוכחית
        if (isProcessingScan) return;
        
        setIsProcessingScan(true); // נועל את הסורק
        const nfcId = event.serialNumber;

        try {
          // בדיקה אם הצמיד כבר קיים
          const existing = await base44.entities.Wristband.list({
            filter: { nfc_id: nfcId }
          });

          if (existing.length > 0) {
            toast.error("הצמיד כבר רשום במערכת!");
            setIsProcessingScan(false);
            setIsScanning(false);
            return;
          }

          const selectedNames = Array.from(selectedAttractions)
            .map(id => attractions.find(a => a.id === id)?.name)
            .filter(Boolean);

          await base44.entities.Wristband.create({
            nfc_id: nfcId,
            order_number: formData.orderNumber.toString(),
            customer_name: `לקוח ${scannedCount + 1}`,
            allowed_events: selectedNames
          });

          setScannedCount(prev => prev + 1);
          toast.success(`צמיד ${scannedCount + 1} שויך!`);
          
          // שחרור הנעילה רק אחרי סיום הרישום
          setIsProcessingScan(false);
          setIsScanning(false); 
        } catch (err) {
          toast.error("שגיאה ברישום: " + err.message);
          setIsProcessingScan(false);
          setIsScanning(false);
        }
      };
    } catch (err) {
      toast.error("שגיאה בהפעלת רכיב NFC");
      setIsScanning(false);
    }
  };

  const { totalPrice } = useMemo(() => {
    let sum = 0;
    selectedAttractions.forEach(id => {
      const att = attractions.find(a => a.id === id);
      if (att) sum += (att.price_eur || 0);
    });
    return { totalPrice: sum * maxCustomers };
  }, [selectedAttractions, maxCustomers, attractions]);

  const createSaleMutation = useMutation({
    mutationFn: (data) => base44.entities.TableData.create(data),
    onSuccess: () => {
      toast.success("הזמנה נשמרה!");
      setIsSuccess(true);
      // אם הדף לא מתחלף בטלפון, נוסיף ניווט ידני אחרי 2 שניות
      setTimeout(() => {
        if (!isSuccess) navigate('/'); 
      }, 2000);
    },
    onError: (err) => toast.error('שגיאה בשמירת נתונים: ' + err.message)
  });

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    if (!isAllWristbandsScanned) return;

    createSaleMutation.mutate({
      order_number: formData.orderNumber,
      departure_date: formData.departureDate,
      customer: formData.customerCount,
      requested_amount: totalPrice.toString(),
      eur_amount: totalPrice.toString(),
      eur_status: "0"
    });
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center" dir="rtl">
        <CheckCircle2 className="w-20 h-20 text-green-500 mb-4" />
        <h2 className="text-3xl font-bold mb-2">נשמר בהצלחה!</h2>
        <p className="text-slate-600 mb-8">הזמנה {formData.orderNumber} הועברה למערכת.</p>
        <Button className="w-full max-w-xs py-6 bg-indigo-600" onClick={() => window.location.href = window.location.href}>
          מכירה חדשה
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-80" dir="rtl">
      <div className="bg-white border-b p-4 sticky top-0 z-10 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-2 font-bold text-lg">
          <PartyPopper className="text-indigo-600" /> מכירה חדשה
        </div>
        <div className={`px-4 py-1 rounded-full text-sm font-black ${isAllWristbandsScanned ? 'bg-green-500 text-white' : 'bg-indigo-600 text-white'}`}>
           {scannedCount} / {maxCustomers} צמידים
        </div>
      </div>

      <div className="p-4 max-w-md mx-auto space-y-6">
        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="space-y-1">
              <Label className="text-slate-500">מספר הזמנה</Label>
              <Input type="number" className="text-lg py-6" value={formData.orderNumber} onChange={(e) => setFormData({...formData, orderNumber: e.target.value})} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-slate-500">תאריך</Label>
                <Input type="date" value={formData.departureDate} onChange={(e) => setFormData({...formData, departureDate: e.target.value})} />
              </div>
              <div className="space-y-1">
                <Label className="text-slate-500">כמות לקוחות</Label>
                <Input type="number" value={formData.customerCount} onChange={(e) => {
                  setFormData({...formData, customerCount: e.target.value});
                  setScannedCount(0);
                }} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-3 border-b"><CardTitle className="text-sm">מסיבות כלולות</CardTitle></CardHeader>
          <CardContent className="p-4 space-y-3">
            {isLoadingAttractions ? <Loader2 className="animate-spin mx-auto" /> : 
              attractions.map(att => (
                <div key={att.id} className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${selectedAttractions.has(att.id) ? 'border-indigo-500 bg-indigo-50' : 'border-slate-100'}`}>
                  <Checkbox checked={selectedAttractions.has(att.id)} onCheckedChange={() => {
                    const next = new Set(selectedAttractions);
                    next.has(att.id) ? next.delete(att.id) : next.add(att.id);
                    setSelectedAttractions(next);
                  }} />
                  <div className="flex-1 flex justify-between font-bold" onClick={() => {
                    const next = new Set(selectedAttractions);
                    next.has(att.id) ? next.delete(att.id) : next.add(att.id);
                    setSelectedAttractions(next);
                  }}>
                    <span>{att.name}</span>
                    <span className="text-indigo-600">€{att.price_eur}</span>
                  </div>
                </div>
              ))
            }
          </CardContent>
        </Card>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 shadow-[0_-10px_20px_rgba(0,0,0,0.05)] z-20">
        <div className="max-w-md mx-auto space-y-4">
          
          {!isAllWristbandsScanned ? (
            <Button 
              className={`w-full py-10 text-xl font-black border-4 rounded-2xl transition-all ${isScanning ? 'bg-green-500 border-green-200 animate-pulse text-white' : 'bg-white border-indigo-600 text-indigo-600'}`}
              onClick={handleNFCScan}
              disabled={isScanning || isProcessingScan}
            >
              {isScanning ? "הצמד צמיד עכשיו!" : `סרוק צמיד ${scannedCount + 1}`}
            </Button>
          ) : (
            <div className="py-6 bg-green-500 text-white text-center rounded-2xl font-bold text-lg flex items-center justify-center gap-2">
              <CheckCircle2 /> מוכן לשמירה סופית
            </div>
          )}

          <div className="flex justify-between items-center px-4 font-black text-xl">
            <span>סה"כ:</span>
            <span className="text-indigo-600">€{totalPrice.toFixed(2)}</span>
          </div>

          <Button 
            className={`w-full py-8 text-xl rounded-2xl shadow-xl transition-all ${isAllWristbandsScanned ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-400'}`}
            onClick={handleSubmit}
            disabled={createSaleMutation.isPending || !isAllWristbandsScanned}
          >
            {createSaleMutation.isPending ? <Loader2 className="animate-spin" /> : 
             !isAllWristbandsScanned ? <div className="flex items-center gap-2"><Lock className="w-5 h-5" /> חובה לסרוק {maxCustomers} צמידים</div> : "שמור וסיים מכירה"}
          </Button>
        </div>
      </div>
    </div>
  );
}