import React, { useState, useRef, useMemo } from 'react';
import { useQuery, useMutation } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, TicketPlus, ScanLine, AlertCircle, ArrowRight } from "lucide-react";
import { getNextEventDate } from "@/utils/dateHelpers";
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

  const { data: comboPriceSetting } = useQuery({
    queryKey: ['appSettings', 'combo_price_eur'],
    queryFn: async () => {
        const settings = await base44.entities.AppSetting.filter({ key: 'combo_price_eur' });
        return settings[0]?.value || '550';
    },
    staleTime: 1000 * 60 * 5,
  });

  const comboPrice = parseFloat(comboPriceSetting) || 550;

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
      toast.error(`שגיאה בחיפוש: ${e.message || 'אנא נסה שוב'}`);
    }
  };

  const handleNFCScan = async () => {
    if (!('NDEFReader' in window)) return toast.error("אין תמיכה ב-NFC בדפדפן זה");
    
    setIsScanning(true);
    try {
      const ndef = new window.NDEFReader();
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
      toast.error(`שגיאה בהפעלת הסורק: ${e.message || 'וודא ש-NFC פעיל'}`);
    }
  };

  const handleSubmit = async () => {
    if (!foundOrder || selectedWristbands.size === 0 || selectedEvents.size === 0) {
      return toast.error("נא לבחור צמידים ואירועים");
    }

    setIsSubmitting(true);
    try {
      let anyEventAdded = false;
      let isAnyComboNow = false;

      // 1. Update Wristbands Immediately
      const updatePromises = Array.from(selectedWristbands).map(async (nfcId) => {
          const wb = foundOrder.wristbands.find(w => w.nfc_id === nfcId);
          if (wb && wb.status === 'active') {
              const currentEvents = wb.allowed_events || [];
              const currentBaseNames = currentEvents.map(e => e.split(' - ')[0]);
              
              // Find which selected events this wristband doesn't have yet
              const eventsToAdd = Array.from(selectedEvents).filter(id => {
                  const ev = attractions.find(a => a.id === id);
                  return ev && !currentBaseNames.includes(ev.name);
              });
              
              if (eventsToAdd.length > 0) {
                  anyEventAdded = true;
                  
                  const eventNamesToAdd = eventsToAdd.map(id => {
                      const att = attractions.find(a => a.id === id);
                      const nextDateStr = getNextEventDate(att.event_days, att.start_time);
                      return nextDateStr ? `${att.name} - ${nextDateStr.split('-').reverse().join('/')}` : att.name;
                  });
                  
                  const uniqueEvents = [...new Set([...currentEvents, ...eventNamesToAdd])];
                  
                  // Check if it became a combo
                  const newBaseNames = uniqueEvents.map(e => e.split(' - ')[0]);
                  if (new Set(newBaseNames).size >= attractions.length) {
                      isAnyComboNow = true;
                  }

                  return base44.entities.Wristband.update(wb.id, { allowed_events: uniqueEvents });
              }
          }
          return Promise.resolve();
      });
      await Promise.all(updatePromises);

      if (!anyEventAdded) {
          setIsSubmitting(false);
          return toast.error("האירועים שנבחרו כבר קיימים בכל הצמידים שסומנו");
      }

      // 2. Create PendingSale Immediately
      const oldRequested = parseFloat(foundOrder.details.requested_amount || 0);
      const newRequested = oldRequested + calculatedTotal;

      const baseData = {
          customer: foundOrder.details.customer,
          departure_date: foundOrder.details.departure_date,
          nights: foundOrder.details.nights,
          gender: foundOrder.details.gender,
          hotel: foundOrder.details.hotel,
          company: foundOrder.details.company,
      };

      await base44.entities.PendingSale.create({
          order_number: foundOrder.details.order_number,
          requested_amount: newRequested.toString(),
          comments: foundOrder.details.comments, 
          sales_rep: foundOrder.details.sales_rep, 
          ...baseData,
          eur_amount: foundOrder.details.eur_amount || "0",
          shekel_amount: foundOrder.details.shekel_amount || "0",
          dollar_amount: foundOrder.details.dollar_amount || "0",
          bit_amount: foundOrder.details.bit_amount || "0",
          eur_status: foundOrder.details.eur_status || "0", 
          is_combo: foundOrder.details.is_combo || isAnyComboNow,
          created_date: new Date().toISOString()
      });

      toast.success("האירועים נוספו והתשלום עבר למכירה בהמתנה");
      navigate(createPageUrl('SellerDashboard'));

    } catch (e) {
      console.error(e);
      toast.error(`שגיאה בשליחת הבקשה: ${e.message || 'אנא נסה שוב מאוחר יותר'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Calculations ---
  const { calculatedTotal, isUpgradingToCombo } = useMemo(() => {
    let total = 0;
    let upgraded = false;
    
    if (!attractions || attractions.length === 0) return { calculatedTotal: 0, isUpgradingToCombo: false };

    Array.from(selectedWristbands).forEach(nfcId => {
      const wb = foundOrder?.wristbands.find(w => w.nfc_id === nfcId);
      if (!wb) return;
      
      const currentEvents = wb.allowed_events || [];
      const currentBaseNames = currentEvents.map(e => e.split(' - ')[0]);
      
      const newValidEvents = Array.from(selectedEvents).filter(id => {
         const ev = attractions.find(a => a.id === id);
         return ev && !currentBaseNames.includes(ev.name);
      });
      
      const newBaseNames = newValidEvents.map(id => attractions.find(a => a.id === id).name);
      
      const allBaseNames = new Set([...currentBaseNames, ...newBaseNames]);
      
      const isComboNow = allBaseNames.size >= attractions.length;
      const wasComboBefore = currentBaseNames.length >= attractions.length;
      
      if (isComboNow && !wasComboBefore) {
         upgraded = true;
         const alreadyPaid = currentBaseNames.reduce((sum, name) => {
             const att = attractions.find(a => a.name === name);
             return sum + (att?.price_eur || 0);
         }, 0);
         total += Math.max(0, comboPrice - alreadyPaid);
      } else {
         total += newValidEvents.reduce((sum, id) => {
            const ev = attractions.find(a => a.id === id);
            return sum + (ev?.price_eur || 0);
         }, 0);
      }
    });

    return { calculatedTotal: total, isUpgradingToCombo: upgraded };
  }, [selectedEvents, selectedWristbands, attractions, foundOrder, comboPrice]);

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
                        <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-bold text-lg">הזמנה {foundOrder.details.order_number}</h3>
                            {foundOrder.details.is_combo && (
                                <Badge className="bg-yellow-400 text-yellow-900 hover:bg-yellow-500">
                                    COMBO
                                </Badge>
                            )}
                        </div>
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
                      return wb?.allowed_events?.some(e => e.split(' - ')[0] === att.name);
                  }).length;
                  const isDisabled = conflictCount > 0;

                  const isSelected = !isDisabled && selectedEvents.has(att.id);

                  return (
                  <div key={att.id} className={`flex flex-col gap-3 p-4 rounded-xl border transition-all relative ${isDisabled ? 'bg-slate-50 border-slate-200 opacity-60 cursor-not-allowed' : 'cursor-pointer'} ${isSelected ? 'bg-green-50 border-green-500 ring-1 ring-green-500' : ''} ${!isDisabled && !isSelected ? 'bg-white border-slate-200 hover:border-green-300' : ''}`}>
                      <div 
                        onClick={() => {
                            if (isDisabled) return;
                            setSelectedEvents(prev => {
                                const next = new Set(prev);
                                next.has(att.id) ? next.delete(att.id) : next.add(att.id);
                                return next;
                            });
                        }}
                        className="flex justify-between items-center"
                      >
                        <div className="flex items-center gap-3">
                            <div className={`w-5 h-5 rounded-full border flex items-center justify-center 
                                ${isDisabled ? 'border-slate-300 bg-slate-200' : ''}
                                ${isSelected ? 'bg-green-500 border-green-500' : 'border-slate-300'}
                            `}>
                                {isSelected && <div className="w-2 h-2 bg-white rounded-full" />}
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
                      
                      {isSelected && getNextEventDate(att.event_days, att.start_time) && (
                        <div className="pl-9 pr-2 pb-2">
                            <span className="text-xs font-medium text-green-700 bg-green-100 px-2 py-1 rounded-md block w-fit">
                                תאריך נבחר: {getNextEventDate(att.event_days, att.start_time).split('-').reverse().join('/')}
                            </span>
                        </div>
                      )}
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
                        <div className="flex items-center gap-2">
                            <span className="text-2xl font-black text-slate-900">€{calculatedTotal}</span>
                            {isUpgradingToCombo && (
                                <Badge className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white animate-pulse border-none">
                                    שדרוג לקומבו!
                                </Badge>
                            )}
                        </div>
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