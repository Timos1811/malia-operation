import { openDB } from 'idb';

const DB_NAME = 'malia-offline';
const DB_VERSION = 1;

let dbPromise;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('wristbands')) {
          const store = db.createObjectStore('wristbands', { keyPath: 'nfc_id' });
          store.createIndex('event_name', 'event_name', { unique: false });
        }
        if (!db.objectStoreNames.contains('scannedSet')) {
          // event_name -> Set of nfc_ids already scanned successfully
          db.createObjectStore('scannedSet', { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains('scanQueue')) {
          // pending scan logs to upload when online
          db.createObjectStore('scanQueue', { keyPath: 'id', autoIncrement: true });
        }
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta', { keyPath: 'key' });
        }
      },
    });
  }
  return dbPromise;
}

// --- Wristbands cache ---

export async function cacheWristbandsForEvent(eventName, payload) {
  const db = await getDB();
  const tx = db.transaction(['wristbands', 'scannedSet', 'meta'], 'readwrite');

  // Remove any wristbands previously cached for this event (clean replace)
  const wbStore = tx.objectStore('wristbands');
  const allWbs = await wbStore.getAll();
  for (const wb of allWbs) {
    if (wb.event_name === eventName) {
      await wbStore.delete(wb.nfc_id);
    }
  }

  // Insert new ones
  for (const wb of payload.wristbands || []) {
    await wbStore.put({ ...wb, event_name: eventName });
  }

  // Set of already-scanned NFC IDs
  await tx.objectStore('scannedSet').put({
    key: eventName,
    ids: payload.already_scanned_ids || [],
  });

  // Sync metadata
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
  if (!entry) return false;
  return entry.ids.includes(nfcId.toLowerCase());
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
  const meta = await db.get('meta', `last_sync:${eventName}`);
  return meta || null;
}

// --- Scan queue (offline mutations) ---

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
  for (const id of ids) {
    await tx.store.delete(id);
  }
  await tx.done;
}

export async function getQueueCount() {
  const db = await getDB();
  return db.count('scanQueue');
}
