import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { PartyPopper, Search, Loader2, Calendar, Users, ShieldAlert, CheckCircle2 } from 'lucide-react';

export default function MyOrder() {
  const [searchInput, setSearchInput] = useState('');
  const [orderNumber, setOrderNumber] = useState('');

  // Fetch wristbands related to the order number
  const { data: wristbands, isLoading, error } = useQuery({
    queryKey: ['my-order', orderNumber],
    queryFn: () => base44.entities.Wristband.filter({ order_number: orderNumber }),
    enabled: !!orderNumber,
    retry: false
  });

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchInput.trim()) {
      setOrderNumber(searchInput.trim());
    }
  };

  let hasValidWristband = false;

  if (wristbands && wristbands.length > 0) {
    hasValidWristband = wristbands.some(wb => wb.status === 'active');
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center p-4 md:p-8" dir="rtl">
      <div className="w-full max-w-md space-y-6">
        
        {/* Header */}
        <div className="text-center space-y-2 mt-8 mb-8">
          <div className="bg-indigo-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <PartyPopper className="w-8 h-8 text-indigo-600" />
          </div>
          <h1 className="text-3xl font-black text-slate-800">ההזמנה שלי</h1>
          <p className="text-slate-500">הזן את מספר ההזמנה שקיבלת כדי לראות את האירועים שלך</p>
        </div>

        {/* Search Form */}
        <Card className="border-none shadow-md overflow-hidden rounded-2xl">
          <CardContent className="p-6">
            <form onSubmit={handleSearch} className="flex gap-2">
              <Input
                type="number"
                placeholder="הקלד מספר הזמנה..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="text-lg h-12 bg-slate-50 border-slate-200"
              />
              <Button type="submit" className="h-12 px-6 bg-indigo-600 hover:bg-indigo-700" disabled={isLoading}>
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Results Area */}
        {isLoading && (
          <div className="flex justify-center p-8">
            <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
          </div>
        )}

        {orderNumber && !isLoading && (!wristbands || wristbands.length === 0) && (
          <div className="bg-white rounded-2xl p-8 text-center shadow-sm border border-slate-100">
            <ShieldAlert className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-slate-700 mb-1">הזמנה לא נמצאה</h3>
            <p className="text-slate-500 text-sm">לא מצאנו צמידים שמשויכים למספר ההזמנה הזה. אנא ודא שהקשת את המספר הנכון.</p>
          </div>
        )}

        {orderNumber && !isLoading && wristbands && wristbands.length > 0 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            
            <Card className="border-none shadow-md rounded-2xl bg-gradient-to-br from-indigo-600 to-blue-700 text-white overflow-hidden relative">
              <div className="absolute top-0 right-0 opacity-10 transform translate-x-4 -translate-y-4">
                <PartyPopper className="w-32 h-32" />
              </div>
              <CardContent className="p-6 relative z-10">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <p className="text-indigo-100 text-sm font-medium mb-1">הזמנה מספר</p>
                    <h2 className="text-3xl font-black">{orderNumber}</h2>
                  </div>
                  <div className="bg-white/20 px-3 py-1 rounded-full text-sm font-bold backdrop-blur-sm flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    {wristbands.length} צמידים
                  </div>
                </div>
                
                {wristbands[0].valid_until && (
                  <div className="flex items-center gap-2 text-indigo-100 text-sm mt-4 pt-4 border-t border-indigo-500/30">
                    <Calendar className="w-4 h-4" />
                    תוקף הצמידים: {wristbands[0].valid_until.split('-').reverse().join('/')}
                  </div>
                )}
              </CardContent>
            </Card>

            <h3 className="font-bold text-slate-700 px-2 pt-2">הצמידים והאירועים שלך:</h3>
            
            <div className="grid gap-4">
              {wristbands.map((wb, idx) => (
                <div key={idx} className={`bg-white rounded-xl shadow-sm border ${wb.status === 'active' ? 'border-indigo-100' : 'border-red-100 opacity-75'} overflow-hidden`}>
                  <div className={`p-4 border-b ${wb.status === 'active' ? 'bg-indigo-50/50 border-indigo-50' : 'bg-red-50/50 border-red-50'} flex justify-between items-center`}>
                    <div className="font-bold text-slate-800 text-lg flex items-center gap-2">
                      {wb.customer_name || `צמיד ${idx + 1}`}
                      {wb.nfc_id && (
                        <span className="text-xs font-normal text-slate-500 bg-white/50 px-2 py-0.5 rounded-full border border-slate-200">
                          {wb.nfc_id}
                        </span>
                      )}
                    </div>
                    <div className={`text-xs font-bold px-2 py-1 rounded-full ${wb.status === 'active' ? 'bg-indigo-100 text-indigo-700' : 'bg-red-100 text-red-700'}`}>
                      {wb.status === 'active' ? 'פעיל' : 'לא פעיל'}
                    </div>
                  </div>
                  <div className="p-4">
                    {wb.status === 'active' ? (
                      wb.allowed_events && wb.allowed_events.length > 0 ? (
                        <div className="grid gap-2">
                          {wb.allowed_events.map((event, eIdx) => (
                            <div key={eIdx} className="flex items-center gap-3">
                              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                              <span className="text-slate-700">{event}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-slate-500 text-sm">אין אירועים מוגדרים לצמיד זה.</div>
                      )
                    ) : (
                      <div className="text-red-500 text-sm">הצמיד בוטל או אינו פעיל יותר.</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            
            {!hasValidWristband && (
               <div className="bg-red-50 text-red-700 p-4 rounded-xl border border-red-200 text-sm font-medium flex items-start gap-2">
                 <ShieldAlert className="w-5 h-5 shrink-0" />
                 שימו לב: נראה שהצמידים בהזמנה זו אינם פעילים כרגע. אנא פנו לנציג שלכם.
               </div>
            )}

          </div>
        )}

      </div>
    </div>
  );
}