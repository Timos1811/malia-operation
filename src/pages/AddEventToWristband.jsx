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

        if (wb.status !== 'active') {
             toast.error("צמיד זה אינו פעיל (inactive) ולא ניתן להוסיף לו אירועים");
             setFoundOrder(null);
             return;
        }

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
      // Filter out invalid events
      const validEventIds = Array.from(selectedEvents).filter(eventId => {
          const ev = attractions.find(a => a.id === eventId);
          if (!ev) return false;
          const isConflict = Array.from(selectedWristbands).some(nfcId => {
              const wb = foundOrder?.wristbands.find(w => w.nfc_id === nfcId);
              return wb?.allowed_events?.includes(ev.name);
          });
          return !isConflict;
      });

      if (validEventIds.length === 0) {
          setIsSubmitting(false);
          return toast.error("אין אירועים תקינים להוספה (האירועים שנבחרו כבר קיימים בצמידים)");
      }

      const totalAmount = validEventIds.reduce((sum, eventId) => {
        const ev = attractions.find(a => a.id === eventId);
        return sum + (ev?.price_eur || 0);
      }, 0) * selectedWristbands.size;

      const eventNames = validEventIds.map(id => attractions.find(a => a.id === id)?.name).filter(Boolean);

      // 1. Update Wristbands Immediately
      const updatePromises = Array.from(selectedWristbands).map(async (nfcId) => {
          const wb = foundOrder.wristbands.find(w => w.nfc_id === nfcId);
          if (wb && wb.status === 'active') {
              const currentEvents = wb.allowed_events || [];
              const uniqueEvents = [...new Set([...currentEvents, ...eventNames])];
              return base44.entities.Wristband.update(wb.id, { allowed_events: uniqueEvents });
          }
      });
      await Promise.all(updatePromises);

      // 2. Create PendingSale Immediately
      const baseData = {
          customer: foundOrder.details.customer,
          departure_date: foundOrder.details.departure_date,
          nights: foundOrder.details.nights,
          gender: foundOrder.details.gender,
          hotel: foundOrder.details.hotel,
          company: foundOrder.details.company,
          // Use the current user as sales_rep for this specific addition, or fallback to original
          // Using current user makes sense for tracking who added the event
      };

      await base44.entities.PendingSale.create({
          order_number: foundOrder.details.order_number,
          requested_amount: totalAmount.toString(),
          comments: `תוספת עבור אירועים: ${eventNames.join(', ')}`,
          sales_rep: currentUser?.full_name || foundOrder.details.sales_rep || 'נציג',
          ...baseData,
          eur_amount: "0",
          shekel_amount: "0",
          dollar_amount: "0",
          bit_amount: "0",
          eur_status: "0", // Initialize status
          created_date: new Date().toISOString()
      });

      // Task creation removed as per user request

      toast.success("האירועים נוספו והתשלום עבר למכירה בהמתנה");
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
      if (!ev) return sum;
      
      // Check for conflicts
      const isConflict = Array.from(selectedWristbands).some(nfcId => {
          const wb = foundOrder?.wristbands.find(w => w.nfc_id === nfcId);
          return wb?.allowed_events?.includes(ev.name);
      });
      
      if (isConflict) return sum;

      return sum + (ev.price_eur || 0);
    }, 0);
    return eventPrice * selectedWristbands.size;
  }, [selectedEvents, selectedWristbands, attractions, foundOrder]);

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
                {foundOrder.wristbands.length > 0 ? foundOrder.wristbands.map((wb, idx) => {
                    const isActive = wb.status === 'active';
                    return (
                    <div 
                        key={wb.id}
                        onClick={() => {
                            if (!isActive) return;
                            setSelectedWristbands(prev => {
                                const next = new Set(prev);
                                next.has(wb.nfc_id) ? next.delete(wb.nfc_id) : next.add(wb.nfc_id);
                                return next;
                            });
                        }}
                        className={`p-4 flex items-center gap-3 transition-colors border-b last:border-0
                            ${!isActive ? 'opacity-50 bg-slate-100 cursor-not-allowed' : 'cursor-pointer hover:bg-slate-50'}
                            ${selectedWristbands.has(wb.nfc_id) ? 'bg-indigo-50' : ''}
                        `}
                    >
                        <Checkbox checked={selectedWristbands.has(wb.nfc_id)} disabled={!isActive} />
                        <div>
                            <div className="font-bold text-slate-800 flex items-center gap-2">
                                {wb.customer_name || `אורח ${idx + 1}`}
                                {!isActive && <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">לא פעיל</span>}
                            </div>
                            <div className="text-xs text-slate-400 font-mono">{wb.nfc_id}</div>
                        </div>
                    </div>
                    );
                }) : (
                    <div className="p-4 text-center text-slate-500">לא נמצאו צמידים מקושרים להזמנה זו</div>
                )}
              </div>
            </div>

            {/* Select Events */}
            <div className="space-y-3">
              <h3 className="font-bold text-slate-700 px-1">בחירת אירועים להוספה</h3>
              <div className="grid gap-2">
                {attractions.map(att => {
                  const conflictCount = Array.from(selectedWristbands).filter(nfcId => {
                      const wb = foundOrder.wristbands.find(w => w.nfc_id === nfcId);
                      return wb?.allowed_events?.includes(att.name);
                  }).length;
                  const isDisabled = conflictCount > 0;

                  return (
                  <div 
                    key={att.id}
                    onClick={() => {
                        if (isDisabled) return;
                        setSelectedEvents(prev => {
                            const next = new Set(prev);
                            next.has(att.id) ? next.delete(att.id) : next.add(att.id);
                            return next;
                        });
                    }}
                    className={`
                        p-4 rounded-xl border flex justify-between items-center transition-all relative
                        ${isDisabled ? 'bg-slate-50 border-slate-200 opacity-60 cursor-not-allowed' : 'cursor-pointer'}
                        ${!isDisabled && selectedEvents.has(att.id) ? 'bg-green-50 border-green-500 ring-1 ring-green-500' : ''}
                        ${!isDisabled && !selectedEvents.has(att.id) ? 'bg-white border-slate-200 hover:border-green-300' : ''}
                    `}
                  >
                    <div className="flex items-center gap-3">
                        <div className={`w-5 h-5 rounded-full border flex items-center justify-center 
                            ${isDisabled ? 'border-slate-300 bg-slate-200' : ''}
                            ${!isDisabled && selectedEvents.has(att.id) ? 'bg-green-500 border-green-500' : 'border-slate-300'}
                        `}>
                            {!isDisabled && selectedEvents.has(att.id) && <div className="w-2 h-2 bg-white rounded-full" />}
                        </div>
                        <div className="flex flex-col">
                            <span className={`font-medium ${isDisabled ? 'text-slate-500' : ''}`}>{att.name}</span>
                            {isDisabled && (
                                <span className="text-[10px] text-red-500 font-medium">
                                    {conflictCount === selectedWristbands.size ? 'קיים כבר בכל הצמידים שנבחרו' : `קיים ב-${conflictCount} צמידים שנבחרו`}
                                </span>
                            )}
                        </div>
                    </div>
                    <span className={`font-bold ${isDisabled ? 'text-slate-400' : 'text-slate-900'}`}>€{att.price_eur}</span>
                  </div>
                  );
                })}
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
                        {isSubmitting ? <Loader2 className="animate-spin" /> : 'הוסף אירועים ועדכן תשלום'}
                    </Button>
                </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}