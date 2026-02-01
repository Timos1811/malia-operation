import React, { useState, useMemo } from 'react';
import { useQuery, useMutation } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Save, Calendar, Users, Hash, PartyPopper, CheckCircle2, AlertCircle, Radio, Lock } from "lucide-react";
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
  const [isSuccess, setIsSuccess] = useState(false);
  const [scannedCount, setScannedCount] = useState(0); 

  const { data: attractions = [], isLoading: isLoadingAttractions } = useQuery({
    queryKey: ['attractions'],
    queryFn: () => base44.entities.Attraction.list(),
  });

  const maxCustomers = parseInt(formData.customerCount) || 0;
  const isAllWristbandsScanned = scannedCount >= maxCustomers && maxCustomers > 0;

  // לוגיקת סריקה
  const handleNFCScan = async () => {
    if (!('NDEFReader' in window)) {
      toast.error("NFC לא נתמך בדפדפן זה");
      return;
    }

    if (scannedCount >= maxCustomers) {
      toast.error(`כבר סרקת את כל ${maxCustomers} הצמידים.`);
      return;
    }

    if (!formData.orderNumber) {
      toast.error("נא להזין מספר הזמנה לפני הסריקה");
      return;
    }

    setIsScanning(true);
    try {
      const ndef = new NDEFReader();
      await ndef.scan();
      toast.info("הסורק פעיל. הצמד צמיד...");

      ndef.onreading = async (event) => {
        const nfcId = event.serialNumber;

        try {
          // בדיקת כפילות ב-DB
          const existing = await base44.entities.Wristband.list({
            filter: { nfc_id: nfcId }
          });

          if (existing.length > 0) {
            toast.error("שגיאה: צמיד זה כבר רשום במערכת!");
            setIsScanning(false);
            return;
          }

          const selectedNames = Array.from(selectedAttractions)
            .map(id => attractions.find(a => a.id === id)?.name)
            .filter(Boolean);

          await base44.entities.Wristband.create({
            nfc_id: nfcId,
            order_number: formData.orderNumber.toString(),
            customer_name: `לקוח ${scannedCount + 1} בהזמנה ${formData.orderNumber}`,
            allowed_events: selectedNames
          });

          setScannedCount(prev => prev + 1);
          toast.success(`צמיד שויך! (${scannedCount + 1}/${maxCustomers})`);
          setIsScanning(false);
        } catch (dbError) {
          toast.error("שגיאה בתקשורת: " + dbError.message);
          setIsScanning(false);
        }
      };
    } catch (err) {
      toast.error("שגיאה בהפעלת NFC: " + err.message);
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
    onSuccess: () => setIsSuccess(true),
    onError: (err) => toast.error('שגיאה בשמירה: ' + err.message)
  });

  const handleSubmit = () => {
    if (!isAllWristbandsScanned) {
      toast.error(`חובה לסרוק ${maxCustomers} צמידים לפני שמירת ההזמנה!`);
      return;
    }

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
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center" dir="rtl">
        <div className="bg-white p-8 rounded-3xl shadow-xl max-w-sm w-full space-y-6 border-t-4 border-green-500">
          <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto" />
          <h2 className="text-2xl font-bold">הזמנה הושלמה!</h2>
          <p className="text-slate-500">מספר הזמנה {formData.orderNumber} נשמר עם {scannedCount} צמידים.</p>
          <Button className="w-full bg-slate-900 py-6" onClick={() => window.location.reload()}>מכירה חדשה</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-80" dir="rtl">
      <div className="bg-white border-b p-4 sticky top-0 z-10 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-2">
          <PartyPopper className="text-indigo-600" />
          <h1 className="text-xl font-bold">מכירה חדשה</h1>
        </div>
        <div className={`px-3 py-1 rounded-full text-sm font-bold ${isAllWristbandsScanned ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
           צמידים: {scannedCount} / {maxCustomers}
        </div>
      </div>

      <div className="p-4 max-w-md mx-auto space-y-6">
        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="space-y-2">
              <Label>מספר הזמנה</Label>
              <Input type="number" value={formData.orderNumber} onChange={(e) => setFormData({...formData, orderNumber: e.target.value})} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>תאריך עזיבה</Label>
                <Input type="date" value={formData.departureDate} onChange={(e) => setFormData({...formData, departureDate: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>כמות לקוחות (צמידים)</Label>
                <Input 
                  type="number" 
                  value={formData.customerCount} 
                  onChange={(e) => {
                    setFormData({...formData, customerCount: e.target.value});
                    setScannedCount(0); // איפוס סריקות אם כמות הלקוחות משתנה
                  }} 
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="bg-slate-50/50 border-b py-3 px-4">
            <CardTitle className="text-sm">בחירת מסיבות לכלול בצמיד</CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            {isLoadingAttractions ? <Loader2 className="animate-spin mx-auto" /> : 
              attractions.map(att => (
                <div key={att.id} className={`flex items-center gap-3 p-3 rounded-lg border ${selectedAttractions.has(att.id) ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200'}`}>
                  <Checkbox checked={selectedAttractions.has(att.id)} onCheckedChange={() => {
                    const next = new Set(selectedAttractions);
                    next.has(att.id) ? next.delete(att.id) : next.add(att.id);
                    setSelectedAttractions(next);
                  }} />
                  <div className="flex-1 flex justify-between font-medium">
                    <span>{att.name}</span>
                    <span>€{att.price_eur}</span>
                  </div>
                </div>
              ))
            }
          </CardContent>
        </Card>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 shadow-2xl z-20">
        <div className="max-w-md mx-auto space-y-3">
          
          {/* כפתור סריקה */}
          {!isAllWristbandsScanned ? (
            <Button 
              variant="outline"
              className={`w-full py-8 text-lg border-2 ${isScanning ? 'border-green-500 bg-green-50 animate-pulse' : 'border-indigo-200 text-indigo-700'}`}
              onClick={handleNFCScan}
              disabled={isScanning}
            >
              {isScanning ? "ממתין לסריקה..." : `סרוק צמיד ${scannedCount + 1} מתוך ${maxCustomers}`}
            </Button>
          ) : (
            <div className="flex items-center justify-center gap-2 p-4 bg-green-50 text-green-700 rounded-lg border border-green-200 font-bold">
              <CheckCircle2 className="w-5 h-5" />
              כל {maxCustomers} הצמידים שויכו
            </div>
          )}

          <div className="flex justify-between items-center px-4 py-2 bg-slate-50 rounded border font-bold">
            <span>סה"כ לתשלום:</span>
            <span className="text-xl text-indigo-600">€{totalPrice.toFixed(2)}</span>
          </div>

          {/* כפתור שמירה סופית - חסום עד שכל הצמידים נסרקו */}
          <Button 
            className={`w-full py-7 text-lg shadow-lg transition-all ${isAllWristbandsScanned ? 'bg-slate-900 opacity-100' : 'bg-slate-300 cursor-not-allowed opacity-70'}`}
            onClick={handleSubmit}
            disabled={createSaleMutation.isPending || !isAllWristbandsScanned}
          >
            {createSaleMutation.isPending ? (
              <Loader2 className="animate-spin" />
            ) : !isAllWristbandsScanned ? (
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4" />
                חסר עוד {maxCustomers - scannedCount} צמידים
              </div>
            ) : (
              "שמור הזמנה וסיים"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}