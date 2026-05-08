import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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
    gender: 'mixed',
    hotel: '',
    company: ''
  });

  // --- State: Party Selection ---
  const [selectedAttractions, setSelectedAttractions] = useState(new Set());
  const [attractionDates, setAttractionDates] = useState({});

  // --- State: Scanning Process ---
  const [isScanning, setIsScanning] = useState(false);
  const [scannedIds, setScannedIds] = useState(new Set());
  const [lastScanned, setLastScanned] = useState(null); // Feedback state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  
  const isProcessingRef = useRef(false);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const user = await base44.auth.me();
        setCurrentUser(user);
      } catch (e) {
        console.error("Failed to fetch user", e);
      }
    };
    fetchUser();
  }, []);

  // --- Data Fetching ---
  const { data: attractions = [] } = useQuery({
    queryKey: ['attractions'],
    queryFn: () => base44.entities.Attraction.list(),
  });

  const { data: hotels = [] } = useQuery({
    queryKey: ['hotels'],
    queryFn: () => base44.entities.Hotel.list(),
  });

  const { data: comboPriceSetting } = useQuery({
    queryKey: ['appSettings', 'combo_price_eur'],
    queryFn: async () => {
        const settings = await base44.entities.AppSetting.filter({ key: 'combo_price_eur' });
        return settings[0]?.value || '550';
    },
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });

  // --- Calculated Values ---
  const maxCustomers = parseInt(formData.customerCount) || 1;
  const scannedCount = scannedIds.size;
  const isAllWristbandsScanned = scannedCount >= maxCustomers;
  
  const comboPrice = parseFloat(comboPriceSetting) || 550;
  const isCombo = attractions.length > 0 && selectedAttractions.size === attractions.length;

  const totalPrice = useMemo(() => {
    if (attractions.length > 0 && selectedAttractions.size === attractions.length) {
      return comboPrice * maxCustomers;
    }
    
    let sum = 0;
    selectedAttractions.forEach(id => {
      const att = attractions.find(a => a.id === id);
      if (att) sum += (att.price_eur || 0);
    });
    return sum * maxCustomers;
  }, [selectedAttractions, maxCustomers, attractions, comboPrice]);

  // --- Handlers ---

  const checkOrderDuplicate = async () => {
    if (!formData.orderNumber || formData.orderNumber.length < 3) return false;
    
    try {
      const existingPending = await base44.entities.PendingSale.filter({ order_number: formData.orderNumber.toString() });
      const existingTable = await base44.entities.TableData.filter({ order_number: formData.orderNumber.toString() });

      if (existingPending.length > 0 || existingTable.length > 0) {
        toast.error("מספר הזמנה זה כבר קיים במערכת!");
        return true;
      }
    } catch (e) {
      console.error("Error checking duplicates", e);
    }
    return false;
  };

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
      const ndef = new window.NDEFReader();
      await ndef.scan();
      toast.info("מוכן לסריקה: הצמד צמיד...");

      ndef.onreading = async (event) => {
        // Remove colons and normalize to lowercase
        const nfcId = event.serialNumber.replace(/:/g, "").toLowerCase();

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
            .map(id => {
                const att = attractions.find(a => a.id === id);
                if (!att) return null;
                const date = attractionDates[id];
                return date ? `${att.name} - ${date.split('-').reverse().join('/')}` : att.name;
            })
            .filter(Boolean);

          await base44.entities.Wristband.create({
            nfc_id: nfcId,
            order_number: formData.orderNumber.toString(),
            // Wristband only holds the parties link and the order link
            customer_name: `אורח ${scannedIds.size + 1}`, // Optional: internal numbering
            allowed_events: selectedNames,
            status: 'active',
            valid_until: formData.departureDate // Set expiration from form
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
      // Check for duplicate order number
      const existingPending = await base44.entities.PendingSale.filter({ order_number: formData.orderNumber.toString() });
      const existingTable = await base44.entities.TableData.filter({ order_number: formData.orderNumber.toString() });

      if (existingPending.length > 0 || existingTable.length > 0) {
        toast.error("מספר הזמנה זה כבר קיים במערכת!");
        setIsSubmitting(false);
        return;
      }

      // מיפוי ערכי מגדר לעברית
      const genderMap = {
        'male': 'גברים',
        'female': 'נשים',
        'mixed': 'מעורב'
      };

      // Calculate nights based on departure date vs today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const departure = new Date(formData.departureDate);
      departure.setHours(0, 0, 0, 0);
      const diffTime = departure - today;
      const calculatedNights = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24))).toString();

      // Create new row data with precise mapping
      const newRow = {
        order_number: formData.orderNumber.toString(),
        departure_date: formData.departureDate, // פורמט YYYY-MM-DD מתאים גם לטבלה
        customer: formData.customerCount.toString(),
        nights: calculatedNights,
        gender: genderMap[formData.gender] || formData.gender, // המרה לעברית
        hotel: formData.hotel,
        company: formData.company,
        requested_amount: totalPrice.toString(),
        eur_amount: "",
        shekel_amount: "",
        dollar_amount: "",
        bit_amount: "",
        eur_status: "0",
        timestamp: Date.now(),
        sales_rep: currentUser?.full_name || '',
        is_combo: isCombo
      };

      // Create the pending sale in the database
      await base44.entities.PendingSale.create(newRow);
      
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
                onBlur={checkOrderDuplicate}
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
                <Building2 className="absolute left-3 top-2.5 w-4 h-4 text-slate-400 z-10" />
                <Select 
                  value={formData.hotel} 
                  onValueChange={val => setFormData({...formData, hotel: val})}
                >
                  <SelectTrigger className="bg-slate-50 border-slate-200 pl-10">
                    <SelectValue placeholder="בחר מלון" />
                  </SelectTrigger>
                  <SelectContent>
                    {hotels.map(h => (
                        <SelectItem key={h.id} value={h.name}>{h.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="col-span-2 space-y-1">
              <Label className="text-xs text-slate-500">חברה</Label>
              <Select 
                value={formData.company} 
                onValueChange={val => setFormData({...formData, company: val})}
              >
                <SelectTrigger className="bg-slate-50 border-slate-200">
                  <SelectValue placeholder="בחר חברה" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ק">ק - קשרי תעופה</SelectItem>
                  <SelectItem value="נ">נ - נטו פאן</SelectItem>
                  <SelectItem value="כ">כ - כספר</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Step 2: Parties */}
        <div className="space-y-3">
          <h3 className="font-bold text-slate-700 px-1">בחירת מסיבות ותאריכים</h3>
          {attractions.map(att => {
            const isSelected = selectedAttractions.has(att.id);
            return (
            <div key={att.id} className={`flex flex-col gap-3 p-4 rounded-2xl border transition-all ${isSelected ? 'bg-indigo-50 border-indigo-500 shadow-sm' : 'bg-white border-slate-100 hover:border-slate-300'}`}>
              <div 
                onClick={() => setSelectedAttractions(prev => {
                  const next = new Set(prev);
                  next.has(att.id) ? next.delete(att.id) : next.add(att.id);
                  return next;
                })}
                className="flex items-center gap-4 cursor-pointer"
              >
                <Checkbox 
                  checked={isSelected} 
                  className="w-5 h-5 rounded-full"
                />
                <div className="flex-1 flex justify-between items-center font-medium">
                  <span>{att.name}</span>
                  <span className="text-indigo-600 font-bold">€{att.price_eur}</span>
                </div>
              </div>
              
              {isSelected && (
                <div className="pl-9 pr-2 pb-2">
                    <Label className="text-xs text-slate-500 mb-1 block">תאריך האירוע הספציפי בשבוע זה:</Label>
                    <Input 
                        type="date" 
                        value={attractionDates[att.id] || ''} 
                        onChange={(e) => setAttractionDates(prev => ({ ...prev, [att.id]: e.target.value }))}
                        className="bg-white border-indigo-200"
                    />
                </div>
              )}
            </div>
          )})}
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
              <div className="flex items-center gap-2">
                <span className="text-2xl font-black text-slate-800">€{totalPrice.toFixed(2)}</span>
                {isCombo && (
                  <span className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white text-xs px-2 py-0.5 rounded-full font-bold shadow-sm animate-pulse">
                    COMBO DEAL!
                  </span>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-2">
                <Dialog>
                    <DialogTrigger asChild>
                        <Button variant="outline" className="px-4 py-6 border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl font-bold">
                             Bit
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md text-center" dir="rtl">
                        <DialogHeader>
                            <DialogTitle className="text-center text-xl font-bold mb-4">תשלום ב-Bit</DialogTitle>
                        </DialogHeader>
                        <div className="flex flex-col items-center justify-center gap-4 py-4">
                            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                                <img 
                                    src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(
                                        (formData.orderNumber && formData.orderNumber.toString().startsWith('1'))
                                            ? 'https://pay.grow.link/a6830cb14a28eaeef475543c247832d5-MjMzNTY1Ng'
                                            : 'https://meshulam.co.il/quick_payment?b=0889ba79bc44fc854df0bf7d7e596601'
                                    )}`} 
                                    alt="Bit QR Code" 
                                    className="w-48 h-48 object-contain"
                                />
                            </div>
                            <p className="text-slate-500 text-sm">סרוק את הברקוד לתשלום מהיר</p>
                            <a 
                                href={(formData.orderNumber && formData.orderNumber.toString().startsWith('1'))
                                    ? 'https://pay.grow.link/a6830cb14a28eaeef475543c247832d5-MjMzNTY1Ng'
                                    : 'https://meshulam.co.il/quick_payment?b=0889ba79bc44fc854df0bf7d7e596601'} 
                                target="_blank" 
                                rel="noreferrer"
                                className="text-blue-600 hover:underline text-sm font-medium"
                            >
                                לחץ כאן למעבר ישיר לאפליקציה
                            </a>
                        </div>
                    </DialogContent>
                </Dialog>

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
    </div>
  );
}