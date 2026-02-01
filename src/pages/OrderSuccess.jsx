import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { CheckCircle2, PartyPopper, Plus } from 'lucide-react';
import { Button } from "@/components/ui/button";

export default function OrderSuccess() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4" dir="rtl">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 max-w-md w-full text-center space-y-6">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-10 h-10 text-green-600" />
        </div>
        
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-slate-900">ההזמנה נוספה!</h1>
          <p className="text-slate-500">הפרטים נשמרו והצמידים שוייכו בהצלחה.</p>
        </div>

        <div className="pt-4 space-y-3">
          <Link to={createPageUrl('NewSale')}>
            <Button className="w-full bg-slate-900 hover:bg-slate-800 h-12 text-lg">
              <Plus className="w-5 h-5 ml-2" />
              מכירה חדשה
            </Button>
          </Link>
          
          <Link to={createPageUrl('SavedData')}>
            <Button variant="outline" className="w-full h-12">
              מעבר לטבלת הנתונים
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}