import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import SalesRepSummary from '@/components/sales/SalesRepSummary';
import SalesRepGroupsTable from '@/components/groups/SalesRepGroupsTable';
import { Button } from '@/components/ui/button';

export default function SalesRepDashboard() {
  const [searchParams] = useSearchParams();
  const salesRepName = searchParams.get('salesRep');

  if (!salesRepName) {
    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50" dir="rtl">
            <div className="text-center space-y-4">
                <p className="text-slate-500">שם נציג המכירות לא צוין.</p>
                <Button onClick={() => window.history.back()}>
                    <ArrowRight className="w-4 h-4 ml-2" />
                    חזור
                </Button>
            </div>
        </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-12" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex items-center gap-4 mb-4">
          <Button onClick={() => window.history.back()} variant="ghost" size="icon" className="hover:bg-slate-200">
            <ArrowRight className="w-5 h-5 text-slate-600" />
          </Button>
          <h1 className="text-3xl font-bold text-slate-900">דשבורד עבור {salesRepName}</h1>
        </div>
        
        <SalesRepSummary salesRepName={salesRepName} />
        
        <SalesRepGroupsTable salesRepName={salesRepName} />
      </div>
    </div>
  );
}