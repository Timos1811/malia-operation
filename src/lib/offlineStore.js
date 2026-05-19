import { openDB } from 'idb';

const DB_NAME = 'malia-offline';
const DB_VERSION = 2;

let dbPromise;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          db.createObjectStore('wristbands', { keyPath: 'nfc_id' }).createIndex('event_name', 'event_name', { unique: false });
          db.createObjectStore('scannedSet', { keyPath: 'key' });
          db.createObjectStore('scanQueue', { keyPath: 'id', autoIncrement: true });
          db.createObjectStore('meta', { keyPath: 'key' });
        }
        if (oldVersion < 2) {
          // For NewSale offline support
          db.createObjectStore('existingNfcIds', { keyPath: 'nfc_id' });
          db.createObjectStore('existingOrderNumbers', { keyPath: 'order_number' });
          db.createObjectStore('lookupData', { keyPath: 'key' }); // attractions/hotels/combos/settings
          db.createObjectStore('salesQueue', { keyPath: 'local_id' });
        }
      },
    });
  }
  return dbPromise;
}

// ========================================================================
// Wristbands cache (used by EventScanner)
// ========================================================================

export async function cacheWristbandsForEvent(eventName, payload) {
  const db = await getDB();
  const tx = db.transaction(['wristbands', 'scannedSet', 'meta'], 'readwrite');
  const wbStore = tx.objectStore('wristbands');
  const all = await wbStore.getAll();
  for (const wb of all) {
    if (wb.event_name === eventName) await wbStore.delete(wb.nfc_id);
  }
  for (const wb of payload.wristbands || []) {
    await wbStore.put({ ...wb, event_name: eventName });
  }
  await tx.objectStore('scannedSet').put({ key: eventName, ids: payload.already_scanned_ids || [] });
  await tx.objectStore('meta').put({
    key: `last_sync:${eventName}`,
    at: Date.now(),
    count: (payload.wristbands || []).length,
  });
  await tx.done;
}

export async function lookupWristbandLocal(nfcId, eventName) {
  const db = await getDB();
  const wb = await db.get('wristbands', nfcId.toLowerCase());
  if (!wb || wb.event_name !== eventName) return null;
  return wb;
}

export async function isAlreadyScannedLocal(nfcId, eventName) {
  const db = await getDB();
  const entry = await db.get('scannedSet', eventName);
  return entry ? entry.ids.includes(nfcId.toLowerCase()) : false;
}

export async function markScannedLocal(nfcId, eventName) {
  const db = await getDB();
  const entry = (await db.get('scannedSet', eventName)) || { key: eventName, ids: [] };
  const lower = nfcId.toLowerCase();
  if (!entry.ids.includes(lower)) {
    entry.ids = [...entry.ids, lower];
    await db.put('scannedSet', entry);
  }
}

export async function getScannedCountLocal(eventName) {
  const db = await getDB();
  const entry = await db.get('scannedSet', eventName);
  return entry?.ids?.length || 0;
}

export async function getLastSync(eventName) {
  const db = await getDB();
  return (await db.get('meta', `last_sync:${eventName}`)) || null;
}

// ========================================================================
// Scan queue (offline EventScanner logs)
// ========================================================================

export async function enqueueScan(log) {
  const db = await getDB();
  await db.add('scanQueue', { ...log, queued_at: Date.now() });
}

export async function getQueuedScans() {
  const db = await getDB();
  return db.getAll('scanQueue');
}

export async function clearQueuedScans(ids) {
  const db = await getDB();
  const tx = db.transaction('scanQueue', 'readwrite');
  for (const id of ids) await tx.store.delete(id);
  await tx.done;
}

export async function getQueueCount() {
  const db = await getDB();
  return db.count('scanQueue');
}

// ========================================================================
// NewSale offline cache (existing IDs + lookups)
// ========================================================================

export async function cacheNewSaleData(payload) {
  const db = await getDB();
  const tx = db.transaction(
    ['existingNfcIds', 'existingOrderNumbers', 'lookupData', 'meta'],
    'readwrite'
  );

  // Clear and refill nfc ids
  const nfcStore = tx.objectStore('existingNfcIds');
  await nfcStore.clear();
  for (const id of payload.active_nfc_ids || []) {
    await nfcStore.put({ nfc_id: id });
  }

  // Clear and refill order numbers
  const orderStore = tx.objectStore('existingOrderNumbers');
  await orderStore.clear();
  for (const o of payload.order_numbers || []) {
    if (o) await orderStore.put({ order_number: String(o) });
  }

  // Lookup data
  const lookupStore = tx.objectStore('lookupData');
  await lookupStore.put({ key: 'attractions', data: payload.attractions || [] });
  await lookupStore.put({ key: 'hotels', data: payload.hotels || [] });
  await lookupStore.put({ key: 'combos', data: payload.combos || [] });
  await lookupStore.put({ key: 'app_settings', data: payload.app_settings || [] });
  await lookupStore.put({ key: 'unclaimed_pending_sales', data: payload.unclaimed_pending_sales || [] });

  await tx.objectStore('meta').put({
    key: 'last_sync:newsale',
    at: Date.now(),
    nfc_count: (payload.active_nfc_ids || []).length,
    order_count: (payload.order_numbers || []).length,
  });
  await tx.done;
}

export async function isNfcIdTaken(nfcId) {
  const db = await getDB();
  const exists = await db.get('existingNfcIds', nfcId.toLowerCase());
  if (exists) return true;
  // Also check pending sales queue (in case the seller already used it in another offline sale)
  const queued = await db.getAll('salesQueue');
  for (const sale of queued) {
    if ((sale.wristbands || []).some((w) => w.nfc_id?.toLowerCase() === nfcId.toLowerCase())) {
      return true;
    }
  }
  return false;
}

export async function isOrderNumberTaken(orderNumber) {
  if (!orderNumber) return false;
  const db = await getDB();
  const exists = await db.get('existingOrderNumbers', String(orderNumber));
  if (exists) return true;
  const queued = await db.getAll('salesQueue');
  return queued.some((s) => s.order_number === String(orderNumber));
}

export async function getCachedLookup(key) {
  const db = await getDB();
  const entry = await db.get('lookupData', key);
  return entry?.data || null;
}

export async function getLastNewSaleSync() {
  const db = await getDB();
  return (await db.get('meta', 'last_sync:newsale')) || null;
}

// ========================================================================
// Sales queue (offline NewSale)
// ========================================================================

export async function enqueueSale(sale) {
  const db = await getDB();
  const local_id = crypto.randomUUID();
  const entry = {
    local_id,
    ...sale,
    status: 'queued', // queued | syncing | synced | conflict
    queued_at: Date.now(),
  };
  await db.put('salesQueue', entry);
  return local_id;
}

export async function getQueuedSales() {
  const db = await getDB();
  return db.getAll('salesQueue');
}

export async function getSalesQueueCount(filterStatus) {
  const db = await getDB();
  const all = await db.getAll('salesQueue');
  if (!filterStatus) return all.length;
  return all.filter((s) => s.status === filterStatus).length;
}

export async function updateQueuedSale(local_id, patch) {
  const db = await getDB();
  const sale = await db.get('salesQueue', local_id);
  if (!sale) return;
  await db.put('salesQueue', { ...sale, ...patch });
}

export async function removeQueuedSale(local_id) {
  const db = await getDB();
  await db.delete('salesQueue', local_id);
}
