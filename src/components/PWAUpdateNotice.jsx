import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from '@/components/ui/button';
import { RefreshCcw } from 'lucide-react';

export default function PWAUpdateNotice() {
  const [showReload, setShowReload] = useState(false);
  const { needRefresh, updateServiceWorker } = useRegisterSW({
    onRegisteredSW() {},
    onRegisterError() {},
  });

  useEffect(() => {
    if (needRefresh[0]) setShowReload(true);
  }, [needRefresh]);

  if (!showReload) return null;

  return (
    <div
      dir="rtl"
      className="fixed top-4 left-1/2 -translate-x-1/2 z-[200] bg-blue-600 text-white rounded-full shadow-lg px-4 py-2 flex items-center gap-3 animate-in slide-in-from-top"
    >
      <RefreshCcw className="w-4 h-4" />
      <span className="text-sm font-medium">גרסה חדשה זמינה</span>
      <Button
        size="sm"
        variant="secondary"
        onClick={() => updateServiceWorker(true)}
        className="h-7 px-3 bg-white text-blue-700 hover:bg-blue-50"
      >
        רענן
      </Button>
    </div>
  );
}
