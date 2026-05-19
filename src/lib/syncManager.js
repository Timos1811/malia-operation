import { supabase } from '@/api/base44Client';
import {
  getQueuedScans,
  clearQueuedScans,
  cacheWristbandsForEvent,
  cacheNewSaleData,
  getQueuedSales,
  updateQueuedSale,
  removeQueuedSale,
} from './offlineStore';

let syncingScans = false;
let syncingSales = false;

// ========================================================================
// EventScanner sync
// ========================================================================

export async function syncEventData(eventName) {
  const { data, error } = await supabase.rpc('sync_wristbands_for_event', {
    p_event_name: eventName,
  });
  if (error) throw error;
  await cacheWristbandsForEvent(eventName, data);
  return data;
}

export async function flushScanQueue() {
  if (syncingScans) return { skipped: true };
  syncingScans = true;
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
    syncingScans = false;
  }
}

// ========================================================================
// NewSale data sync (cache for offline use)
// ========================================================================

export async function syncNewSaleData() {
  const { data, error } = await supabase.rpc('cache_data_for_new_sale');
  if (error) throw error;
  await cacheNewSaleData(data);
  return data;
}

// ========================================================================
// Sales queue sync (flush offline-created sales to server)
// ========================================================================

export async function flushSalesQueue() {
  if (syncingSales) return { skipped: true };
  syncingSales = true;
  const result = { created: 0, conflicts: 0, errors: 0 };

  try {
    const queued = await getQueuedSales();
    if (queued.length === 0) return result;

    for (const sale of queued) {
      if (sale.status === 'synced') {
        // Should have been removed already but clean up just in case
        await removeQueuedSale(sale.local_id);
        continue;
      }

      try {
        await updateQueuedSale(sale.local_id, { status: 'syncing' });

        const payload = {
          order_number: sale.order_number,
          departure_date: sale.departure_date,
          customer: sale.customer,
          nights: sale.nights,
          gender: sale.gender,
          hotel: sale.hotel,
          company: sale.company,
          requested_amount: sale.requested_amount,
          sales_rep: sale.sales_rep,
          is_combo: sale.is_combo,
          wristbands: sale.wristbands || [],
        };

        const { data, error } = await supabase.rpc('create_sale_atomic', { p_sale: payload });
        if (error) throw error;

        if (data?.status === 'created') {
          await removeQueuedSale(sale.local_id);
          result.created++;
        } else if (data?.status?.startsWith('conflict')) {
          await updateQueuedSale(sale.local_id, {
            status: 'conflict',
            conflict: data,
            conflict_at: Date.now(),
          });
          result.conflicts++;
        } else {
          await updateQueuedSale(sale.local_id, {
            status: 'queued',
            last_error: data?.message || 'Unknown server response',
          });
          result.errors++;
        }
      } catch (err) {
        await updateQueuedSale(sale.local_id, {
          status: 'queued',
          last_error: err.message || String(err),
        });
        result.errors++;
      }
    }

    return result;
  } finally {
    syncingSales = false;
  }
}
