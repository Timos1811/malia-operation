import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

const DISMISSED_KEY = 'pwa_install_dismissed_at';
const DISMISS_DAYS = 7;

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const dismissedAt = Number(localStorage.getItem(DISMISSED_KEY) || 0);
    const dismissedRecently =
      dismissedAt && Date.now() - dismissedAt < DISMISS_DAYS * 24 * 60 * 60 * 1000;

    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      if (!dismissedRecently) setShow(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const install = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShow(false);
      setDeferredPrompt(null);
    }
  };

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, Date.now().toString());
    setShow(false);
  };

  if (!show) return null;

  return (
    <div
      dir="rtl"
      className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 z-[200] bg-white shadow-2xl rounded-2xl border border-blue-100 p-4 animate-in slide-in-from-bottom"
    >
      <button
        onClick={dismiss}
        aria-label="סגור"
        className="absolute top-2 left-2 text-slate-400 hover:text-slate-600 p-1"
      >
        <X className="w-4 h-4" />
      </button>
      <div className="flex items-start gap-3 mt-1">
        <div className="bg-blue-100 rounded-xl p-2">
          <Download className="w-5 h-5 text-blue-600" />
        </div>
        <div className="flex-1">
          <h3 className="font-bold text-slate-900">התקן את האפליקציה</h3>
          <p className="text-sm text-slate-600 mt-1">
            גישה מהירה מהמסך הבית, עבודה גם ללא רשת.
          </p>
          <Button onClick={install} className="mt-3 w-full bg-blue-600 hover:bg-blue-700">
            התקן עכשיו
          </Button>
        </div>
      </div>
    </div>
  );
}
