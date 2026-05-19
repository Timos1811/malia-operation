import { supabase } from '@/api/base44Client';
import {
  getQueuedScans,
  clearQueuedScans,
  cacheWristbandsForEvent,
} from './offlineStore';

let syncing = false;

export async function syncEventData(eventName) {
  const { data, error } = await supabase.rpc('sync_wristbands_for_event', {
    p_event_name: eventName,
  });
  if (error) throw error;
  await cacheWristbandsForEvent(eventName, data);
  return data;
}

export async function flushScanQueue() {
  if (syncing) return { skipped: true };
  syncing = true;
  try {
    const queued = await getQueuedScans();
    if (queued.length === 0) return { flushed: 0 };

    const payload = queued.map((q) => ({
      nfc_id: q.nfc_id,
      event_name: q.event_name,
      scan_time: q.scan_time,
      status: q.status,
      message: q.message,
      scanned_by: q.scanned_by,
      customer_name: q.customer_name,
      order_number: q.order_number,
    }));

    const { error } = await supabase.rpc('bulk_insert_scan_logs', { p_logs: payload });
    if (error) throw error;

    await clearQueuedScans(queued.map((q) => q.id));
    return { flushed: queued.length };
  } finally {
    syncing = false;
  }
}
