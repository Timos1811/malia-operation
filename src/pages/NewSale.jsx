import React, { useState, useMemo } from 'react';
import { useQuery, useMutation } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Calculator, Save, Calendar, Users, Hotel, Moon, Hash, User, PartyPopper } from "lucide-react";
import { toast } from "sonner";
import { createPageUrl } from '../utils';

export default function NewSale() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    orderNumber: '',
    departureDate: '',
    customerCount: '1',
    nights: '',
    gender: '',
    hotel: ''
  });
  const [selectedAttractions, setSelectedAttractions] = useState(new Set());

  // Fetch available attractions (parties)
  const { data: attractions = [], isLoading: isLoadingAttractions } = useQuery({
    queryKey: ['attractions'],
    queryFn: () => base44.entities.Attraction.list(),
  });

  // Calculate total price: (Sum of selected attractions) * Customer Count
  const totalPrice = useMemo(() => {
    const customerCount = parseInt(formData.customerCount) || 0;
    let attractionsSum = 0;
    
    selectedAttractions.forEach(attractionId => {
      const attraction = attractions.find(a => a.id === attractionId);
      if (attraction) {
        attractionsSum += (attraction.price_eur || 0);
      }
    });

    return attractionsSum * customerCount;
  }, [selectedAttractions, formData.customerCount, attractions]);

  const createSaleMutation = useMutation({
    mutationFn: (data) => base44.entities.TableData.create(data),
    onSuccess: () => {
      toast.success('ההזמנה נוצרה בהצלחה!');
      navigate(createPageUrl('SavedData'));
    },
    onError: (error) => {
      toast.error('שגיאה ביצירת ההזמנה: ' + error.message);
    }
  });

  const handleToggleAttraction = (attractionId) => {
    const newSelected = new Set(selectedAttractions);
    if (newSelected.has(attractionId)) {
      newSelected.delete(attractionId);
    } else {
      newSelected.add(attractionId);
    }
    setSelectedAttractions(newSelected);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!formData.orderNumber || !formData.departureDate) {
      toast.error('נא למלא שדות חובה');
      return;
    }

    // Determine company based on order number prefix (logic copied from SavedData)
    let company = '';
    const trimmedOrder = formData.orderNumber.trim();
    if (trimmedOrder.startsWith('5')) company = 'קשרי תעופה';
    else if (trimmedOrder.startsWith('1')) company = 'נטו פאן';
    else if (trimmedOrder.length > 0) company = 'כספר';

    // Construct the description of selected parties
    const selectedNames = Array.from(selectedAttractions)
      .map(id => attractions.find(a => a.id === id)?.name)
      .filter(Boolean)
      .join(', ');

    const payload = {
      order_number: trimmedOrder,
      departure_date: formData.departureDate,
      customer: formData.customerCount, // Saving count as customer string
      nights: formData.nights,
      gender: formData.gender,
      hotel: formData.hotel,
      company: company,
      requested_amount: totalPrice.toString(),
      eur_amount: totalPrice.toString(), // Assuming payment is in EUR for parties
      eur_status: "0" // Initial status
    };

    createSaleMutation.mutate(payload);
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-24" dir="rtl">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10 px-4 py-4 shadow-sm">
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <PartyPopper className="w-5 h-5 text-indigo-600" />
          מכירה חדשה
        </h1>
      </div>

      <div className="p-4 max-w-md mx-auto space-y-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* Order Details Card */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-3 bg-slate-50/50 border-b border-slate-100">
              <CardTitle className="text-lg text-slate-700">פרטי הזמנה</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              
              <div className="space-y-2">
                <Label htmlFor="orderNumber" className="flex items-center gap-1">
                  <Hash className="w-4 h-4 text-slate-400" /> מספר הזמנה
                </Label>
                <Input
                  id="orderNumber"
                  type="number"
                  placeholder="הכנס מספר הזמנה..."
                  value={formData.orderNumber}
                  onChange={(e) => setFormData({...formData, orderNumber: e.target.value})}
                  className="text-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="departureDate" className="flex items-center gap-1">
                    <Calendar className="w-4 h-4 text-slate-400" /> תאריך עזיבה
                  </Label>
                  <Input
                    id="departureDate"
                    type="date"
                    value={formData.departureDate}
                    onChange={(e) => setFormData({...formData, departureDate: e.target.value})}
                  />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="customerCount" className="flex items-center gap-1">
                      <Users className="w-4 h-4 text-slate-400" /> כמות לקוחות
                    </Label>
                    <Input
                      id="customerCount"
                      type="number"
                      min="1"
                      value={formData.customerCount}
                      onChange={(e) => setFormData({...formData, customerCount: e.target.value})}
                    />
                  </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nights" className="flex items-center gap-1">
                    <Moon className="w-4 h-4 text-slate-400" /> לילות
                  </Label>
                  <Input
                    id="nights"
                    type="number"
                    value={formData.nights}
                    onChange={(e) => setFormData({...formData, nights: e.target.value})}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="gender" className="flex items-center gap-1">
                    <User className="w-4 h-4 text-slate-400" /> מגדר
                  </Label>
                  <Select 
                    value={formData.gender} 
                    onValueChange={(value) => setFormData({...formData, gender: value})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="בחר..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="גברים">גברים</SelectItem>
                      <SelectItem value="נשים">נשים</SelectItem>
                      <SelectItem value="מעורב">מעורב</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="hotel" className="flex items-center gap-1">
                  <Hotel className="w-4 h-4 text-slate-400" /> מלון
                </Label>
                <Input
                  id="hotel"
                  placeholder="שם המלון..."
                  value={formData.hotel}
                  onChange={(e) => setFormData({...formData, hotel: e.target.value})}
                />
              </div>

            </CardContent>
          </Card>

          {/* Attractions Selection */}
          <Card className="border-slate-200 shadow-sm">
             <CardHeader className="pb-3 bg-slate-50/50 border-b border-slate-100">
              <CardTitle className="text-lg text-slate-700">בחירת מסיבות / אירועים</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              {isLoadingAttractions ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                </div>
              ) : (
                <div className="space-y-3">
                  {attractions.map((attraction) => (
                    <div 
                      key={attraction.id}
                      onClick={() => handleToggleAttraction(attraction.id)}
                      className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${
                        selectedAttractions.has(attraction.id) 
                          ? 'border-indigo-500 bg-indigo-50' 
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Checkbox 
                          checked={selectedAttractions.has(attraction.id)}
                          onCheckedChange={() => handleToggleAttraction(attraction.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <span className="font-medium text-slate-700">{attraction.name}</span>
                      </div>
                      <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-sm font-semibold">
                        €{attraction.price_eur}
                      </span>
                    </div>
                  ))}
                  {attractions.length === 0 && (
                     <p className="text-center text-slate-500 py-2">לא נמצאו מסיבות במערכת</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

        </form>
      </div>

      {/* Sticky Bottom Footer for Total & Submit */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
        <div className="max-w-md mx-auto flex flex-col gap-3">
          <div className="flex justify-between items-center px-2">
            <div className="text-sm text-slate-500">סה"כ לתשלום:</div>
            <div className="text-2xl font-bold text-indigo-600 flex items-center gap-1">
              <span>€</span>
              {totalPrice.toFixed(2)}
            </div>
          </div>
          <div className="text-xs text-slate-400 text-center mb-1">
            ( {selectedAttractions.size} מסיבות × {formData.customerCount || 0} לקוחות )
          </div>
          <Button 
            size="lg" 
            className="w-full bg-slate-900 hover:bg-slate-800 text-lg py-6 shadow-lg"
            onClick={handleSubmit}
            disabled={createSaleMutation.isPending}
          >
            {createSaleMutation.isPending ? (
              <Loader2 className="w-5 h-5 animate-spin ml-2" />
            ) : (
              <Save className="w-5 h-5 ml-2" />
            )}
            שמור הזמנה
          </Button>
        </div>
      </div>

    </div>
  );
}