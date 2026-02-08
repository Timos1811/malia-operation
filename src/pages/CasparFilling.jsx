import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Send, CheckCircle2 } from "lucide-react";

export default function CasparFilling() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  
  const { register, handleSubmit, reset, formState: { errors } } = useForm();

  const onSubmit = async (data) => {
    setIsSubmitting(true);
    try {
      await base44.entities.CasparFilling.create({
        full_name: data.full_name,
        phone_number: data.phone_number,
        hotel: data.hotel,
        departure_date: data.departure_date,
        people_count: parseInt(data.people_count, 10)
      });
      
      setIsSuccess(true);
      toast.success("הפרטים נשמרו בהצלחה!");
      reset();
      
      // Reset success message after 3 seconds to allow adding more
      setTimeout(() => setIsSuccess(false), 3000);
    } catch (error) {
      console.error(error);
      toast.error("שגיאה בשמירת הנתונים");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 flex items-center justify-center" dir="rtl">
      <Card className="w-full max-w-md shadow-lg border-0">
        <CardHeader className="bg-slate-900 text-white rounded-t-xl pb-8 pt-6">
          <CardTitle className="text-2xl font-bold text-center">מילוי כספרים</CardTitle>
        </CardHeader>
        
        <CardContent className="pt-8 px-6 pb-8">
          {isSuccess ? (
            <div className="text-center py-10 space-y-4 animate-in fade-in zoom-in duration-300">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto text-green-600">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h3 className="text-2xl font-bold text-slate-800">הפרטים נקלטו!</h3>
              <p className="text-slate-500">תודה רבה, הנתונים נשמרו במערכת.</p>
              <Button 
                onClick={() => setIsSuccess(false)} 
                className="mt-6 w-full"
                variant="outline"
              >
                הוסף רשומה חדשה
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              
              <div className="space-y-2">
                <Label htmlFor="full_name" className="text-base">שם מלא</Label>
                <Input 
                  id="full_name" 
                  {...register("full_name", { required: "שדה חובה" })}
                  className="h-12 text-lg"
                  placeholder="הכנס שם מלא"
                />
                {errors.full_name && <span className="text-red-500 text-sm">{errors.full_name.message}</span>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone_number" className="text-base">מספר טלפון</Label>
                <Input 
                  id="phone_number" 
                  type="tel"
                  {...register("phone_number", { required: "שדה חובה" })}
                  className="h-12 text-lg"
                  placeholder="050-0000000"
                  dir="ltr"
                  style={{ textAlign: 'right' }}
                />
                {errors.phone_number && <span className="text-red-500 text-sm">{errors.phone_number.message}</span>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="hotel" className="text-base">מלון</Label>
                <Input 
                  id="hotel" 
                  {...register("hotel", { required: "שדה חובה" })}
                  className="h-12 text-lg"
                  placeholder="שם המלון"
                />
                {errors.hotel && <span className="text-red-500 text-sm">{errors.hotel.message}</span>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="departure_date" className="text-base">תאריך עזיבה</Label>
                <Input 
                  id="departure_date" 
                  type="date"
                  {...register("departure_date", { required: "שדה חובה" })}
                  className="h-12 text-lg"
                />
                {errors.departure_date && <span className="text-red-500 text-sm">{errors.departure_date.message}</span>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="people_count" className="text-base">כמות אנשים</Label>
                <Input 
                  id="people_count" 
                  type="number"
                  min="1"
                  {...register("people_count", { required: "שדה חובה", min: 1 })}
                  className="h-12 text-lg"
                  placeholder="0"
                />
                {errors.people_count && <span className="text-red-500 text-sm">{errors.people_count.message}</span>}
              </div>

              <Button 
                type="submit" 
                className="w-full h-12 text-lg font-medium bg-blue-600 hover:bg-blue-700 mt-4 shadow-md transition-all active:scale-95"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 ml-2 animate-spin" /> שומר...
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5 ml-2" /> שלח פרטים
                  </>
                )}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}