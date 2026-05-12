import React, { useState, useRef, useEffect } from 'react';
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RefreshCcw, ScanLine, Keyboard, ArrowLeft, CheckCircle2, Loader2, AlertTriangle, Search } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

export default function SwapWristband() {
  const [currentUser, setCurrentUser] = useState(null);
  
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

  const [mode, setMode] = useState('scan'); // 'scan' | 'manual'
  const [step, setStep] = useState(1); // 1: Find Old, 2: Get New, 3: Success
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  
  // Data State
  const [oldWristband, setOldWristband] = useState(null);
  const [newWristbandId, setNewWristbandId] = useState('');
  const [manualOldId, setManualOldId] = useState('');
  const [feedback, setFeedback] = useState(null);

  const scanLockRef = useRef(false);
  const ndefRef = useRef(null);

  // --- Logic ---

  const handleScan = async (targetStep) => {
    if (!('NDEFReader' in window)) return toast.error("דפדפן זה לא תומך ב-NFC");
    
    setScanning(true);
    try {
      if (!ndefRef.current) {
        ndefRef.current = new window.NDEFReader();
      }
      const ndef = ndefRef.current;
      await ndef.scan();
      toast.info(targetStep === 1 ? "קרב צמיד ישן..." : "קרב צמיד חדש...");

      ndef.onreading = async (event) => {
        if (scanLockRef.current) return;
        scanLockRef.current = true;
        
        // Remove colons from the serial number and normalize
        const serialNumber = event.serialNumber.replace(/:/g, "").toLowerCase();
        
        try {
          if (targetStep === 1) {
            await findOldWristband(serialNumber);
          } else {
            await validateNewWristband(serialNumber);
          }
        } finally {
          scanLockRef.current = false;
          setScanning(false);
        }
      };
    } catch (error) {
      console.error(error);
      toast.error("שגיאה בהפעלת NFC");
      setScanning(false);
    }
  };

  const findOldWristband = async (id) => {
    setLoading(true);
    setFeedback(null);
    try {
      let results = await base44.entities.Wristband.filter({ nfc_id: id });
      if (results.length === 0) {
        results = await base44.entities.Wristband.filter({ nfc_id: id.toUpperCase() });
      }
      
      if (results.length === 0) {
        const msg = "צמיד לא משויך לקבוצה";
        const det = `הצמיד ${id} אינו קיים במערכת`;
        toast.error(msg);
        setFeedback({ type: 'error', message: msg, details: det });
        playSound('error');
        setLoading(false);
        return;
      }
      setOldWristband(results[0]);
      setStep(2);
      setFeedback(null);
      playSound('success');
    } catch (error) {
      toast.error("שגיאה בחיפוש צמיד");
    } finally {
      setLoading(false);
    }
  };

  const validateNewWristband = async (id) => {
    setFeedback(null);
    if (id === oldWristband.nfc_id) {
        const msg = "שגיאה: זהו אותו צמיד";
        const det = "לא ניתן להחליף צמיד בעצמו. יש לסרוק צמיד חדש וריק.";
        toast.error(msg);
        setFeedback({ type: 'error', message: msg, details: det });
        playSound('error');
        return;
    }

    setLoading(true);
    try {
      let exists = await base44.entities.Wristband.filter({ nfc_id: id });
      if (exists.length === 0) {
        exists = await base44.entities.Wristband.filter({ nfc_id: id.toUpperCase() });
      }
      
      if (exists.length > 0) {
        const existingWb = exists[0];
        const hasEvents = existingWb.allowed_events && existingWb.allowed_events.length > 0;
        
        const msg = hasEvents ? "הצמיד כבר מכיל אירועים" : "הצמיד כבר בשימוש";
        const det = hasEvents 
            ? `הצמיד מכיל ${existingWb.allowed_events.length} אירועים ושייך להזמנה ${existingWb.order_number}`
            : `הצמיד משויך להזמנה ${existingWb.order_number}`;

        toast.error(msg);
        setFeedback({ type: 'error', message: msg, details: det });
        playSound('error');
        setLoading(false);
        return;
      }
      
      setNewWristbandId(id);
      await performSwap(id);
    } catch (error) {
      toast.error("שגיאה בבדיקת צמיד חדש");
      setLoading(false);
    }
  };

  const performSwap = async (targetNewId) => {
    try {
      // 1. Create new wristband with old data
      await base44.entities.Wristband.create({
        nfc_id: targetNewId,
        order_number: oldWristband.order_number,
        customer_name: oldWristband.customer_name,
        allowed_events: oldWristband.allowed_events,
        status: 'active',
        valid_until: oldWristband.valid_until // Copy expiration date
      });

      // 2. Mark old wristband as inactive (instead of deleting)
      await base44.entities.Wristband.update(oldWristband.id, {
        status: 'inactive'
      });

      // 3. Create PendingSale record for the swap fee
      try {
        await base44.entities.PendingSale.create({
          order_number: oldWristband.order_number,
          requested_amount: "10",
          sales_rep: currentUser?.full_name || '',
          comments: "החלפת צמיד",
          // Minimal required fields with empty values
          customer: "",
          nights: "",
          gender: "",
          hotel: "",
          company: "",
          eur_amount: "",
          shekel_amount: "",
          dollar_amount: "",
          bit_amount: "",
          eur_status: ""
        });
      } catch (e) {
        console.error("Failed to create pending sale record", e);
        toast.error("נכשל ברישום חיוב החלפה");
      }

      setStep(3);
      playSound('success');
      toast.success("הצמיד הוחלף בהצלחה!");
      if (ndefRef.current) {
        ndefRef.current.onreading = null;
      }
    } catch (error) {
      console.error(error);
      toast.error("שגיאה בביצוע ההחלפה");
    } finally {
      setLoading(false);
    }
  };

  const resetProcess = () => {
    setStep(1);
    setOldWristband(null);
    setNewWristbandId('');
    setManualOldId('');
    setScanning(false);
    setFeedback(null);
    if (ndefRef.current) {
      ndefRef.current.onreading = null;
    }
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

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8" dir="rtl">
      <div className="max-w-2xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between">
            <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                <RefreshCcw className="text-indigo-600" />
                החלפת צמיד
            </h1>
            <Button variant="outline" onClick={() => window.history.back()}>
                חזרה
            </Button>
        </div>

        {/* Success State */}
        {step === 3 ? (
            <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-white rounded-3xl p-8 text-center shadow-lg border border-green-100"
            >
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CheckCircle2 className="w-10 h-10 text-green-600" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 mb-2">ההחלפה בוצעה!</h2>
                <p className="text-slate-500 mb-8">
                    הצמיד הישן בוטל והמידע הועבר לצמיד החדש בהצלחה.
                </p>
                <div className="bg-slate-50 rounded-xl p-4 mb-8 text-right max-w-xs mx-auto">
                    <div className="text-xs text-slate-400 mb-1">מספר צמיד חדש</div>
                    <div className="font-mono font-bold text-slate-800 break-all">{newWristbandId}</div>
                </div>
                <Button size="lg" onClick={resetProcess} className="w-full bg-slate-900 text-white rounded-xl">
                    בצע החלפה נוספת
                </Button>
            </motion.div>
        ) : (
            <Card className="border-none shadow-md rounded-2xl overflow-hidden">
                <Tabs value={mode} onValueChange={(val) => { setMode(val); resetProcess(); }} className="w-full">
                    <div className="bg-slate-100 p-1">
                        <TabsList className="grid w-full grid-cols-2 bg-transparent">
                            <TabsTrigger value="scan" className="rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm">
                                <ScanLine className="w-4 h-4 ml-2" /> סריקה
                            </TabsTrigger>
                            <TabsTrigger value="manual" className="rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm">
                                <Keyboard className="w-4 h-4 ml-2" /> ידני
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    <CardContent className="p-6 min-h-[400px] flex flex-col justify-center">
                        <AnimatePresence mode="wait">
                            
                            {/* STEP 1: FIND OLD */}
                            {step === 1 && (
                                <motion.div 
                                    key="step1"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    className="space-y-6 text-center"
                                >
                                    <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto text-slate-400">
                                        <AlertTriangle className="w-8 h-8" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-slate-800">זיהוי צמיד ישן (תקול)</h3>
                                        <p className="text-slate-500 text-sm mt-1">יש לזהות את הצמיד שיצא משימוש</p>
                                    </div>

                                    {mode === 'scan' ? (
                                        <Button 
                                            size="lg" 
                                            className={`w-full h-24 text-xl rounded-2xl ${scanning ? 'bg-indigo-50 text-indigo-600 border border-indigo-200' : 'bg-indigo-600 text-white shadow-lg shadow-indigo-200'}`}
                                            onClick={() => handleScan(1)}
                                            disabled={loading || scanning}
                                        >
                                            {loading || scanning ? <Loader2 className="animate-spin ml-2" /> : <ScanLine className="ml-2 w-6 h-6" />}
                                            {scanning ? 'ממתין לסריקה...' : 'לחץ לסריקת הצמיד הישן'}
                                        </Button>
                                    ) : (
                                        <div className="space-y-4">
                                            <Input 
                                                placeholder="הכנס מזהה צמיד ישן (ID)"
                                                className="text-center h-14 text-lg bg-slate-50"
                                                value={manualOldId}
                                                onChange={e => setManualOldId(e.target.value.toLowerCase())}
                                            />
                                            <Button 
                                                size="lg" 
                                                className="w-full h-14 text-lg rounded-xl"
                                                onClick={() => findOldWristband(manualOldId)}
                                                disabled={loading || !manualOldId}
                                            >
                                                {loading ? <Loader2 className="animate-spin ml-2" /> : <Search className="ml-2" />}
                                                חפש במערכת
                                            </Button>
                                        </div>
                                    )}
                                </motion.div>
                            )}

                            {/* STEP 2: GET NEW */}
                            {step === 2 && oldWristband && (
                                <motion.div 
                                    key="step2"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    className="space-y-6"
                                >
                                    {/* Identified Wristband Info */}
                                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 text-right">
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="text-xs font-bold text-slate-400 uppercase">נמצא צמיד ישן</span>
                                            <Button variant="ghost" size="sm" className="h-auto p-0 text-indigo-600 hover:text-indigo-700" onClick={resetProcess}>ביטול</Button>
                                        </div>
                                        <div className="font-bold text-lg text-slate-800">{oldWristband.customer_name}</div>
                                        <div className="text-sm text-slate-500">הזמנה #{oldWristband.order_number}</div>
                                        <div className="text-xs text-slate-400 mt-2 font-mono">{oldWristband.nfc_id?.replace(/:/g, "")}</div>
                                    </div>

                                    <div className="flex items-center justify-center my-4">
                                        <ArrowLeft className="text-slate-300 w-6 h-6 rotate-[-90deg]" />
                                    </div>

                                    <div className="text-center">
                                        <h3 className="text-lg font-bold text-slate-800">שיוך צמיד חדש</h3>
                                        <p className="text-slate-500 text-sm">כל המידע יועבר לצמיד החדש</p>
                                    </div>

                                    {mode === 'scan' ? (
                                        <Button 
                                            size="lg" 
                                            className={`w-full h-20 text-lg rounded-2xl ${scanning ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-emerald-600 text-white shadow-lg shadow-emerald-200'}`}
                                            onClick={() => handleScan(2)}
                                            disabled={loading || scanning}
                                        >
                                            {loading || scanning ? <Loader2 className="animate-spin ml-2" /> : <ScanLine className="ml-2" />}
                                            {scanning ? 'סרוק כעת...' : 'סרוק את הצמיד החדש'}
                                        </Button>
                                    ) : (
                                        <div className="space-y-4">
                                            <Input 
                                                placeholder="הכנס מזהה צמיד חדש"
                                                className="text-center h-14 text-lg bg-emerald-50 border-emerald-200 focus-visible:ring-emerald-500"
                                                value={newWristbandId}
                                                onChange={e => setNewWristbandId(e.target.value.toLowerCase())}
                                            />
                                            <Button 
                                                size="lg" 
                                                className="w-full h-14 text-lg rounded-xl bg-emerald-600 hover:bg-emerald-700"
                                                onClick={() => validateNewWristband(newWristbandId)}
                                                disabled={loading || !newWristbandId}
                                            >
                                                {loading ? <Loader2 className="animate-spin ml-2" /> : <RefreshCcw className="ml-2" />}
                                                בצע החלפה
                                            </Button>
                                        </div>
                                    )}
                                </motion.div>
                            )}

                        </AnimatePresence>

                        {/* Feedback Area */}
                        <AnimatePresence>
                            {feedback && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 10 }}
                                    className={`mt-6 p-4 rounded-xl border flex items-start gap-3 ${
                                        feedback.type === 'error' ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'
                                    }`}
                                >
                                    <div className={`p-2 rounded-full ${
                                        feedback.type === 'error' ? 'bg-red-200 text-red-700' : 'bg-blue-200 text-blue-700'
                                    }`}>
                                        <AlertTriangle className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <div className={`font-bold ${feedback.type === 'error' ? 'text-red-800' : 'text-blue-800'}`}>
                                            {feedback.message}
                                        </div>
                                        {feedback.details && (
                                            <div className={`text-sm mt-1 ${feedback.type === 'error' ? 'text-red-600' : 'text-blue-600'}`}>
                                                {feedback.details}
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </CardContent>
                </Tabs>
            </Card>
        )}
      </div>
    </div>
  );
}