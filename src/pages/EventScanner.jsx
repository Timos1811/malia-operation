import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Scan, CheckCircle2, XCircle, AlertTriangle, ThumbsUp, FileCheck, Home } from "lucide-react";
import { toast } from "sonner";

export default function EventScanner() {
    const [attractions, setAttractions] = useState([]);
    const [eventInstances, setEventInstances] = useState([]); // List of unique strings like "Boat Party - 15/05/2026"
    const [selectedEvent, setSelectedEvent] = useState("");
    const [uniqueScans, setUniqueScans] = useState(0);
    const [totalBuyers, setTotalBuyers] = useState(0);
    const [isScanning, setIsScanning] = useState(false);
    const [scanResult, setScanResult] = useState(null); // { status: 'success' | 'error' | 'warning', message: '', details: {} }
    const [loading, setLoading] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);
    const [showFinishDialog, setShowFinishDialog] = useState(false);
    const [signaturesCount, setSignaturesCount] = useState("");
    const [isSuccess, setIsSuccess] = useState(false);
    const isProcessing = useRef(false);
    const navigate = useNavigate();
    
    const audioSuccess = useRef(new Audio('https://cdn.freesound.org/previews/171/171671_2437358-lq.mp3'));
    const audioError = useRef(new Audio('https://cdn.freesound.org/previews/142/142608_1840739-lq.mp3'));

    useEffect(() => {
        const fetchAttractions = async () => {
            try {
                const data = await base44.entities.Attraction.list();
                setAttractions(data);
                
                // Fetch active wristbands to find all unique event instances with dates
                const activeWristbands = await base44.entities.Wristband.filter({ status: 'active' });
                const allEvents = new Set();
                activeWristbands.forEach(wb => {
                    if (wb.allowed_events) {
                        wb.allowed_events.forEach(ev => allEvents.add(ev));
                    }
                });
                
                // If there are no active wristbands with events, fallback to generic attraction names
                if (allEvents.size === 0) {
                    setEventInstances(data.map(a => a.name));
                } else {
                    setEventInstances(Array.from(allEvents).sort());
                }
                
            } catch (error) {
                console.error("Failed to fetch attractions", error);
                toast.error(`שגיאה בטעינת אירועים: ${error.message || 'אנא בדוק את החיבור'}`);
            }
        };
        
        const fetchUser = async () => {
            try {
                const user = await base44.auth.me();
                setCurrentUser(user);
            } catch (e) {
                console.error("Failed to fetch user", e);
            }
        };

        fetchAttractions();
        fetchUser();
    }, []);

    useEffect(() => {
        if (selectedEvent) {
            fetchScanStats();
            fetchBuyerStats();
        } else {
            setUniqueScans(0);
            setTotalBuyers(0);
        }
    }, [selectedEvent]);

    const fetchScanStats = async () => {
        if (!selectedEvent) return;
        try {
            // Fetch up to 1000 logs to ensure accurate counting
            const logs = await base44.entities.WristbandScanLog.filter({
                event_name: selectedEvent,
                status: 'success'
            }, '-scan_time', 1000);
            const uniqueIds = new Set(logs.map(log => log.nfc_id));
            setUniqueScans(uniqueIds.size);
        } catch (e) {
            console.error("Failed to fetch stats", e);
        }
    };

    const fetchBuyerStats = async () => {
        if (!selectedEvent) return;
        try {
            const oneWeekAgo = new Date();
            oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
            
            // Fetch recent wristbands to find potential buyers
            // Using a large limit to catch all relevant wristbands from the last week
            const wristbands = await base44.entities.Wristband.filter({
                created_date: { $gte: oneWeekAgo.toISOString() }
            }, '-created_date', 5000);

            // Filter client-side for the specific event
            const buyerCount = wristbands.filter(wb => 
                wb.allowed_events && wb.allowed_events.includes(selectedEvent)
            ).length;

            setTotalBuyers(buyerCount);
        } catch (e) {
            console.error("Failed to fetch buyer stats", e);
        }
    };

    const handleFinishEvent = async () => {
        if (!selectedEvent) return;
        setLoading(true);
        try {
            const baseEventName = selectedEvent ? selectedEvent.split(' - ')[0] : '';
            const attraction = attractions.find(a => a.name === baseEventName);
            const costPrice = attraction?.cost_price_eur || 0;
            const signatures = parseInt(signaturesCount) || 0;
            
            // Payment is based on Total Scans + Manual Signatures
            const paymentCount = uniqueScans + signatures;
            const totalAmount = paymentCount * costPrice;

            // Find the date of the first scan for this event
            let eventDate = new Date().toISOString().split('T')[0];
            try {
                const firstLog = await base44.entities.WristbandScanLog.filter({
                    event_name: selectedEvent,
                    status: 'success'
                }, 'scan_time', 1); // Ascending sort to get the oldest
                
                if (firstLog && firstLog.length > 0) {
                    eventDate = new Date(firstLog[0].scan_time).toISOString().split('T')[0];
                }
            } catch (err) {
                console.error("Could not fetch first scan date", err);
            }

            await base44.entities.Task.create({
                title: `תשלום לספק - ${selectedEvent}`,
                description: `
סיכום אירוע: ${selectedEvent}
סה"כ כרטיסים שנמכרו (בשבוע האחרון): ${totalBuyers}
מתוכם נסרקו: ${uniqueScans}
לא נסרקו: ${Math.max(0, totalBuyers - uniqueScans)}
חתימות (ידני): ${signatures}
סה"כ לתשלום (סריקות + חתימות): ${paymentCount} אנשים
מחיר עלות לאדם: €${costPrice}
תאריך אירוע (לפי סריקה ראשונה): ${eventDate}
                `.trim(),
                status: 'todo',
                task_type: 'supplier_payment',
                amount: totalAmount,
                currency: 'EUR',
                due_date: new Date().toISOString().split('T')[0],
                sales_rep: currentUser?.full_name || 'System',
                // New fields for automation
                people_count: paymentCount,
                scanned_count: uniqueScans,
                buyers_count: totalBuyers, // Adding buyers count for context
                event_date: eventDate,
                event_name: selectedEvent
            });

            // Reset scans for this event
            await base44.functions.invoke('resetEventScans', { event_name: selectedEvent });
            
            // Refresh counts locally
            setUniqueScans(0);

            toast.success("סיכום האירוע נשלח והסריקות אופסו!");
            setShowFinishDialog(false);
            setIsSuccess(true);
        } catch (error) {
            console.error("Failed to create task", error);
            toast.error(`שגיאה ביצירת משימת תשלום: ${error.message || 'נסה שוב מאוחר יותר'}`);
        } finally {
            setLoading(false);
        }
    };

    const playSound = (type) => {
        try {
            if (type === 'success') {
                audioSuccess.current.currentTime = 0;
                audioSuccess.current.play();
            } else {
                audioError.current.currentTime = 0;
                audioError.current.play();
            }
        } catch (e) {
            console.error("Audio play failed", e);
        }
    };

    const startScanning = async () => {
        if (!selectedEvent) {
            toast.error("יש לבחור אירוע לפני הסריקה");
            return;
        }

        if ('NDEFReader' in window) {
            try {
                const ndef = new window.NDEFReader();
                await ndef.scan();
                setIsScanning(true);
                toast.success("מוכן לסריקה... קרב את הצמיד");

                ndef.onreading = async ({ serialNumber }) => {
                    if (isProcessing.current) return;
                    isProcessing.current = true;
                    await handleScan(serialNumber);
                    // Cooldown to prevent double scans
                    setTimeout(() => { isProcessing.current = false; }, 2000);
                };

                ndef.onreadingerror = () => {
                    toast.error("שגיאה בקריאת הצמיד, נסה שוב");
                };
            } catch (error) {
                console.error("Error starting NFC scan", error);
                toast.error(`לא ניתן להפעיל NFC: ${error.message}. וודא ש-NFC דלוק במכשיר והרשאות ניתנו.`);
                setIsScanning(false);
            }
        } else {
            toast.error("הדפדפן אינו תומך ב-NFC");
        }
    };

    const handleScan = async (serialNumber) => {
        setLoading(true);
        setScanResult(null);

        // Convert serial number format if needed (usually comes as xx:xx:xx:xx)
        const nfcId = serialNumber.replace(/:/g, "").toLowerCase(); // Normalize format
        
        try {
            // Find wristband directly using filter (handles large datasets correctly)
            let wristbands = await base44.entities.Wristband.filter({ nfc_id: nfcId });
            
            // Fallback: Try uppercase match if not found (for legacy data)
            if (!wristbands || wristbands.length === 0) {
                wristbands = await base44.entities.Wristband.filter({ nfc_id: nfcId.toUpperCase() });
            }

            const wristband = wristbands && wristbands.length > 0 ? wristbands[0] : null;

            let resultStatus, resultMessage, resultDetails;

            if (!wristband) {
                resultStatus = 'error';
                resultMessage = 'צמיד לא מזוהה במערכת';
                resultDetails = { nfc_id: nfcId };
            } else if (wristband.status === 'inactive') {
                resultStatus = 'error';
                resultMessage = 'הצמיד אינו פעיל';
                resultDetails = { reason: 'status_inactive' };
            } else if (wristband.valid_until && new Date(wristband.valid_until) < new Date(new Date().setHours(0,0,0,0))) {
                // Check expiration: valid_until is usually inclusive (checkout day), 
                // so if today is AFTER valid_until (at 00:00), it is expired.
                // Actually, if departure is "2023-01-01", usually checkout is morning, so evening events on 01-01 might be invalid?
                // User said "defined until... after that not active". 
                // Let's assume strict: if today > valid_until, it's expired.
                // If today == valid_until, it depends. Usually checkout is 11am. 
                // Let's treat valid_until as the LAST VALID DAY (inclusive) for now, or assume it expires at the end of that day.
                // Code: if today (00:00) > valid_until (parsed as date), then expired.
                // Date comparison: '2023-01-02' > '2023-01-01'.
                const todayStr = new Date().toISOString().split('T')[0];
                if (todayStr > wristband.valid_until) {
                    resultStatus = 'error';
                    resultMessage = 'תוקף הצמיד פג';
                    resultDetails = { valid_until: wristband.valid_until };
                } else {
                    // Continue with allowed check
                    // Check if event is allowed
                    const allowedEvents = wristband.allowed_events || [];
                    const isAllowed = allowedEvents.includes(selectedEvent);

                    if (isAllowed) {
                        // Check if already scanned
                        const previousScans = await base44.entities.WristbandScanLog.filter({
                            nfc_id: nfcId,
                            event_name: selectedEvent,
                            status: 'success'
                        }, '-scan_time', 1);

                        if (previousScans.length > 0) {
                            resultStatus = 'already_scanned';
                        } else {
                            resultStatus = 'success';
                        }
                        resultMessage = '';
                        resultDetails = {};
                    } else {
                        resultStatus = 'warning';
                        resultMessage = '';
                        resultDetails = {};
                    }
                }
            } else {
                // Status active and date valid (or not set)
                // Check if event is allowed
                const allowedEvents = wristband.allowed_events || [];
                const isAllowed = allowedEvents.includes(selectedEvent);

                if (isAllowed) {
                    // Check if already scanned
                    const previousScans = await base44.entities.WristbandScanLog.filter({
                        nfc_id: nfcId,
                        event_name: selectedEvent,
                        status: 'success'
                    }, '-scan_time', 1);

                    if (previousScans.length > 0) {
                        resultStatus = 'already_scanned';
                    } else {
                        resultStatus = 'success';
                    }
                    resultMessage = '';
                    resultDetails = {};
                } else {
                    resultStatus = 'warning';
                    resultMessage = '';
                    resultDetails = {};
                }
            }

            setScanResult({
                status: resultStatus,
                message: resultMessage,
                details: resultDetails
            });
            playSound((resultStatus === 'success' || resultStatus === 'already_scanned') ? 'success' : 'error');

            // Log the scan
            try {
                // Determine log status (map already_scanned to success for logs, or keep strictly unique?)
                // Assuming 'already_scanned' is still a valid entry, log it as success or maybe a new status 'duplicate'
                // User logic implies it's allowed, so 'success' is appropriate for the log, 
                // but for statistics we only count unique NFC IDs anyway.
                const logStatus = resultStatus === 'already_scanned' ? 'success' : resultStatus;

                await base44.entities.WristbandScanLog.create({
                    nfc_id: nfcId,
                    event_name: selectedEvent,
                    scan_time: new Date().toISOString(),
                    status: logStatus,
                    message: resultStatus === 'already_scanned' ? 'Already Scanned' : resultMessage,
                    scanned_by: currentUser?.full_name || 'Unknown',
                    customer_name: wristband?.customer_name || '',
                    order_number: wristband?.order_number || ''
                });
                if (logStatus === 'success') {
                    fetchScanStats();
                }
            } catch (logError) {
                console.error("Failed to log scan", logError);
            }
        } catch (error) {
            console.error("Scan processing error", error);
            setScanResult({
                status: 'error',
                message: 'שגיאה בעיבוד הנתונים',
                details: {}
            });
            playSound('error');
        } finally {
            setLoading(false);
        }
    };

    if (isSuccess) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4" dir="rtl">
                <Card className="max-w-md w-full shadow-xl border-green-100">
                    <CardContent className="pt-12 pb-8 px-8 text-center space-y-6">
                        <div className="flex justify-center">
                            <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center animate-bounce">
                                <CheckCircle2 className="w-12 h-12 text-green-600" />
                            </div>
                        </div>
                        
                        <div className="space-y-2">
                            <h1 className="text-2xl font-bold text-slate-900">המשימה נשלחה בהצלחה!</h1>
                            <p className="text-slate-500">
                                דוח האירוע הועבר למנהל לאישור ותשלום.
                                <br/>
                                ספירת הסריקות לאירוע זה אופסה.
                            </p>
                        </div>

                        <div className="grid gap-3 pt-4">
                            <Button 
                                onClick={() => {
                                    setIsSuccess(false);
                                    setSelectedEvent("");
                                    setSignaturesCount("");
                                    setUniqueScans(0);
                                    setScanResult(null);
                                }}
                                className="w-full bg-slate-900 hover:bg-slate-800 h-12 text-lg gap-2"
                            >
                                <Scan className="w-5 h-5" />
                                סרוק אירוע חדש
                            </Button>
                            
                            <Button 
                                variant="outline" 
                                onClick={() => navigate(createPageUrl('SellerDashboard'))}
                                className="w-full h-12 text-lg gap-2"
                            >
                                <Home className="w-5 h-5" />
                                חזור לדף הבית
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 p-4 md:p-8" dir="rtl">
            <div className="max-w-md mx-auto space-y-6">
                <div className="text-center space-y-2">
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center justify-center gap-2">
                        <Scan className="w-8 h-8" />
                        סורק כניסה לאירועים
                    </h1>
                    <p className="text-slate-500">בחר אירוע וסרוק צמידים לאישור כניסה</p>
                </div>

                <Card>
                    <CardContent className="pt-6 space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700">בחר אירוע</label>
                            <Select value={selectedEvent} onValueChange={(val) => {
                                setSelectedEvent(val);
                                setScanResult(null);
                                setIsScanning(false);
                            }}>
                                <SelectTrigger className="h-12 text-lg">
                                    <SelectValue placeholder="בחר אירוע מהרשימה..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {eventInstances.map((eventName, idx) => (
                                        <SelectItem key={idx} value={eventName}>
                                            {eventName}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {selectedEvent && (
                            <div className="space-y-4">
                                <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="text-indigo-700 font-medium">נסרקו לאירוע זה:</span>
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            className="h-6 w-6 text-indigo-400 hover:text-indigo-600" 
                                            onClick={fetchScanStats}
                                            title="רענן ספירה"
                                        >
                                            <Loader2 className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                                        </Button>
                                    </div>
                                    <span className="text-2xl font-bold text-indigo-900">{uniqueScans}</span>
                                </div>
                                
                                <Button 
                                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                                    onClick={() => setShowFinishDialog(true)}
                                >
                                    <FileCheck className="w-4 h-4 ml-2" />
                                    סיים אירוע וצור דוח
                                </Button>
                            </div>
                        )}

                        {!isScanning ? (
                            <Button 
                                className="w-full h-16 text-lg gap-3 bg-slate-900 hover:bg-slate-800"
                                onClick={startScanning}
                                disabled={!selectedEvent}
                            >
                                <Scan className="w-6 h-6" />
                                התחל סריקה
                            </Button>
                        ) : (
                            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center animate-pulse">
                                <p className="text-blue-700 font-medium">מצב סריקה פעיל...</p>
                                <p className="text-sm text-blue-500">קרב צמיד למכשיר</p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {loading && (
                    <div className="flex justify-center py-8">
                        <Loader2 className="w-10 h-10 animate-spin text-slate-400" />
                    </div>
                )}

                {scanResult && !loading && (
                    <Card className={`border-8 overflow-hidden ${
                        scanResult.status === 'success' ? 'border-green-500 shadow-green-200' : 
                        scanResult.status === 'already_scanned' ? 'border-yellow-500 shadow-yellow-200' :
                        scanResult.status === 'warning' ? 'border-red-500 shadow-red-200' : 'border-slate-300'
                    } shadow-2xl transform transition-all duration-300 scale-110`}>
                        <div className={`p-12 flex items-center justify-center ${
                            scanResult.status === 'success' ? 'bg-green-50' : 
                            scanResult.status === 'already_scanned' ? 'bg-yellow-50' :
                            scanResult.status === 'warning' ? 'bg-red-50' : 'bg-slate-50'
                        }`}>
                            {scanResult.status === 'success' && <CheckCircle2 className="w-40 h-40 text-green-600 animate-bounce" />}
                            {scanResult.status === 'already_scanned' && <ThumbsUp className="w-40 h-40 text-yellow-500 animate-bounce" />}
                            {scanResult.status === 'warning' && <XCircle className="w-40 h-40 text-red-600 animate-pulse" />}
                            {scanResult.status === 'error' && <AlertTriangle className="w-40 h-40 text-slate-400" />}
                        </div>
                    </Card>
                )}
            </div>

            <Dialog open={showFinishDialog} onOpenChange={setShowFinishDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>סיכום אירוע - {selectedEvent}</DialogTitle>
                        <DialogDescription>
                            אשר את נתוני האירוע ושלח למשימות לתשלום
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="space-y-4 py-4">
                        {(() => {
                            // Extract the base attraction name without the date (e.g. "Boat Party - 15/05/2026" -> "Boat Party")
                            const baseEventName = selectedEvent ? selectedEvent.split(' - ')[0] : '';
                            const selectedAttraction = attractions.find(a => a.name === baseEventName);
                            const costPrice = selectedAttraction?.cost_price_eur || 0;
                            const signatures = parseInt(signaturesCount) || 0;
                            // Calculate payment based on Total Scans + Signatures
                            const paymentCount = uniqueScans + signatures;
                            const notScanned = Math.max(0, totalBuyers - uniqueScans);

                            return (
                                <>
                                    <div className="grid grid-cols-1 gap-4 mb-4">
                                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex justify-between items-center">
                                            <span className="text-slate-600 font-medium">כמות נסרקים במערכת</span>
                                            <span className="font-bold text-2xl text-slate-900">{uniqueScans}</span>
                                        </div>
                                    </div>
                                    
                                    <div className="space-y-2">
                                        <Label>חתימות (תוספת ידנית)</Label>
                                        <Input 
                                            type="number" 
                                            placeholder="הכנס כמות חתימות..."
                                            value={signaturesCount}
                                            onChange={(e) => setSignaturesCount(e.target.value)}
                                            className="text-lg"
                                        />
                                    </div>

                                    <div className="space-y-3 pt-4 border-t mt-2">
                                        <div className="flex justify-between items-center text-sm px-2">
                                            <span className="text-slate-600">סה"כ לתשלום (סריקות + חתימות):</span>
                                            <span className="font-semibold">{paymentCount}</span>
                                        </div>
                                        

                                    </div>
                                </>
                            );
                        })()}
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowFinishDialog(false)}>ביטול</Button>
                        <Button onClick={handleFinishEvent} disabled={loading} className="bg-emerald-600 hover:bg-emerald-700">
                            {loading && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
                            שלח למשימות
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}