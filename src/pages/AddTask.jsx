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

  // Fetch attractions/events
  const { data: attractions = [], isLoading: isLoadingAttractions } = useQuery({
    queryKey: ['attractions'],
    queryFn: () => base44.entities.Attraction.list(),
  });

  // Calculate total whenever selection or refund type changes
  useEffect(() => {
    let total = 0;
    selectedEvents.forEach(eventId => {
      const event = attractions.find(a => a.id === eventId);
      if (event && event.price_eur) {
        total += parseFloat(event.price_eur);
      }
    });

    if (refundType === 'partial') {
      total = total * 0.4;
    }

    setCalculatedAmount(total);
  }, [selectedEvents, refundType, attractions]);

  const handleEventToggle = (eventId) => {
    const newSelected = new Set(selectedEvents);
    if (newSelected.has(eventId)) {
      newSelected.delete(eventId);
    } else {
      newSelected.add(eventId);
    }
    setSelectedEvents(newSelected);
  };

  const handleOrderBlur = async () => {
    if (!orderNumber || orderNumber.length < 5) return;
    
    setIsFetchingOrder(true);
    try {
      const response = await base44.functions.invoke('fetchOrderData', { orderNumber });
      
      if (response.data) {
        // עדכון השדות הקיימים
        setCustomerName(response.data.customer || '');
        setHotelName(response.data.hotel || '');
        
        // עדכון תאריך העזיבה ישירות מהשדה החדש (עמודה B)
        if (response.data.departureDate) {
          setDepartureDate(response.data.departureDate);
        }
        
        toast.success("נתוני הזמנה נטענו");
      }
    } catch (error) {
       console.error("Fetch error:", error);
       toast.error("שגיאה במשיכת נתונים");
    } finally {
       setIsFetchingOrder(false);
    }
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
      // Create description string from selected events
      const eventNames = Array.from(selectedEvents).map(id => {
        const attr = attractions.find(a => a.id === id);
        return attr ? `${attr.name} (€${attr.price_eur})` : '';
      }).join(', ');

      await base44.entities.Task.create({
        title: `בקשת החזר ${refundType === 'full' ? 'מלא' : 'חלקי'} - הזמנה ${orderNumber}`,
        description: `אירועים שנבחרו: ${eventNames}`,
        status: 'todo',
        task_type: 'refund',
        refund_type: refundType,
        amount: parseFloat(calculatedAmount.toFixed(2)),
        currency: 'EUR',
        order_number: orderNumber,
        people_count: parseInt(peopleCount) || 0,
        departure_date: departureDate || '',
        due_date: new Date().toISOString().split('T')[0]
      });

      toast.success('הבקשה נשלחה בהצלחה');
      setSelectedEvents(new Set());
      setRefundType('partial');
      setOrderNumber('');
      setPeopleCount('');
      setDepartureDate('');
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
                <Label htmlFor="orderNumber">מספר הזמנה</Label>
                <div className="relative">
                  <Input
                    id="orderNumber"
                    value={orderNumber}
                    onChange={(e) => setOrderNumber(e.target.value)}
                    onBlur={handleOrderBlur}
                    placeholder="הזן מספר הזמנה"
                    className="text-right"
                  />
                  {isFetchingOrder && <Loader2 className="absolute left-2 top-2.5 h-4 w-4 animate-spin text-slate-400" />}
                  {departureDate && <p className="text-xs text-green-600 mt-1">תאריך עזיבה: {departureDate}</p>}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="peopleCount">כמות אנשים</Label>
                <Input
                  id="peopleCount"
                  type="number"
                  value={peopleCount}
                  onChange={(e) => setPeopleCount(e.target.value)}
                  placeholder="0"
                  className="text-right"
                  min="1"
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
                  attractions.map((event) => (
                    <div key={event.id} className="flex items-center space-x-3 space-x-reverse p-2 hover:bg-slate-50 rounded-md transition-colors">
                      <Checkbox 
                        id={event.id} 
                        checked={selectedEvents.has(event.id)}
                        onCheckedChange={() => handleEventToggle(event.id)}
                      />
                      <Label htmlFor={event.id} className="flex-1 cursor-pointer flex justify-between">
                        <span>{event.name}</span>
                        <span className="text-slate-500">€{event.price_eur}</span>
                      </Label>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Calculation Result */}
            <div className="bg-slate-100 p-6 rounded-xl flex flex-col items-center justify-center space-y-2">
              <span className="text-slate-600 font-medium">סכום להחזר</span>
              <div className="text-4xl font-bold text-slate-900">
                €{calculatedAmount.toFixed(2)}
              </div>
              <span className="text-sm text-slate-500">
                {refundType === 'partial' ? 'חישוב לפי 40% מערך האירועים' : 'חישוב לפי מחיר מלא'}
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