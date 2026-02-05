import React, { useState, useRef, useMemo } from 'react';
import { useQuery, useMutation } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Search, TicketPlus, ScanLine, AlertCircle, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '../utils';

export default function AddEventToWristband() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [foundOrder, setFoundOrder] = useState(null);
  const [selectedWristbands, setSelectedWristbands] = useState(new Set());
  const [selectedEvents, setSelectedEvents] = useState(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- Fetch Data ---
  const { data: attractions = [] } = useQuery({
    queryKey: ['attractions'],
    queryFn: () => base44.entities.Attraction.list(),
  });

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  // --- Handlers ---

  const handleSearch = async () => {
    if (!searchQuery) return;
    
    // Try finding by Order Number first
    try {
      // 1. Check Pending Sales (Active orders usually here or TableData)
      let orders = await base44.entities.TableData.filter({ order_number: searchQuery });
      if (orders.length === 0) {
          orders = await base44.entities.PendingSale.filter({ order_number: searchQuery });
      }

      if (orders.length > 0) {
        const order = orders[0];
        // Fetch linked wristbands
        const wristbands = await base44.entities.Wristband.filter({ order_number: order.order_number });
        
        setFoundOrder({
          details: order,
          wristbands: wristbands
        });
        setSelectedWristbands(new Set()); // Reset selection
        return;
      }

      // 2. Try finding by Wristband NFC
      const wristbands = await base44.entities.Wristband.filter({ nfc_id: searchQuery.toLowerCase() });
      if (wristbands.length > 0) {
        const wb = wristbands[0];
        // Fetch the order for this wristband
        let parentOrders = await base44.entities.TableData.filter({ order_number: wb.order_number });
        if (parentOrders.length === 0) {
             parentOrders = await base44.entities.PendingSale.filter({ order_number: wb.order_number });
        }
        
        if (parentOrders.length > 0) {
            // Get ALL wristbands for this order so user can select others too if needed
            const allWristbands = await base44.entities.Wristband.filter({ order_number: wb.order_number });
            setFoundOrder({
                details: parentOrders[0],
                wristbands: allWristbands
            });
            setSelectedWristbands(new Set([wb.nfc_id])); // Auto-select the scanned one
        }
        return;
      }

      toast.error("לא נמצאה הזמנה או צמיד");
      setFoundOrder(null);

    } catch (e) {
      console.error(e);
      toast.error("שגיאה בחיפוש");
    }
  };

  const handleNFCScan = async () => {
    if (!('NDEFReader' in window)) return toast.error("אין תמיכה ב-NFC בדפדפן זה");
    
    setIsScanning(true);
    try {
      const ndef = new NDEFReader();
      await ndef.scan();
      toast.info("מוכן לסריקה...");
      
      ndef.onreading = (event) => {
        const serialNumber = event.serialNumber.replace(/:/g, "").toLowerCase();
        setSearchQuery(serialNumber);
        handleSearch(); // Trigger search with the scanned ID
        setIsScanning(false);
      };
    } catch (e) {
      console.error(e);
      setIsScanning(false);
      toast.error("שגיאה בהפעלת הסורק");
    }
  };

  const handleSubmit = async () => {
    if (!foundOrder || selectedWristbands.size === 0 || selectedEvents.size === 0) {
      return toast.error("נא לבחור צמידים ואירועים");
    }

    setIsSubmitting(true);
    try {
      const totalAmount = Array.from(selectedEvents).reduce((sum, eventId) => {
        const ev = attractions.find(a => a.id === eventId);
        return sum + (ev?.price_eur || 0);
      }, 0) * selectedWristbands.size;

      const eventNames = Array.from(selectedEvents).map(id => attractions.find(a => a.id === id)?.name).filter(Boolean);

      await base44.entities.Task.create({
        title: `הוספת אירוע: ${eventNames.join(', ')}`,
        description: `בקשה להוספת אירועים להזמנה ${foundOrder.details.order_number}. עבור ${selectedWristbands.size} אורחים.`,
        status: 'todo',
        task_type: 'add_event',
        order_number: foundOrder.details.order_number,
        amount: totalAmount,
        currency: 'EUR', // Defaulting to EUR as per attractions
        related_events: Array.from(selectedEvents), // Storing IDs
        related_wristbands: Array.from(selectedWristbands),
        people_count: selectedWristbands.size,
        sales_rep: currentUser?.full_name || 'נציג',
        created_date: new Date().toISOString()
      });

      toast.success("בקשה נשלחה למנהל לאישור");
      navigate(createPageUrl('SellerDashboard'));

    } catch (e) {
      console.error(e);
      toast.error("שגיאה בשליחת הבקשה");
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Calculations ---
  const calculatedTotal = useMemo(() => {
    const eventPrice = Array.from(selectedEvents).reduce((sum, id) => {
      const ev = attractions.find(a => a.id === id);
      return sum + (ev?.price_eur || 0);
    }, 0);
    return eventPrice * selectedWristbands.size;
  }, [selectedEvents, selectedWristbands, attractions]);

  return (
    <div className="min-h-screen bg-slate-50 p-4 pb-24" dir="rtl">
      <div className="max-w-xl mx-auto space-y-6">
        
        <div className="flex items-center gap-2 mb-6">
            <Button variant="ghost" size="icon" onClick={() => navigate(createPageUrl('SellerDashboard'))}>
                <ArrowRight />
            </Button>
            <h1 className="text-2xl font-black text-slate-900">הוספת אירוע לצמיד</h1>
        </div>

        {/* Search Section */}
        <Card>
          <CardContent className="p-6 space-y-4">
            <Label>חיפוש לפי מספר הזמנה או סריקת צמיד</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute right-3 top-2.5 w-4 h-4 text-slate-400" />
                <Input 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="הזן מספר..."
                  className="pr-9"
                />
              </div>
              <Button onClick={handleSearch} disabled={!searchQuery}>חפש</Button>
            </div>
            <Button 
                variant="outline" 
                className="w-full gap-2 text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                onClick={handleNFCScan}
                disabled={isScanning}
            >
                <ScanLine className="w-4 h-4" />
                {isScanning ? 'סורק...' : 'סרוק צמיד'}
            </Button>
          </CardContent>
        </Card>

        {/* Results Section */}
        {foundOrder && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
            
            {/* Order Info */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex justify-between items-start">
                    <div>
                        <h3 className="font-bold text-lg">הזמנה {foundOrder.details.order_number}</h3>
                        <p className="text-slate-500 text-sm">{foundOrder.details.customer} אורחים • {foundOrder.details.hotel}</p>
                    </div>
                </div>
            </div>

            {/* Select Wristbands */}
            <div className="space-y-3">
              <h3 className="font-bold text-slate-700 px-1">בחירת צמידים ({selectedWristbands.size})</h3>
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden divide-y">
                {foundOrder.wristbands.length > 0 ? foundOrder.wristbands.map((wb, idx) => (
                    <div 
                        key={wb.id}
                        onClick={() => setSelectedWristbands(prev => {
                            const next = new Set(prev);
                            next.has(wb.nfc_id) ? next.delete(wb.nfc_id) : next.add(wb.nfc_id);
                            return next;
                        })}
                        className={`p-4 flex items-center gap-3 cursor-pointer transition-colors ${selectedWristbands.has(wb.nfc_id) ? 'bg-indigo-50' : 'hover:bg-slate-50'}`}
                    >
                        <Checkbox checked={selectedWristbands.has(wb.nfc_id)} />
                        <div>
                            <div className="font-bold text-slate-800">{wb.customer_name || `אורח ${idx + 1}`}</div>
                            <div className="text-xs text-slate-400 font-mono">{wb.nfc_id}</div>
                        </div>
                    </div>
                )) : (
                    <div className="p-4 text-center text-slate-500">לא נמצאו צמידים מקושרים להזמנה זו</div>
                )}
              </div>
            </div>

            {/* Select Events */}
            <div className="space-y-3">
              <h3 className="font-bold text-slate-700 px-1">בחירת אירועים להוספה</h3>
              <div className="grid gap-2">
                {attractions.map(att => (
                  <div 
                    key={att.id}
                    onClick={() => setSelectedEvents(prev => {
                        const next = new Set(prev);
                        next.has(att.id) ? next.delete(att.id) : next.add(att.id);
                        return next;
                    })}
                    className={`
                        p-4 rounded-xl border cursor-pointer flex justify-between items-center transition-all
                        ${selectedEvents.has(att.id) ? 'bg-green-50 border-green-500 ring-1 ring-green-500' : 'bg-white border-slate-200 hover:border-green-300'}
                    `}
                  >
                    <div className="flex items-center gap-3">
                        <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${selectedEvents.has(att.id) ? 'bg-green-500 border-green-500' : 'border-slate-300'}`}>
                            {selectedEvents.has(att.id) && <div className="w-2 h-2 bg-white rounded-full" />}
                        </div>
                        <span className="font-medium">{att.name}</span>
                    </div>
                    <span className="font-bold text-slate-900">€{att.price_eur}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Summary & Submit */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t z-10">
                <div className="max-w-xl mx-auto flex items-center justify-between gap-4">
                    <div>
                        <div className="text-xs text-slate-500">סה"כ לתשלום</div>
                        <div className="text-2xl font-black text-slate-900">€{calculatedTotal}</div>
                    </div>
                    <Button 
                        size="lg" 
                        className="flex-1 bg-slate-900 text-white hover:bg-slate-800"
                        onClick={handleSubmit}
                        disabled={isSubmitting || selectedWristbands.size === 0 || selectedEvents.size === 0}
                    >
                        {isSubmitting ? <Loader2 className="animate-spin" /> : 'שלח בקשה לאישור'}
                    </Button>
                </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}