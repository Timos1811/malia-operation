import React, { useState, useRef, useMemo } from 'react';
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, CheckCircle2, ShieldAlert, PartyPopper, ScanLine, AlertTriangle, Users, Building2, Moon, Calendar, User } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

export default function NewSale() {
  // --- State: Order Details ---
  const [formData, setFormData] = useState({
    orderNumber: '',
    departureDate: '',
    customerCount: '1',
    nights: '',
    gender: 'mixed',
    hotel: '',
    company: ''
  });

  // --- State: Party Selection ---
  const [selectedAttractions, setSelectedAttractions] = useState(new Set());

  // --- State: Scanning Process ---
  const [isScanning, setIsScanning] = useState(false);
  const [scannedIds, setScannedIds] = useState(new Set());
  const [lastScanned, setLastScanned] = useState(null); // Feedback state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  
  const isProcessingRef = useRef(false);

  // --- Data Fetching ---
  const { data: attractions = [] } = useQuery({
    queryKey: ['attractions'],
    queryFn: () => base44.entities.Attraction.list(),
  });

  // --- Calculated Values ---
  const maxCustomers = parseInt(formData.customerCount) || 1;
  const scannedCount = scannedIds.size;
  const isAllWristbandsScanned = scannedCount >= maxCustomers;

  const totalPrice = useMemo(() => {
    let sum = 0;
    selectedAttractions.forEach(id => {
      const att = attractions.find(a => a.id === id);
      if (att) sum += (att.price_eur || 0);
    });
    return sum * maxCustomers;
  }, [selectedAttractions, maxCustomers, attractions]);

  // --- Handlers ---

  const playSound = (type = 'success') => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.frequency.setValueAtTime(type === 'success' ? 880 : 200, audioCtx.currentTime);
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + (type === 'success' ? 0.1 : 0.3));
    } catch (e) { console.error(e); }
  };

  const handleNFCScan = async () => {
    if (isAllWristbandsScanned) return;
    if (!formData.orderNumber) return toast.error("נא להזין מספר הזמנה");
    if (!('NDEFReader' in window)) return toast.error("דפדפן זה לא תומך ב-NFC");

    setIsScanning(true);
    try {
      const ndef = new NDEFReader();
      await ndef.scan();
      toast.info("מוכן לסריקה: הצמד צמיד...");

      ndef.onreading = async (event) => {
        const nfcId = event.serialNumber;

        // Prevent duplicate processing of the same tag in this session
        if (scannedIds.has(nfcId)) return;
        if (isProcessingRef.current) return;
        
        isProcessingRef.current = true;

        try {
          // STRICT CHECK: Is this wristband already in the DB?
          const existing = await base44.entities.Wristband.filter({ nfc_id: nfcId });
          
          if (existing.length > 0) {
            const usedWristband = existing[0];
            playSound('error');
            setLastScanned({
              status: 'error',
              id: nfcId,
              message: "צמיד זה כבר בשימוש!",
              details: `שייך להזמנה ${usedWristband.order_number}`
            });
            toast.error(`צמיד תפוס (הזמנה ${usedWristband.order_number})`);
            return;
          }

          // Register the wristband
          const selectedNames = Array.from(selectedAttractions)
            .map(id => attractions.find(a => a.id === id)?.name)
            .filter(Boolean);

          await base44.entities.Wristband.create({
            nfc_id: nfcId,
            order_number: formData.orderNumber.toString(),
            // Wristband only holds the parties link and the order link
            customer_name: `אורח ${scannedIds.size + 1}`, // Optional: internal numbering
            allowed_events: selectedNames
          });

          playSound('success');
          setScannedIds(prev => new Set(prev).add(nfcId));
          setLastScanned({
            status: 'success',
            id: nfcId,
            message: "צמיד שויך בהצלחה",
            details: `אורח ${scannedIds.size + 1} שויך להזמנה ${formData.orderNumber}`
          });
          toast.success("צמיד נוסף להזמנה");

        } catch (error) {
          console.error(error);
          toast.error("שגיאה ברישום הצמיד");
        } finally {
          isProcessingRef.current = false;
          if (scannedIds.size + 1 >= maxCustomers) setIsScanning(false);
        }
      };
    } catch (error) {
      console.error(error);
      setIsScanning(false);
      toast.error("שגיאה בהפעלת NFC");
    }
  };

  const handleFinishSale = async () => {
    if (!formData.orderNumber) return toast.error("חסר מספר הזמנה");
    setIsSubmitting(true);

    try {
      // Create the Order record (TableData) directly
      await base44.entities.TableData.create({
        order_number: formData.orderNumber.toString(),
        departure_date: formData.departureDate,
        customer: formData.customerCount.toString(),
        nights: formData.nights,
        gender: formData.gender,
        hotel: formData.hotel,
        company: formData.company,
        // Financials
        requested_amount: totalPrice.toString(),
        eur_amount: "", // Manual entry later
        shekel_amount: "",
        dollar_amount: "",
        bit_amount: "",
        eur_status: "0"
      });

      setIsSuccess(true);
    } catch (error) {
      console.error(error);
      toast.error("שגיאה בשמירת ההזמנה");
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center" dir="rtl">
        <CheckCircle2 className="w-24 h-24 text-green-500 mb-6" />
        <h1 className="text-3xl font-black text-slate-900 mb-2">המכירה הושלמה!</h1>
        <p className="text-slate-500 text-lg mb-8">
          הזמנה {formData.orderNumber} נשמרה עם {scannedIds.size} צמידים.
        </p>
        <Button 
          size="lg" 
          className="rounded-full font-bold text-lg px-8"
          onClick={() => window.location.reload()}
        >
          התחל מכירה חדשה
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-40" dir="rtl">
      {/* Header */}
      <div className="bg-white border-b p-4 sticky top-0 z-30 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-2 font-black text-xl text-slate-800">
          <PartyPopper className="text-indigo-600" /> מכירה חדשה
        </div>
        <div className={`px-4 py-1.5 rounded-full text-sm font-black flex items-center gap-2 ${isAllWristbandsScanned ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-700'}`}>
           <ScanLine className="w-4 h-4" /> {scannedCount} / {maxCustomers}
        </div>
      </div>

      <div className="max-w-xl mx-auto p-4 space-y-6">
        
        {/* Step 1: Order Details */}
        <Card className="border-none shadow-sm rounded-3xl overflow-hidden">
          <CardHeader className="bg-slate-900 text-white p-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <User className="w-5 h-5" /> פרטי הזמנה
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1">
              <Label className="text-xs text-slate-500">מספר הזמנה</Label>
              <Input 
                type="number" 
                className="text-lg font-bold bg-slate-50 border-slate-200"
                value={formData.orderNumber}
                onChange={e => setFormData({...formData, orderNumber: e.target.value})}
                placeholder="123456"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-slate-500">מספר לקוחות</Label>
              <Input 
                type="number" 
                value={formData.customerCount}
                onChange={e => {
                  setFormData({...formData, customerCount: e.target.value});
                  setScannedIds(new Set()); // Reset scans on count change to avoid confusion
                }}
                className="bg-slate-50 border-slate-200 font-bold"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-slate-500">תאריך עזיבה</Label>
              <Input 
                type="date" 
                value={formData.departureDate}
                onChange={e => setFormData({...formData, departureDate: e.target.value})}
                className="bg-slate-50 border-slate-200"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-slate-500">לילות</Label>
              <Input 
                type="number" 
                value={formData.nights}
                onChange={e => setFormData({...formData, nights: e.target.value})}
                className="bg-slate-50 border-slate-200"
                placeholder="7"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-slate-500">מגדר</Label>
              <Select 
                value={formData.gender} 
                onValueChange={val => setFormData({...formData, gender: val})}
              >
                <SelectTrigger className="bg-slate-50 border-slate-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mixed">מעורב</SelectItem>
                  <SelectItem value="male">גברים</SelectItem>
                  <SelectItem value="female">נשים</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-2 space-y-1">
              <Label className="text-xs text-slate-500">מלון</Label>
              <div className="relative">
                <Building2 className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <Input 
                  value={formData.hotel}
                  onChange={e => setFormData({...formData, hotel: e.target.value})}
                  className="bg-slate-50 border-slate-200 pl-10"
                  placeholder="שם המלון"
                />
              </div>
            </div>

            <div className="col-span-2 space-y-1">
              <Label className="text-xs text-slate-500">חברה / סוכן</Label>
              <Input 
                value={formData.company}
                onChange={e => setFormData({...formData, company: e.target.value})}
                className="bg-slate-50 border-slate-200"
                placeholder="שם החברה"
              />
            </div>
          </CardContent>
        </Card>

        {/* Step 2: Parties */}
        <div className="space-y-3">
          <h3 className="font-bold text-slate-700 px-1">בחירת מסיבות</h3>
          {attractions.map(att => (
            <div 
              key={att.id} 
              onClick={() => setSelectedAttractions(prev => {
                const next = new Set(prev);
                next.has(att.id) ? next.delete(att.id) : next.add(att.id);
                return next;
              })}
              className={`
                flex items-center gap-4 p-4 rounded-2xl border transition-all cursor-pointer
                ${selectedAttractions.has(att.id) 
                  ? 'bg-indigo-50 border-indigo-500 shadow-sm' 
                  : 'bg-white border-slate-100 hover:border-slate-300'
                }
              `}
            >
              <Checkbox 
                checked={selectedAttractions.has(att.id)} 
                className="w-5 h-5 rounded-full"
              />
              <div className="flex-1 flex justify-between items-center font-medium">
                <span>{att.name}</span>
                <span className="text-indigo-600 font-bold">€{att.price_eur}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Step 3: Scanning Feedback */}
        <AnimatePresence mode="wait">
          {lastScanned && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={`p-4 rounded-2xl border flex items-start gap-4 ${
                lastScanned.status === 'success' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
              }`}
            >
              <div className={`p-2 rounded-full ${
                lastScanned.status === 'success' ? 'bg-green-200 text-green-700' : 'bg-red-200 text-red-700'
              }`}>
                {lastScanned.status === 'success' ? <CheckCircle2 size={24} /> : <AlertTriangle size={24} />}
              </div>
              <div>
                <div className={`font-bold text-lg ${
                  lastScanned.status === 'success' ? 'text-green-800' : 'text-red-800'
                }`}>
                  {lastScanned.message}
                </div>
                <div className="text-slate-600 text-sm mt-1">{lastScanned.details}</div>
                <div className="text-slate-400 text-xs mt-1 font-mono">{lastScanned.id}</div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>

      {/* Footer / Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-lg border-t p-4 z-40 shadow-[0_-5px_20px_rgba(0,0,0,0.05)]">
        <div className="max-w-xl mx-auto space-y-4">
          
          {!isAllWristbandsScanned ? (
            <Button 
              className={`
                w-full py-8 text-xl font-black rounded-2xl shadow-lg transition-all
                ${isScanning 
                  ? 'bg-indigo-100 text-indigo-700 animate-pulse' 
                  : 'bg-indigo-600 text-white hover:bg-indigo-700'
                }
              `}
              onClick={handleNFCScan}
              disabled={isScanning}
            >
              {isScanning ? (
                <span className="flex items-center gap-2"><Loader2 className="animate-spin" /> סורק...</span>
              ) : (
                <span className="flex items-center gap-2"><ScanLine /> סרוק צמיד {scannedCount + 1}</span>
              )}
            </Button>
          ) : (
            <div className="w-full py-4 bg-green-50 text-green-700 rounded-2xl border border-green-200 text-center font-bold flex items-center justify-center gap-2">
              <ShieldAlert className="w-5 h-5" /> כל הצמידים שויכו
            </div>
          )}

          <div className="flex items-center justify-between px-2">
            <div>
              <span className="text-slate-400 text-xs block font-bold">סה"כ לתשלום</span>
              <span className="text-2xl font-black text-slate-800">€{totalPrice.toFixed(2)}</span>
            </div>
            
            <Button 
              className={`px-8 py-6 text-lg font-bold rounded-xl transition-all ${
                isAllWristbandsScanned && !isSubmitting
                  ? 'bg-slate-900 text-white shadow-xl hover:scale-105'
                  : 'bg-slate-100 text-slate-300 cursor-not-allowed'
              }`}
              onClick={handleFinishSale}
              disabled={!isAllWristbandsScanned || isSubmitting}
            >
              {isSubmitting ? <Loader2 className="animate-spin" /> : "סיים מכירה"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}