import React, { useState, useEffect, useRef } from 'react';
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Scan, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export default function EventScanner() {
    const [attractions, setAttractions] = useState([]);
    const [selectedEvent, setSelectedEvent] = useState("");
    const [isScanning, setIsScanning] = useState(false);
    const [scanResult, setScanResult] = useState(null); // { status: 'success' | 'error' | 'warning', message: '', details: {} }
    const [loading, setLoading] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);
    
    const audioSuccess = useRef(new Audio('https://cdn.freesound.org/previews/171/171671_2437358-lq.mp3'));
    const audioError = useRef(new Audio('https://cdn.freesound.org/previews/142/142608_1840739-lq.mp3'));

    useEffect(() => {
        const fetchAttractions = async () => {
            try {
                const data = await base44.entities.Attraction.list();
                setAttractions(data);
            } catch (error) {
                console.error("Failed to fetch attractions", error);
                toast.error("שגיאה בטעינת אירועים");
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
                const ndef = new NDEFReader();
                await ndef.scan();
                setIsScanning(true);
                toast.success("מוכן לסריקה... קרב את הצמיד");

                ndef.onreading = async ({ serialNumber }) => {
                    await handleScan(serialNumber);
                };

                ndef.onreadingerror = () => {
                    toast.error("שגיאה בקריאת הצמיד, נסה שוב");
                };
            } catch (error) {
                console.error("Error starting NFC scan", error);
                toast.error("לא ניתן להפעיל NFC. וודא שהמכשיר תומך ו-NFC דלוק.");
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
        const nfcId = serialNumber.replace(/:/g, ""); // Remove colons to match DB format
        
        try {
            // Find wristband
            const wristbands = await base44.entities.Wristband.list();
            // Filter locally or use filter API if precise match needed
            const wristband = wristbands.find(w => w.nfc_id === nfcId);

            let resultStatus, resultMessage, resultDetails;

            if (!wristband) {
                resultStatus = 'error';
                resultMessage = 'צמיד לא מזוהה במערכת';
                resultDetails = { nfc_id: nfcId };
            } else {
                // Check if event is allowed
                const allowedEvents = wristband.allowed_events || [];
                const isAllowed = allowedEvents.includes(selectedEvent);

                if (isAllowed) {
                    resultStatus = 'success';
                    resultMessage = 'כניסה מאושרת';
                    resultDetails = {
                        customer: wristband.customer_name,
                        order: wristband.order_number,
                        nfc_id: nfcId
                    };
                } else {
                    resultStatus = 'warning';
                    resultMessage = 'אין כניסה לאירוע זה';
                    resultDetails = {
                        customer: wristband.customer_name,
                        order: wristband.order_number,
                        nfc_id: nfcId
                    };
                }
            }

            setScanResult({
                status: resultStatus,
                message: resultMessage,
                details: resultDetails
            });
            playSound(resultStatus === 'success' ? 'success' : 'error');

            // Log the scan
            try {
                await base44.entities.WristbandScanLog.create({
                    nfc_id: nfcId,
                    event_name: selectedEvent,
                    scan_time: new Date().toISOString(),
                    status: resultStatus,
                    message: resultMessage,
                    scanned_by: currentUser?.full_name || 'Unknown',
                    customer_name: wristband?.customer_name || '',
                    order_number: wristband?.order_number || ''
                });
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
                                    {attractions.map((attr) => (
                                        <SelectItem key={attr.id} value={attr.name}>
                                            {attr.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

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
                    <Card className={`border-4 overflow-hidden ${
                        scanResult.status === 'success' ? 'border-green-500 shadow-green-100' : 
                        scanResult.status === 'warning' ? 'border-red-500 shadow-red-100' : 'border-slate-300'
                    } shadow-xl transform transition-all duration-300 scale-105`}>
                        <CardHeader className={`${
                            scanResult.status === 'success' ? 'bg-green-50' : 
                            scanResult.status === 'warning' ? 'bg-red-50' : 'bg-slate-50'
                        } pb-6 pt-6 text-center`}>
                            <div className="mx-auto mb-3">
                                {scanResult.status === 'success' && <CheckCircle2 className="w-16 h-16 text-green-600 mx-auto" />}
                                {scanResult.status === 'warning' && <XCircle className="w-16 h-16 text-red-600 mx-auto" />}
                                {scanResult.status === 'error' && <AlertTriangle className="w-16 h-16 text-slate-400 mx-auto" />}
                            </div>
                            <CardTitle className={`text-2xl font-black ${
                                scanResult.status === 'success' ? 'text-green-700' : 
                                scanResult.status === 'warning' ? 'text-red-700' : 'text-slate-700'
                            }`}>
                                {scanResult.message}
                            </CardTitle>
                        </CardHeader>
                        {scanResult.details.nfc_id && (
                            <CardContent className="pt-6 text-center space-y-2">
                                {scanResult.details.customer && (
                                    <div className="text-lg font-bold text-slate-800">
                                        {scanResult.details.customer}
                                    </div>
                                )}
                                {scanResult.details.order && (
                                    <div className="text-slate-500">
                                        הזמנה: {scanResult.details.order}
                                    </div>
                                )}
                                <div className="text-xs text-slate-300 font-mono mt-4">
                                    ID: {scanResult.details.nfc_id}
                                </div>
                            </CardContent>
                        )}
                    </Card>
                )}
            </div>
        </div>
    );
}