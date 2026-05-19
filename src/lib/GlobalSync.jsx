import { useEffect } from 'react';
import { useOnlineStatus } from './useOnlineStatus';
import { flushScanQueue, flushSalesQueue } from './syncManager';
import { useAuth } from './AuthContext';
import { toast } from 'sonner';
import { getQueueCount, getSalesQueueCount } from './offlineStore';

/**
 * Mounts once at the app root. Whenever connectivity comes back, flushes:
 *   - scan queue (offline EventScanner logs)
 *   - sales queue (offline NewSale entries)
 * Also runs once on initial mount if any queue items already exist.
 */
export default function GlobalSync() {
  const online = useOnlineStatus();
  const { user, isAuthenticated } = useAuth();

  useEffect(() => {
    if (!online || !isAuthenticated || !user) return;

    let cancelled = false;

    (async () => {
      try {
        const [scanCount, salesCount] = await Promise.all([
          getQueueCount(),
          getSalesQueueCount(),
        ]);
        if (cancelled) return;
        if (scanCount === 0 && salesCount === 0) return;

        if (scanCount > 0) {
          const r = await flushScanQueue();
          if (!cancelled && r?.flushed) {
            toast.success(`סונכרנו ${r.flushed} סריקות שהמתינו`);
          }
        }

        if (salesCount > 0) {
          const r = await flushSalesQueue();
          if (cancelled) return;
          if (r?.created) toast.success(`סונכרנו ${r.created} מכירות שהמתינו`);
          if (r?.conflicts) toast.warning(`${r.conflicts} מכירות בקונפליקט — דרושה התערבות`);
          if (r?.errors) toast.error(`${r.errors} מכירות נכשלו בסנכרון`);
        }
      } catch (e) {
        console.error('GlobalSync error', e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [online, isAuthenticated, user?.id]);

  // Expose manual trigger for debugging from DevTools
  useEffect(() => {
    window.__maliaSync = async () => {
      const scan = await flushScanQueue();
      const sale = await flushSalesQueue();
      console.log('[Malia sync]', { scan, sale });
      return { scan, sale };
    };
    return () => {
      delete window.__maliaSync;
    };
  }, []);

  return null;
}
