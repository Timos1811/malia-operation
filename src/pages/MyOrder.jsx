import React, { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { PartyPopper, Search, Loader2, Calendar, Users, ShieldAlert, CheckCircle2, Hash, Tag, ScanLine } from 'lucide-react';
import { toast } from 'sonner';

export default function MyOrder() {
  const [searchInput, setSearchInput] = useState('');
  const [searchMode, setSearchMode] = useState('order'); // 'order' | 'wristband'
  const [activeSearch, setActiveSearch] = useState(null); // { mode, value }
  const [scanning, setScanning] = useState(false);
  const scanLockRef = useRef(false);

  const handleNFCScan = async () => {
    if (!('NDEFReader' in window)) {
      toast.error("דפדפן זה לא תומך ב-NFC");
      return;
    }
    setScanning(true);
    try {
      const ndef = new window.NDEFReader();
      await ndef.scan();
      toast.info("קרב את הצמיד למכשיר...");
      ndef.onreading = (event) => {
        if (scanLockRef.current) return;
        scanLockRef.current = true;
        const nfcId = event.serialNumber.replace(/:/g, "").toLowerCase();
        setSearchInput(nfcId);
        setActiveSearch({ mode: 'wristband', value: nfcId });
        setScanning(false);
        setTimeout(() => { scanLockRef.current = false; }, 1000);
      };
    } catch (error) {
      console.error(error);
      toast.error("שגיאה בהפעלת NFC");
      setScanning(false);
    }
  };

  // Fetch wristbands related to the search
  const { data: wristbands, isLoading } = useQuery({
    queryKey: ['my-order', activeSearch?.mode, activeSearch?.value],
    queryFn: async () => {
      if (!activeSearch) return [];
      if (activeSearch.mode === 'order') {
        return base44.entities.Wristband.filter({ order_number: activeSearch.value });
      } else {
        const lower = activeSearch.value.toLowerCase();
        const upper = activeSearch.value.toUpperCase();
        const lowerResults = await base44.entities.Wristband.filter({ nfc_id: lower });
        const upperResults = lower !== upper ? await base44.entities.Wristband.filter({ nfc_id: upper }) : [];
        const all = [...lowerResults, ...upperResults];
        return Array.from(new Map(all.map(wb => [wb.id, wb])).values());
      }
    },
    enabled: !!activeSearch,
    retry: false
  });

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchInput.trim()) {
      setActiveSearch({ mode: searchMode, value: searchInput.trim() });
    }
  };

  const displayOrderNumber = wristbands && wristbands.length > 0 ? wristbands[0].order_number : null;
  const hasValidWristband = wristbands && wristbands.some(wb => wb.status === 'active');

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center p-4 md:p-8" dir="rtl">
      <div className="w-full max-w-md space-y-6">
        
        {/* Header */}
        <div className="text-center space-y-2 mt-8 mb-8">
          <div className="bg-indigo-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <PartyPopper className="w-8 h-8 text-indigo-600" />
          </div>
          <h1 className="text-3xl font-black text-slate-800">ההזמנה שלי</h1>
          <p className="text-slate-500">חפש לפי מספר הזמנה או לפי מזהה צמיד</p>
        </div>

        {/* Search Form */}
        <Card className="border-none shadow-md overflow-hidden rounded-2xl">
          <CardContent className="p-6 space-y-4">
            {/* Mode Toggle */}
            <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => { setSearchMode('order'); setSearchInput(''); }}
                className={`py-2 px-3 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                  searchMode === 'order' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'
                }`}
              >
                <Hash className="w-4 h-4" />
                מספר הזמנה
              </button>
              <button
                type="button"
                onClick={() => { setSearchMode('wristband'); setSearchInput(''); }}
                className={`py-2 px-3 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                  searchMode === 'wristband' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'
                }`}
              >
                <Tag className="w-4 h-4" />
                מזהה צמיד
              </button>
            </div>

            <form onSubmit={handleSearch} className="flex gap-2">
              <Input
                type={searchMode === 'order' ? 'number' : 'text'}
                placeholder={searchMode === 'order' ? 'הקלד מספר הזמנה...' : 'הקלד מזהה צמיד (אותיות ומספרים)...'}
                value={searchInput}
                onChange={(e) => setSearchInput(searchMode === 'wristband' ? e.target.value.toLowerCase() : e.target.value)}
                className="text-lg h-12 bg-slate-50 border-slate-200"
              />
              <Button type="submit" className="h-12 px-6 bg-indigo-600 hover:bg-indigo-700" disabled={isLoading}>
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
              </Button>
            </form>

            {searchMode === 'wristband' && (
              <Button
                type="button"
                onClick={handleNFCScan}
                disabled={scanning}
                className={`w-full h-14 text-base font-bold rounded-xl ${
                  scanning 
                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' 
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
                }`}
              >
                {scanning ? (
                  <><Loader2 className="w-5 h-5 animate-spin ml-2" /> ממתין לסריקה...</>
                ) : (
                  <><ScanLine className="w-5 h-5 ml-2" /> סרוק צמיד (NFC)</>
                )}
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Results Area */}
        {isLoading && (
          <div className="flex justify-center p-8">
            <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
          </div>
        )}

        {activeSearch && !isLoading && (!wristbands || wristbands.length === 0) && (
          <div className="bg-white rounded-2xl p-8 text-center shadow-sm border border-slate-100">
            <ShieldAlert className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-slate-700 mb-1">
              {activeSearch.mode === 'order' ? 'הזמנה לא נמצאה' : 'צמיד לא נמצא'}
            </h3>
            <p className="text-slate-500 text-sm">
              {activeSearch.mode === 'order' 
                ? 'לא מצאנו צמידים שמשויכים למספר ההזמנה הזה. אנא ודא שהקשת את המספר הנכון.'
                : 'לא מצאנו צמיד עם המזהה הזה. אנא ודא שהקשת את המזהה הנכון.'}
            </p>
          </div>
        )}

        {activeSearch && !isLoading && wristbands && wristbands.length > 0 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            
            <Card className="border-none shadow-md rounded-2xl bg-gradient-to-br from-indigo-600 to-blue-700 text-white overflow-hidden relative">
              <div className="absolute top-0 right-0 opacity-10 transform translate-x-4 -translate-y-4">
                <PartyPopper className="w-32 h-32" />
              </div>
              <CardContent className="p-6 relative z-10">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <p className="text-indigo-100 text-sm font-medium mb-1">
                      {activeSearch.mode === 'order' ? 'הזמנה מספר' : 'הזמנה משויכת'}
                    </p>
                    <h2 className="text-3xl font-black">{displayOrderNumber}</h2>
                  </div>
                  <div className="bg-white/20 px-3 py-1 rounded-full text-sm font-bold backdrop-blur-sm flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    {wristbands.length} {wristbands.length === 1 ? 'צמיד' : 'צמידים'}
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

            <h3 className="font-bold text-slate-700 px-2 pt-2">
              {activeSearch.mode === 'wristband' ? 'פרטי הצמיד:' : 'הצמידים והאירועים שלך:'}
            </h3>
            
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
                 שימו לב: נראה שהצמידים אינם פעילים כרגע. אנא פנו לנציג שלכם.
               </div>
            )}

          </div>
        )}

      </div>
    </div>
  );
}