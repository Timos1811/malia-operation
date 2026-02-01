import React, { useState, useMemo } from 'react';
import { useQuery, useMutation } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Save, Calendar, Users, Hotel, Moon, Hash, User, PartyPopper, Radio, Check } from "lucide-react";
import { toast } from "sonner";
import { createPageUrl } from '../utils';

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
  const [scannedCount, setScannedCount] = useState(0);

  // טעינת מסיבות
  const { data: attractions = [], isLoading: isLoadingAttractions } = useQuery({
    queryKey: ['attractions'],
    queryFn: () => base44.entities.Attraction.list(),
  });

  // --- פונקציית NFC מעודכנת לשם הישות Wristband ---
  const handleNFCScan = async () => {
    if (!('NDEFReader' in window)) {
      toast.error("NFC לא נתמך בדפדפן זה. השתמש בכרום באנדרואיד.");
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
      toast.info("הסורק פעיל. קרב את הצמיד...");

      ndef.onreading = async (event) => {
        const nfcId = event.serialNumber;

        // בניית מערך שמות המסיבות שנבחרו
        const selectedNames = Array.from(selectedAttractions)
          .map(id => attractions.find(a => a.id === id)?.name)
          .filter(Boolean);

        try {
          // שים לב: שיניתי ל-Wristband (בדיוק לפי ה-Schema שלך)
          await base44.entities.Wristband.create({
            nfc_id: nfcId,
            order_number: formData.orderNumber.toString(), // וודא שזה מחרוזת
            customer_name: `לקוח מהזמנה ${formData.orderNumber}`,
            allowed_events: selectedNames // נשלח כמערך של מחרוזות
          });

          setScannedCount(prev => {
            const newCount = prev + 1;
            const total = parseInt(formData.customerCount) || 1;
            if (newCount < total) {
              toast.info(`צמיד נקלט (${newCount}/${total}). נא לסרוק את הצמיד הבא.`);
            } else {
              toast.success(`כל הצמידים שוייכו בהצלחה! (${newCount}/${total})`);
            }
            return newCount;
          });
          
          setIsScanning(false);
        } catch (dbError) {
          console.error("Database Save Error:", dbError);
          toast.error("שגיאה בשמירה למערכת: " + dbError.message);
          setIsScanning(false);
        }
      };
    } catch (scanError) {
      console.error("NFC Scan Error:", scanError);
      toast.error("שגיאה בסריקה: " + scanError.message);
      setIsScanning(false);
    }
  };

  // חישוב מחירים
  const { totalPrice, pricePerPerson } = useMemo(() => {
    const customerCount = parseInt(formData.customerCount) || 0;
    let attractionsSum = 0;
    selectedAttractions.forEach(id => {
      const att = attractions.find(a => a.id === id);
      if (att) attractionsSum += (att.price_eur || 0);
    });
    return { totalPrice: attractionsSum * customerCount, pricePerPerson: attractionsSum };
  }, [selectedAttractions, formData.customerCount, attractions]);

  // שמירת ההזמנה הכללית (TableData)
  const createSaleMutation = useMutation({
    mutationFn: async (data) => {
      // בדיקה אם ההזמנה כבר קיימת (למנוע כפילויות)
      const existing = await base44.entities.TableData.filter({ order_number: data.order_number });
      if (existing && existing.length > 0) {
        throw new Error("מספר הזמנה זה כבר קיים במערכת!");
      }
      return base44.entities.TableData.create(data);
    },
    onSuccess: () => {
      toast.success('ההזמנה נשמרה בהצלחה! המסך אופס.');
      // איפוס הטופס והסטייט במקום ניווט
      setFormData({
        orderNumber: '',
        departureDate: '',
        customerCount: '1',
        nights: '',
        gender: '',
        hotel: ''
      });
      setSelectedAttractions(new Set());
      setScannedCount(0);
      setIsScanning(false);
      window.scrollTo(0, 0);
    },
    onError: (err) => toast.error('שגיאה בשמירת הזמנה: ' + err.message)
  });

  const handleToggleAttraction = (id) => {
    const next = new Set(selectedAttractions);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelectedAttractions(next);
  };

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    if (!formData.orderNumber) {
      toast.error('נא להזין מספר הזמנה');
      return;
    }
    
    createSaleMutation.mutate({
      order_number: formData.orderNumber,
      departure_date: formData.departureDate,
      customer: formData.customerCount,
      nights: formData.nights,
      gender: formData.gender,
      hotel: formData.hotel,
      requested_amount: totalPrice.toString(),
      eur_amount: totalPrice.toString(),
      eur_status: "0"
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-80" dir="rtl">
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10 px-4 py-4 shadow-sm">
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <PartyPopper className="w-5 h-5 text-indigo-600" />
          מכירה וצימוד צמידים
        </h1>
      </div>

      <div className="p-4 max-w-md mx-auto space-y-6">
        <Card className="border-slate-200">
          <CardHeader className="bg-slate-50/50 border-b">
            <CardTitle className="text-lg">פרטי הזמנה</CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            <div className="space-y-2">
              <Label>מספר הזמנה</Label>
              <Input
                type="number"
                value={formData.orderNumber}
                onChange={(e) => setFormData({...formData, orderNumber: e.target.value})}
              />
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
            <CardTitle className="text-lg">בחירת מסיבות</CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            {isLoadingAttractions ? <Loader2 className="animate-spin mx-auto" /> : 
              attractions.map(att => (
                <div key={att.id} className={`flex items-center gap-3 p-3 rounded-lg border ${selectedAttractions.has(att.id) ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200'}`}>
                  <Checkbox checked={selectedAttractions.has(att.id)} onCheckedChange={() => handleToggleAttraction(att.id)} />
                  <div className="flex-1 flex justify-between" onClick={() => handleToggleAttraction(att.id)}>
                    <span className="font-medium">{att.name}</span>
                    <span className="font-bold">€{att.price_eur}</span>
                  </div>
                </div>
              ))
            }
          </CardContent>
        </Card>
      </div>

      {/* Footer עם כפתור סריקה */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 shadow-lg z-20">
        <div className="max-w-md mx-auto space-y-3">
          
          <Button 
            variant="outline"
            className={`w-full py-8 text-lg border-2 relative ${
              isScanning 
                ? 'border-green-500 bg-green-50 animate-pulse' 
                : scannedCount > 0
                  ? 'border-green-600 text-green-700 bg-green-50'
                  : 'border-indigo-200 text-indigo-700'
            }`}
            onClick={() => handleNFCScan()}
            disabled={isScanning}
          >
            {isScanning ? (
              "ממתין לסריקה..."
            ) : scannedCount > 0 ? (
              <div className="flex items-center gap-2">
                 <Check className="w-6 h-6" />
                 <span>
                   {scannedCount < (parseInt(formData.customerCount) || 1) 
                     ? `צמיד ${scannedCount} נקלט - לחץ לסרוק את הבא` 
                     : `כל ${scannedCount} הצמידים צומדו בהצלחה!`}
                 </span>
              </div>
            ) : (
              "1. סרוק וצמד צמיד"
            )}
          </Button>

          <div className="flex justify-between items-center px-4 py-2 bg-slate-50 rounded border">
            <span className="text-sm font-bold">סה"כ:</span>
            <span className="text-xl font-black text-indigo-600">€{totalPrice.toFixed(2)}</span>
          </div>

          <Button 
            className="w-full bg-slate-900 py-6 text-lg"
            onClick={handleSubmit}
            disabled={createSaleMutation.isPending}
          >
            2. שמור הזמנה סופית
          </Button>
        </div>
      </div>
    </div>
  );
}