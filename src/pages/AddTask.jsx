import React, { useState, useEffect } from 'react';
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { Loader2 } from "lucide-react";

export default function AddTask() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [refundType, setRefundType] = useState('partial'); // 'full' or 'partial'
  const [selectedEvents, setSelectedEvents] = useState(new Set());
  const [calculatedAmount, setCalculatedAmount] = useState(0);
  const [orderNumber, setOrderNumber] = useState('');
  const [peopleCount, setPeopleCount] = useState('');
  const [departureDate, setDepartureDate] = useState('');
  const [isFetchingOrder, setIsFetchingOrder] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [isCombo, setIsCombo] = useState(false);
  const [originalComboPrice, setOriginalComboPrice] = useState(null);

  // New state for wristbands
  const [orderWristbands, setOrderWristbands] = useState([]);
  const [selectedWristbandIds, setSelectedWristbandIds] = useState(new Set());
  const [isSearching, setIsSearching] = useState(false);
  const [searchTerm, setSearchTerm] = useState(''); // Replaces direct orderNumber input for searching
  const [scanLogs, setScanLogs] = useState([]);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const user = await base44.auth.me();
        setCurrentUser(user);
      } catch (e) { console.error(e); }
    };
    fetchUser();
  }, []);

  // Fetch attractions/events
  const { data: attractions = [], isLoading: isLoadingAttractions } = useQuery({
    queryKey: ['attractions'],
    queryFn: () => base44.entities.Attraction.list(),
  });

  const { data: comboPriceSetting } = useQuery({
    queryKey: ['appSettings', 'combo_price_eur'],
    queryFn: async () => {
        const settings = await base44.entities.AppSetting.filter({ key: 'combo_price_eur' });
        return settings[0]?.value || '550';
    },
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });

  // Calculate total whenever selection or refund type changes
  useEffect(() => {
    let total = 0;
    
    // Calculate total list price of ALL available attractions (for ratio calculation)
    const totalListPriceAll = attractions.reduce((sum, a) => sum + (parseFloat(a.price_eur) || 0), 0);
    
    // Use historical price if available, otherwise current setting
    const COMBO_PRICE = originalComboPrice !== null ? originalComboPrice : (parseFloat(comboPriceSetting) || 550);

    if (isCombo && totalListPriceAll > 0) {
        // Combo Logic: Calculate proportional value
        // Ratio = ComboPrice / TotalListPrice
        const ratio = COMBO_PRICE / totalListPriceAll;
        
        selectedEvents.forEach(eventId => {
            const event = attractions.find(a => a.id === eventId);
            if (event && event.price_eur) {
                // Effective price = List Price * Ratio
                total += (parseFloat(event.price_eur) * ratio);
            }
        });
    } else {
        // Normal Logic
        selectedEvents.forEach(eventId => {
            const event = attractions.find(a => a.id === eventId);
            if (event && event.price_eur) {
                total += parseFloat(event.price_eur);
            }
        });
    }

    if (refundType === 'partial') {
      total = total * 0.4; // 40% of the effective price
    }

    setCalculatedAmount(total);
  }, [selectedEvents, refundType, attractions, isCombo, comboPriceSetting]);

  const handleEventToggle = (eventId) => {
    const newSelected = new Set(selectedEvents);
    if (newSelected.has(eventId)) {
      newSelected.delete(eventId);
    } else {
      newSelected.add(eventId);
    }
    setSelectedEvents(newSelected);
  };

  const handleSearch = async () => {
    if (!searchTerm || searchTerm.length < 3) return;
    
    setIsFetchingOrder(true);
    setIsSearching(true);
    setOrderWristbands([]);
    setSelectedWristbandIds(new Set());
    
    let targetOrderNumber = searchTerm;

    try {
      // 1. Try to find if input is an NFC ID first
      const nfcSearch = searchTerm.toLowerCase().replace(/:/g, "");
      const wristbands = await base44.entities.Wristband.filter({ nfc_id: nfcSearch });
      
      let foundSpecificWristband = null;
      if (wristbands && wristbands.length > 0) {
        // It's a wristband scan/input
        targetOrderNumber = wristbands[0].order_number;
        foundSpecificWristband = wristbands[0];
        toast.info(`נמצא צמיד המשויך להזמנה ${targetOrderNumber}`);
      }

      // 2. Set the order number state
      setOrderNumber(targetOrderNumber);

      // 3. Fetch Order Data (departure date etc) & Check Combo
      try {
        // First try to find in TableData (internal DB)
        const tableOrders = await base44.entities.TableData.filter({ order_number: targetOrderNumber });
        if (tableOrders.length > 0) {
            // Use the most recent one
            const order = tableOrders[tableOrders.length - 1];
            setIsCombo(!!order.is_combo);
            if (order.departure_date) setDepartureDate(order.departure_date);

            // Calculate original combo price if applicable
            if (order.is_combo && order.requested_amount && order.customer) {
                const totalAmount = parseFloat(order.requested_amount);
                const customers = parseInt(order.customer);
                if (!isNaN(totalAmount) && !isNaN(customers) && customers > 0) {
                    const pricePerPerson = totalAmount / customers;
                    setOriginalComboPrice(pricePerPerson);
                    toast.info(`זוהתה עסקת קומבו לפי מחיר היסטורי: €${pricePerPerson.toFixed(2)}`);
                }
            } else {
                setOriginalComboPrice(null);
            }
        } else {
             // Fallback to Google Sheets
            const response = await base44.functions.invoke('fetchOrderData', { orderNumber: targetOrderNumber });
            if (response.data && response.data.departureDate) {
              setDepartureDate(response.data.departureDate);
            }
            setIsCombo(false); // Default to false if not found in DB
            setOriginalComboPrice(null);
        }
      } catch (err) {
        console.warn("Order data fetch warning:", err);
      }

      // 4. Fetch all wristbands for this order
      const allOrderWristbands = await base44.entities.Wristband.filter({ order_number: targetOrderNumber });
      setOrderWristbands(allOrderWristbands);

      // Fetch Scan Logs
      const logs = await base44.entities.WristbandScanLog.filter({ order_number: targetOrderNumber });
      setScanLogs(logs);

      // 5. Pre-select specific wristband if found, otherwise select none (or all? let's default to none so user chooses)
      // Actually user asked "option to request refund... by selecting specific wristband".
      // If searched by NFC, select that one.
      if (foundSpecificWristband) {
        setSelectedWristbandIds(new Set([foundSpecificWristband.nfc_id]));
        setPeopleCount('1'); // Auto set count to 1
      } else {
        // If searched by order number, maybe select all by default? Or let user select.
        // Let's select all by default for convenience if searched by order number
        if (allOrderWristbands.length > 0) {
            const allIds = new Set(allOrderWristbands.map(wb => wb.nfc_id));
            setSelectedWristbandIds(allIds);
            setPeopleCount(allOrderWristbands.length.toString());
        }
      }

      toast.success("נתוני הזמנה וצמידים נטענו");

    } catch (error) {
       console.error("Search error:", error);
       toast.error("שגיאה בחיפוש (לא נמצאה הזמנה או צמיד)");
    } finally {
       setIsFetchingOrder(false);
       setIsSearching(false);
    }
  };

  const handleWristbandToggle = (nfcId) => {
    const newSelected = new Set(selectedWristbandIds);
    if (newSelected.has(nfcId)) {
      newSelected.delete(nfcId);
    } else {
      newSelected.add(nfcId);
    }
    setSelectedWristbandIds(newSelected);
    setPeopleCount(newSelected.size.toString());
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (selectedEvents.size === 0) {
      toast.error('יש לבחור לפחות אירוע אחד');
      return;
    }

    if (!orderNumber) {
      toast.error('יש להזין מספר הזמנה');
      return;
    }

    if (!peopleCount) {
      toast.error('יש להזין כמות אנשים');
      return;
    }

    setLoading(true);
    try {
      // Create description string and array of event names
      const eventDetails = Array.from(selectedEvents).map(id => {
        const attr = attractions.find(a => a.id === id);
        return attr ? { name: attr.name, desc: `${attr.name} (€${attr.price_eur})` } : null;
      }).filter(Boolean);

      const descriptionText = eventDetails.map(e => e.desc).join(', ');
      const relatedEvents = eventDetails.map(e => e.name);

      await base44.entities.Task.create({
        title: `בקשת החזר ${refundType === 'full' ? 'מלא' : 'חלקי'} - הזמנה ${orderNumber}`,
        description: `אירועים שנבחרו: ${descriptionText}\nעבור ${selectedWristbandIds.size > 0 ? selectedWristbandIds.size : 'כל ה'} צמידים`,
        status: 'todo',
        task_type: 'refund',
        refund_type: refundType,
        amount: parseFloat(calculatedAmount.toFixed(2)),
        currency: 'EUR',
        order_number: orderNumber,
        people_count: parseInt(peopleCount) || 0,
        departure_date: departureDate || '',
        due_date: new Date().toISOString().split('T')[0],
        related_events: relatedEvents,
        related_wristbands: Array.from(selectedWristbandIds), // Save specific wristbands
        sales_rep: currentUser?.full_name || ''
      });

      navigate(createPageUrl('TaskSentSuccess'));
      } catch (error) {
      console.error(error);
      toast.error('שגיאה ביצירת הבקשה');
    } finally {
      setLoading(false);
    }
  };

  if (isLoadingAttractions) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 p-8 flex items-center justify-center" dir="rtl">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">בקשת החזר חדשה</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-8">
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="search">מספר הזמנה / מס' צמיד</Label>
                <div className="relative flex gap-2">
                  <Input
                    id="search"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleSearch())}
                    placeholder="הזן מספר הזמנה או סרוק צמיד"
                    className="text-right"
                  />
                  <Button type="button" onClick={handleSearch} disabled={isFetchingOrder}>
                    {isFetchingOrder ? <Loader2 className="animate-spin" /> : 'חפש'}
                  </Button>
                </div>
                {orderNumber && <p className="text-sm font-bold text-indigo-600 mt-1">זוהתה הזמנה: {orderNumber}</p>}
                {departureDate && <p className="text-xs text-green-600 mt-1">תאריך עזיבה: {departureDate}</p>}
              </div>

              {/* Wristband Selection Section */}
              {orderWristbands.length > 0 && (
                <div className="col-span-2 space-y-2 border rounded-lg p-3 bg-slate-50">
                  <Label className="text-sm font-semibold">בחר צמידים להחזר ({selectedWristbandIds.size} נבחרו)</Label>
                  <div className="max-h-40 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {orderWristbands.map(wb => (
                      <div key={wb.id} className={`flex items-center gap-2 p-2 rounded border ${selectedWristbandIds.has(wb.nfc_id) ? 'bg-indigo-50 border-indigo-200' : 'bg-white'}`}>
                        <Checkbox 
                          id={`wb-${wb.id}`}
                          checked={selectedWristbandIds.has(wb.nfc_id)}
                          onCheckedChange={() => handleWristbandToggle(wb.nfc_id)}
                        />
                        <div className="flex flex-col">
                          <Label htmlFor={`wb-${wb.id}`} className="cursor-pointer font-medium">{wb.customer_name || 'אורח'}</Label>
                          <span className="text-xs text-slate-400 font-mono">{wb.nfc_id}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="peopleCount">כמות אנשים (מחושב אוטומטית)</Label>
                <Input
                  id="peopleCount"
                  type="number"
                  value={peopleCount}
                  onChange={(e) => setPeopleCount(e.target.value)}
                  placeholder="0"
                  className="text-right bg-slate-100"
                  min="1"
                  readOnly={selectedWristbandIds.size > 0} // Read only if wristbands are selected
                />
              </div>
            </div>

            {/* Refund Type Selection */}
            <div className="space-y-3">
              <Label className="text-lg font-semibold">סוג החזר</Label>
              <RadioGroup 
                value={refundType} 
                onValueChange={setRefundType}
                className="flex gap-6"
                dir="rtl"
              >
                <div className="flex items-center space-x-2 space-x-reverse">
                  <RadioGroupItem value="partial" id="partial" />
                  <Label htmlFor="partial" className="cursor-pointer">החזר חלקי (40%)</Label>
                </div>
                <div className="flex items-center space-x-2 space-x-reverse">
                  <RadioGroupItem value="full" id="full" />
                  <Label htmlFor="full" className="cursor-pointer">החזר מלא (100%)</Label>
                </div>
              </RadioGroup>
            </div>

            {/* Events Selection */}
            <div className="space-y-3">
              <Label className="text-lg font-semibold">בחירת אירועים</Label>
              <div className="border rounded-lg p-4 space-y-3 max-h-[300px] overflow-y-auto bg-white">
                {attractions.length === 0 ? (
                  <p className="text-slate-500 text-center py-4">אין אירועים זמינים</p>
                ) : (
                  attractions.map((event) => {
                    let isDisabled = false;
                    let disabledReason = '';

                    if (refundType === 'partial' && orderNumber) {
                      const targetWristbands = orderWristbands.length > 0 
                        ? (selectedWristbandIds.size > 0 
                            ? orderWristbands.filter(wb => selectedWristbandIds.has(wb.nfc_id)) 
                            : orderWristbands)
                        : [];

                      if (targetWristbands.length > 0) {
                        const isBoughtByAll = targetWristbands.every(wb => (wb.allowed_events || []).includes(event.name));
                        const isScannedByAny = targetWristbands.some(wb => 
                          scanLogs.some(log => 
                            log.nfc_id === wb.nfc_id && 
                            log.event_name === event.name && 
                            (log.status === 'success' || log.status === 'processed')
                          )
                        );

                        if (!isBoughtByAll) {
                          isDisabled = true;
                          disabledReason = 'לא נרכש';
                        } else if (isScannedByAny) {
                          isDisabled = true;
                          disabledReason = 'כבר נסרק';
                        }
                      }
                    }

                    return (
                      <div key={event.id} className={`flex items-center space-x-3 space-x-reverse p-2 rounded-md transition-colors ${isDisabled ? 'bg-slate-100 opacity-60' : 'hover:bg-slate-50'}`}>
                        <Checkbox 
                          id={event.id} 
                          checked={selectedEvents.has(event.id)}
                          onCheckedChange={() => !isDisabled && handleEventToggle(event.id)}
                          disabled={isDisabled}
                        />
                        <Label htmlFor={event.id} className={`flex-1 flex justify-between ${isDisabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                          <div className="flex items-center gap-2">
                            <span>{event.name}</span>
                            {isDisabled && (
                              <span className="text-xs text-red-500 font-medium">
                                ({disabledReason})
                              </span>
                            )}
                          </div>
                          <span className="text-slate-500">€{event.price_eur}</span>
                        </Label>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Calculation Result */}
            <div className="bg-slate-100 p-6 rounded-xl flex flex-col items-center justify-center space-y-2 relative overflow-hidden">
              {isCombo && (
                  <div className="absolute top-0 right-0 bg-yellow-400 text-yellow-900 text-xs font-bold px-3 py-1 rounded-bl-lg shadow-sm">
                      חישוב לפי מחיר קומבו (יחסי)
                  </div>
              )}
              {originalComboPrice !== null && (
                  <div className="absolute top-0 left-0 bg-blue-100 text-blue-800 text-xs font-bold px-3 py-1 rounded-br-lg shadow-sm">
                      לפי מחיר היסטורי: €{originalComboPrice.toFixed(2)}
                  </div>
              )}
              <span className="text-slate-600 font-medium">סכום להחזר</span>
              <div className="text-4xl font-bold text-slate-900">
                €{calculatedAmount.toFixed(2)}
              </div>
              <span className="text-sm text-slate-500">
                {refundType === 'partial' ? 'חישוב לפי 40%' : 'חישוב מלא'} 
                {isCombo ? ' מתוך הערך היחסי בקומבו' : ' ממחיר המחירון'}
              </span>
            </div>

            <div className="flex gap-3 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                className="flex-1 h-12"
                onClick={() => navigate(createPageUrl('Tasks'))}
              >
                ביטול
              </Button>
              <Button 
                type="submit" 
                className="flex-1 h-12 bg-slate-900 text-white hover:bg-slate-800 text-lg"
                disabled={loading || selectedEvents.size === 0}
              >
                {loading ? 'שולח...' : 'שלח בקשה'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}