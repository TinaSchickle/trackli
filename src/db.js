import { migrateEntry } from './utils/nfp.js';

const DB_NAME = 'nfp-tracker';
const DB_VERSION = 1;
const STORE_ENTRIES = 'entries';
const STORE_ARCHIVED_CHARTS = 'archivedCharts';

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_ENTRIES)) {
        const store = db.createObjectStore(STORE_ENTRIES, { keyPath: 'id' });
        store.createIndex('by_date', 'date', { unique: true });
      }
      if (!db.objectStoreNames.contains(STORE_ARCHIVED_CHARTS)) {
        const store = db.createObjectStore(STORE_ARCHIVED_CHARTS, { keyPath: 'id' });
        store.createIndex('by_cycleStart', 'cycleStartDate', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(db, storeName, mode) {
  return db.transaction(storeName, mode).objectStore(storeName);
}

export async function getAllEntries() {
  const db = await openDb();
  const raw = await new Promise((resolve, reject) => {
    const req = tx(db, STORE_ENTRIES, 'readonly').getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  // Altdaten (alte Schleim-Skala, Muttermund als Einzelwert, excluded-Flag)
  // beim Laden einmalig auf das neue Datenmodell heben und zurückschreiben.
  const migrated = raw.map((e) => migrateEntry(e));
  const changed = migrated.filter((m) => m.changed).map((m) => m.entry);
  if (changed.length > 0) {
    await Promise.all(changed.map((entry) => putEntry(entry)));
  }
  return migrated.map((m) => m.entry);
}

export async function putEntry(entry) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = tx(db, STORE_ENTRIES, 'readwrite').put(entry);
    req.onsuccess = () => resolve(entry);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteEntry(id) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = tx(db, STORE_ENTRIES, 'readwrite').delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getAllArchivedCharts() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = tx(db, STORE_ARCHIVED_CHARTS, 'readonly').getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function addArchivedChart(chart) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = tx(db, STORE_ARCHIVED_CHARTS, 'readwrite').put(chart);
    req.onsuccess = () => resolve(chart);
    req.onerror = () => reject(req.error);
  });
}

export async function hasArchivedChartForCycle(cycleStartDate) {
  const all = await getAllArchivedCharts();
  return all.some((c) => c.cycleStartDate === cycleStartDate);
}
