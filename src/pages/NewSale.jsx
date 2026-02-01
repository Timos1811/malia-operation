import React, { useState, useMemo } from 'react';
import { useQuery, useMutation } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Save, Calendar, Users, Hash, PartyPopper, Radio, CheckCircle2, ArrowRight } from "lucide-react";
import { toast } from "sonner";

export default function NewSale() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    orderNumber: '',
    departureDate: '',
    customerCount: '1',
    nights: '',
    gender: '',
    hotel: ''
  });
  const [selectedAttractions, setSelectedAttractions] = useState(new Set());
  const [isScanning, setIsScanning] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false); // לניהול מסך "הזמנה נשמרה"

  const { data: attractions = [], isLoading: isLoadingAttractions } = useQuery({
    queryKey: ['attractions'],
    queryFn: () => base44.entities.Attraction.list(),
  });

  // --- לוגיקת NFC עם בדיקת כפילויות ---
  const handleNFCScan = async () => {
    if (!('NDEFReader' in window)) {
      toast.error("NFC לא נתמך בדפדפן זה.");
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
      toast.info("ממתין לצמיד...");

      ndef.onreading = async (event) => {
        const nfcId = event.serialNumber;

        try {
          // בדיקה האם הצמיד כבר קיים במערכת
          const existingWristbands = await base44.entities.Wristband.list({
            filter: { nfc_id: nfcId }
          });

          if (existingWristbands.length > 0) {
            toast.error(`צמיד זה (${nfcId}) כבר רשום במערכת!`);
            setIsScanning(false);
            return;
          }

          const selectedNames = Array.from(selectedAttractions)
            .map(id => attractions.find(a => a.id === id)?.name)
            .filter(Boolean);

          await base44.entities.Wristband.create({
            nfc_id: nfcId,
            order_number: formData.orderNumber.toString(),
            customer_name: `לקוח ${formData.orderNumber}`,
            allowed_events: selectedNames
          });

          toast.success("הצמיד שויך בהצלחה!");
          setIsScanning(false);
        } catch (dbError) {
          toast.error("שגיאה בבדיקה או שמירה: " + dbError.message);
          setIsScanning(false);
        }
      };
    } catch (err) {
      toast.error("שגיאה בסריקה: " + err.message);
      setIsScanning(false);
    }
  };

  const { totalPrice } = useMemo(() => {
    let sum = 0;
    selectedAttractions.forEach(id => {
      const att = attractions.find(a => a.id === id);
      if (att) sum += (att.price_eur || 0);
    });
    return { totalPrice: sum * (parseInt(formData.customerCount) || 0) };
  }, [selectedAttractions, formData.customerCount, attractions]);

  const createSaleMutation = useMutation({
    mutationFn: (data) => base44.entities.TableData.create(data),
    onSuccess: () => {
      setIsSuccess(true); // מעבר למסך הצלחה
    },
    onError: (err) => toast.error('שגיאה בשמירה: ' + err.message)
  });

  const handleSubmit = () => {
    if (!formData.orderNumber) return toast.error('חסר מספר הזמנה');
    createSaleMutation.mutate({
      order_number: formData.orderNumber,
      departure_date: formData.departureDate,
      customer: formData.customerCount,
      requested_amount: totalPrice.toString(),
      eur_amount: totalPrice.toString(),
      eur_status: "0"
    });
  };

  // --- תצוגת מסך "הזמנה נשמרה" ---
  if (isSuccess) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center" dir="rtl">
        <div className="bg-white p-8 rounded-3xl shadow-xl border border-green-100 max-w-sm w-full space-y-6">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-12 h-12 text-green-600" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-slate-900">ההזמנה נשמרה!</h2>
            <p className="text-slate-500">מספר הזמנה: {formData.orderNumber}</p>
          </div>
          <div className="pt-4 space-y-3">
            <Button className="w-full bg-slate-900 py-6" onClick={() => window.location.reload()}>
              מכירה חדשה
            </Button>
            <Button variant="outline" className="w-full py-6" onClick={() => navigate(-1)}>
              חזרה לרשימה
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-80" dir="rtl">
      <div className="bg-white border-b p-4 sticky top-0 z-10 shadow-sm flex items-center gap-2">
        <PartyPopper className="text-indigo-600" />
        <h1 className="text-xl font-bold">מכירה חדשה</h1>
      </div>

      <div className="p-4 max-w-md mx-auto space-y-6">
        <Card className="border-slate-200">
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
                <Label>כמות לקוחות</Label>
                <Input type="number" value={formData.customerCount} onChange={(e) => setFormData({...formData, customerCount: e.target.value})} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader className="bg-slate-50/50 border-b">
            <CardTitle className="text-sm">בחירת מסיבות</CardTitle>
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

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 shadow-2xl z-20 space-y-3">
        <div className="max-w-md mx-auto space-y-3">
          <Button 
            variant="outline"
            className={`w-full py-8 text-lg border-2 ${isScanning ? 'border-green-500 bg-green-50 animate-pulse' : 'border-indigo-200 text-indigo-700'}`}
            onClick={handleNFCScan}
            disabled={isScanning}
          >
            {isScanning ? "ממתין לסריקה..." : "1. סרוק צמיד NFC"}
          </Button>

          <div className="flex justify-between items-center px-4 py-2 bg-slate-50 rounded border font-bold">
            <span>סה"כ לתשלום:</span>
            <span className="text-xl text-indigo-600">€{totalPrice.toFixed(2)}</span>
          </div>

          <Button 
            className="w-full bg-slate-900 py-7 text-lg shadow-lg"
            onClick={handleSubmit}
            disabled={createSaleMutation.isPending}
          >
            {createSaleMutation.isPending ? <Loader2 className="animate-spin" /> : "2. שמור הזמנה סופית"}
          </Button>
        </div>
      </div>
    </div>
  );
}