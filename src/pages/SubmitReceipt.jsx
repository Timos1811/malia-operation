import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Camera, Upload, Loader2, ArrowRight, Receipt } from "lucide-react";
import { toast } from "sonner";
import { createPageUrl } from '../utils';

const EXPENSE_CATEGORIES = [
  "אחר", "דלק", "פינוק ללקוחות"
];

export default function SubmitReceipt() {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const [loading, setLoading] = useState(false);

  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [category, setCategory] = useState("אחר");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("EUR");
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState("");

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setPreviewUrl(URL.createObjectURL(selectedFile));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
      toast.error("יש להזין סכום תקין");
      return;
    }
    
    setLoading(true);
    try {
      let fileUrl = null;
      if (file) {
        toast.info("מעלה תמונה...");
        const res = await base44.integrations.Core.UploadFile({ file });
        fileUrl = res.file_url;
      }

      toast.info("יוצר משימה חדשה...");
      await base44.entities.Task.create({
        title: `הגשת קבלה - ${category}`,
        description: description || "ממתין לבדיקה ואישור קבלה.",
        status: "todo",
        due_date: new Date().toISOString().split('T')[0],
        task_type: "expense_receipt",
        sales_rep: currentUser?.full_name || currentUser?.email,
        receipt_file_url: fileUrl,
        expense_category: category,
        expense_amount: parseFloat(amount),
        expense_currency: currency,
        actual_expense_date: expenseDate,
      });

      toast.success("הקבלה נשלחה בהצלחה!");
      navigate(createPageUrl('SellerDashboard'));
    } catch (error) {
      console.error(error);
      toast.error("שגיאה בשליחת הקבלה");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8" dir="rtl">
      <div className="max-w-md mx-auto space-y-6">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full">
            <ArrowRight className="w-5 h-5" />
          </Button>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-slate-800">
            <Receipt className="w-6 h-6 text-indigo-600" />
            הגשת קבלה חדשה
          </h1>
        </div>

        <Card className="border-none shadow-lg">
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              
              {/* Image Upload */}
              <div className="space-y-3">
                <Label>צילום קבלה</Label>
                <div className="flex gap-3">
                  <div className="relative flex-1">
                    <Input 
                      type="file" 
                      accept="image/*" 
                      capture="environment"
                      onChange={handleFileChange} 
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    <Button type="button" variant="outline" className="w-full h-24 flex flex-col gap-2 border-dashed border-2 border-slate-300 hover:border-indigo-400 hover:bg-indigo-50">
                      <Camera className="w-6 h-6 text-slate-400" />
                      <span className="text-slate-500">צלם במקום</span>
                    </Button>
                  </div>
                  <div className="relative flex-1">
                    <Input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleFileChange} 
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    <Button type="button" variant="outline" className="w-full h-24 flex flex-col gap-2 border-dashed border-2 border-slate-300 hover:border-indigo-400 hover:bg-indigo-50">
                      <Upload className="w-6 h-6 text-slate-400" />
                      <span className="text-slate-500">העלה מגלריה</span>
                    </Button>
                  </div>
                </div>
                {previewUrl && (
                  <div className="mt-4 relative rounded-xl overflow-hidden border border-slate-200 bg-slate-100 h-48 flex justify-center">
                    <img src={previewUrl} alt="Preview" className="h-full object-contain" />
                  </div>
                )}
              </div>

              {/* Category */}
              <div className="space-y-2">
                <Label>קטגוריה</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="bg-slate-50 text-right" dir="rtl">
                    <SelectValue placeholder="בחר קטגוריה" />
                  </SelectTrigger>
                  <SelectContent dir="rtl">
                    {EXPENSE_CATEGORIES.map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Amount and Currency */}
              <div className="flex gap-4">
                <div className="space-y-2 flex-[2]">
                  <Label>סכום</Label>
                  <Input 
                    type="number" 
                    step="0.01"
                    min="0"
                    placeholder="0.00" 
                    value={amount} 
                    onChange={e => setAmount(e.target.value)} 
                    className="bg-slate-50 font-mono text-lg"
                  />
                </div>
                <div className="space-y-2 flex-1">
                  <Label>מטבע</Label>
                  <Select value={currency} onValueChange={setCurrency}>
                    <SelectTrigger className="bg-slate-50" dir="rtl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent dir="rtl">
                      <SelectItem value="EUR">EUR</SelectItem>
                      <SelectItem value="ILS">ILS</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Date */}
              <div className="space-y-2">
                <Label>תאריך הוצאה</Label>
                <Input 
                  type="date" 
                  value={expenseDate} 
                  onChange={e => setExpenseDate(e.target.value)} 
                  className="bg-slate-50"
                />
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label>הערות (אופציונלי)</Label>
                <Textarea 
                  placeholder="פרטים נוספים שיעזרו לאישור..." 
                  value={description} 
                  onChange={e => setDescription(e.target.value)} 
                  className="bg-slate-50 resize-none h-20"
                />
              </div>

              <Button 
                type="submit" 
                size="lg" 
                disabled={loading || (!amount && !file)} 
                className="w-full h-14 text-lg rounded-xl shadow-lg shadow-indigo-200 bg-indigo-600 hover:bg-indigo-700"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin ml-2" /> : <Upload className="w-5 h-5 ml-2" />}
                שלח קבלה
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}