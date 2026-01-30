import React, { useState } from 'react';
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from './utils';

export default function AddTask() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    due_date: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title) {
      toast.error('נא להזין כותרת למשימה');
      return;
    }

    setLoading(true);
    try {
      await base44.entities.Task.create({
        ...formData,
        status: 'todo'
      });
      toast.success('המשימה נוצרה בהצלחה');
      navigate(createPageUrl('Tasks'));
    } catch (error) {
      console.error(error);
      toast.error('שגיאה ביצירת המשימה');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-8 flex items-center justify-center" dir="rtl">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">הוספת משימה חדשה</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">כותרת</label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({...formData, title: e.target.value})}
                placeholder="מה צריך לעשות?"
                className="text-right"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">תיאור</label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                placeholder="פרטים נוספים..."
                className="text-right min-h-[100px]"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">תאריך יעד</label>
              <Input
                type="date"
                value={formData.due_date}
                onChange={(e) => setFormData({...formData, due_date: e.target.value})}
                className="text-right"
              />
            </div>

            <div className="pt-4 flex gap-3">
              <Button 
                type="button" 
                variant="outline" 
                className="flex-1"
                onClick={() => navigate(createPageUrl('Tasks'))}
              >
                ביטול
              </Button>
              <Button 
                type="submit" 
                className="flex-1 bg-slate-900 text-white hover:bg-slate-800"
                disabled={loading}
              >
                {loading ? 'שומר...' : 'הוסף משימה'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}