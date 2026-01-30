import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Calendar, Hotel, User, Hash } from "lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";

export default function AddTask() {
  const [orderNumber, setOrderNumber] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [hotelName, setHotelName] = useState('');
  const [departureDate, setDepartureDate] = useState('');
  const [isFetchingOrder, setIsFetchingOrder] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // פונקציה למשיכת נתונים בעת עזיבת שדה מספר ההזמנה
  const handleOrderBlur = async () => {
    if (!orderNumber || orderNumber.length < 5) return;
    
    setIsFetchingOrder(true);
    try {
      // קריאה לפונקציית הענן המעודכנת
      const response = await base44.functions.invoke('fetchOrderData', { orderNumber });
      
      if (response.data) {
        // עדכון השדות מהנתונים שחזרו מהשיטס
        setCustomerName(response.data.customer || '');
        setHotelName(response.data.hotel || '');
        
        // כאן אנחנו לוקחים את תאריך העזיבה ישירות מעמודה B
        if (response.data.departureDate) {
          setDepartureDate(response.data.departureDate);
          toast.success("נתוני הזמנה ותאריך עזיבה נטענו");
        } else {
          toast.warning("הזמנה נמצאה, אך חסר תאריך עזיבה בגיליון");
        }
      } else {
        toast.error("מספר הזמנה לא נמצא בגיליון");
      }
    } catch (error) {
       console.error("Error fetching order:", error);
       toast.error("שגיאה במשיכת נתונים מהשרת");
    } finally {
       setIsFetchingOrder(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!orderNumber || !departureDate) {
      toast.error("חובה למלא מספר הזמנה ותאריך עזיבה");
      return;
    }

    setIsSubmitting(true);
    try {
      await base44.entities.Tasks.create({
        order_number: orderNumber,
        customer_name: customerName,
        hotel_name: hotelName,
        departure_date: departureDate,
        status: 'pending'
      });
      
      toast.success("המשימה נוספה בהצלחה!");
      // ניקוי טופס
      setOrderNumber('');
      setCustomerName('');
      setHotelName('');
      setDepartureDate('');
    } catch (error) {
      toast.error("שגיאה בשמירת המשימה");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-4 max-w-2xl mx-auto" dir="rtl">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl text-center">הוספת משימה חדשה</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            
            <div className="space-y-2">
              <Label htmlFor="orderNumber">מספר הזמנה</Label>
              <div className="relative">
                <Input 
                  id="orderNumber"
                  value={orderNumber}
                  onChange={(e) => setOrderNumber(e.target.value)}
                  onBlur={handleOrderBlur}
                  placeholder="הזן מספר הזמנה..."
                  className="pr-10"
                />
                <Hash className="absolute right-3 top-2.5 h-5 w-5 text-slate-400" />
                {isFetchingOrder && (
                  <Loader2 className="absolute left-3 top-2.5 h-5 w-5 animate-spin text-blue-500" />
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="customerName">שם הלקוח</Label>
              <div className="relative">
                <Input 
                  id="customerName"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="pr-10"
                />
                <User className="absolute right-3 top-2.5 h-5 w-5 text-slate-400" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="hotelName">מלון</Label>
              <div className="relative">
                <Input 
                  id="hotelName"
                  value={hotelName}
                  onChange={(e) => setHotelName(e.target.value)}
                  className="pr-10"
                />
                <Hotel className="absolute right-3 top-2.5 h-5 w-5 text-slate-400" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="departureDate">תאריך עזיבה (מעמודה B)</Label>
              <div className="relative">
                <Input 
                  id="departureDate"
                  value={departureDate}
                  onChange={(e) => setDepartureDate(e.target.value)}
                  placeholder="DD/MM/YYYY"
                  className="pr-10"
                />
                <Calendar className="absolute right-3 top-2.5 h-5 w-5 text-slate-400" />
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : "שמור משימה"}
            </Button>

          </form>
        </CardContent>
      </Card>
    </div>
  );
}