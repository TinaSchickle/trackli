import { migrateEntry } from './utils/nfp.js';
import { supabase, isCloudConfigured } from './cloud/supabase.js';
import { getUser } from './cloud/auth.js';

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

// ── Lokale IndexedDB-Grundoperationen ──────────────────────────────────────

async function localGetAll(storeName) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = tx(db, storeName, 'readonly').getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function localPut(storeName, obj) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = tx(db, storeName, 'readwrite').put(obj);
    req.onsuccess = () => resolve(obj);
    req.onerror = () => reject(req.error);
  });
}

async function localDelete(storeName, id) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = tx(db, storeName, 'readwrite').delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function localClear(storeName) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = tx(db, storeName, 'readwrite').clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ── Lokale Datentrennung zwischen Konten ─────────────────────────────────────
// Die lokale IndexedDB liegt pro Browser vor und gehört immer genau einem
// angemeldeten Konto. Diese Marke merkt sich, wem die aktuellen lokalen Daten
// gehören, damit beim Wechsel des Kontos keine fremden Einträge sichtbar werden
// oder versehentlich in ein anderes Konto hochgeladen werden.
const LOCAL_OWNER_KEY = 'trackli:localDataOwner';

// Alle lokalen Daten löschen (Einträge + Charts). Die Cloud bleibt unberührt.
export async function clearLocalData() {
  await Promise.all([localClear(STORE_ENTRIES), localClear(STORE_ARCHIVED_CHARTS)]);
}

// Vor dem Sync aufrufen: Gehören die lokalen Daten einem *anderen* Konto,
// werden sie verworfen, bevor die Daten des jetzt angemeldeten Kontos aus der
// Cloud geladen werden. Sind die lokalen Daten „herrenlos" (Alt-/Offline-Daten
// von vor der Anmeldung), werden sie dem jetzigen Konto zugeordnet und beim Sync
// übernommen.
export async function prepareLocalDataForUser(userId) {
  try {
    const owner = localStorage.getItem(LOCAL_OWNER_KEY);
    if (owner && owner !== userId) {
      await clearLocalData();
    }
    localStorage.setItem(LOCAL_OWNER_KEY, userId);
  } catch {
    /* localStorage nicht verfügbar – ohne Trennung best effort weiter */
  }
}

// Beim Abmelden aufrufen: lokale Daten entfernen. Die Besitzer-Marke bleibt
// bewusst stehen: Meldet sich danach ein *anderes* Konto an, greift so weiterhin
// die Mismatch-Prüfung in prepareLocalDataForUser (löschen), statt die Daten
// fälschlich als „herrenlos" zu übernehmen. Würden wir die Marke hier löschen,
// könnte ein schnelles Abmelden+Anmelden dazu führen, dass das neue Konto noch
// nicht fertig gelöschte Daten des vorherigen Kontos übernimmt.
export async function releaseLocalData() {
  await clearLocalData();
}

// ── Cloud-Hilfen ───────────────────────────────────────────────────────────

// Liefert die user_id, wenn Cloud eingerichtet, online und angemeldet – sonst
// null. Alle Cloud-Schreibvorgänge sind „best effort": schlägt etwas fehl,
// bleibt die Änderung lokal und syncNow() holt sie beim nächsten Lauf nach.
async function cloudUserId() {
  if (!isCloudConfigured) return null;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return null;
  try {
    const user = await getUser();
    return user ? user.id : null;
  } catch {
    return null;
  }
}

// ── Einträge ────────────────────────────────────────────────────────────────

export async function getAllEntries() {
  const raw = await localGetAll(STORE_ENTRIES);

  // Altdaten (alte Schleim-Skala, Muttermund als Einzelwert, excluded-Flag)
  // beim Laden einmalig auf das neue Datenmodell heben und zurückschreiben.
  const migrated = raw.map((e) => migrateEntry(e));
  const changed = migrated.filter((m) => m.changed).map((m) => m.entry);
  if (changed.length > 0) {
    await Promise.all(
      changed.map((entry) =>
        localPut(STORE_ENTRIES, { ...entry, updatedAt: entry.updatedAt ?? Date.now() })
      )
    );
  }
  return migrated.map((m) => m.entry);
}

export async function putEntry(entry) {
  const stamped = { ...entry, updatedAt: Date.now() };
  await localPut(STORE_ENTRIES, stamped);
  try {
    const uid = await cloudUserId();
    if (uid) {
      await supabase.from('entries').upsert(
        {
          user_id: uid,
          date: stamped.date,
          data: stamped,
          updated_at: stamped.updatedAt,
          deleted: false,
        },
        { onConflict: 'user_id,date' }
      );
    }
  } catch {
    /* lokal gespeichert – syncNow() gleicht später ab */
  }
  return stamped;
}

export async function deleteEntry(id) {
  const all = await localGetAll(STORE_ENTRIES);
  const target = all.find((e) => e.id === id);
  await localDelete(STORE_ENTRIES, id);
  try {
    const uid = await cloudUserId();
    if (uid && target) {
      // Tombstone: als gelöscht markieren, damit andere Geräte das mitbekommen.
      await supabase.from('entries').upsert(
        {
          user_id: uid,
          date: target.date,
          data: target,
          updated_at: Date.now(),
          deleted: true,
        },
        { onConflict: 'user_id,date' }
      );
    }
  } catch {
    /* lokal gelöscht – syncNow() gleicht später ab */
  }
}

// ── Archivierte Zyklus-Charts ────────────────────────────────────────────────

export async function getAllArchivedCharts() {
  return localGetAll(STORE_ARCHIVED_CHARTS);
}

export async function addArchivedChart(chart) {
  const stamped = { ...chart, updatedAt: Date.now() };
  await localPut(STORE_ARCHIVED_CHARTS, stamped);
  try {
    const uid = await cloudUserId();
    if (uid) {
      await supabase.from('archived_charts').upsert(
        {
          user_id: uid,
          id: String(stamped.id),
          data: stamped,
          updated_at: stamped.updatedAt,
          deleted: false,
        },
        { onConflict: 'user_id,id' }
      );
    }
  } catch {
    /* lokal gespeichert – syncNow() gleicht später ab */
  }
  return stamped;
}

export async function hasArchivedChartForCycle(cycleStartDate) {
  const all = await getAllArchivedCharts();
  return all.some((c) => c.cycleStartDate === cycleStartDate);
}

// ── Zwei-Wege-Abgleich lokal ⇄ Cloud ─────────────────────────────────────────

// Gleicht lokale IndexedDB und Cloud vollständig ab. Regel: pro Datensatz
// gewinnt der jüngere Zeitstempel (updated_at). Einträge werden über das Datum
// identifiziert (natürlicher Schlüssel), Charts über die id.
// Rückgabe: { ok, changedLocal } – changedLocal signalisiert der App, dass sie
// die Einträge neu laden sollte.
export async function syncNow() {
  const uid = await cloudUserId();
  if (!uid) return { ok: false, reason: 'offline-or-logged-out', changedLocal: false };

  let changedLocal = false;

  // — Einträge (Schlüssel: Datum) —
  const [localEntries, remoteRes] = await Promise.all([
    getAllEntries(),
    // Explizit auf das eigene Konto filtern. Die RLS-Policy in Supabase macht
    // dasselbe serverseitig – aber wir verlassen uns bewusst NICHT allein
    // darauf: Ist die RLS auf dem Projekt (versehentlich) nicht aktiv, würde
    // ein ungefiltertes select fremde Zeilen liefern. Dieser Filter garantiert
    // die Konto-Trennung auch dann. Kein Leaking.
    supabase.from('entries').select('date, data, updated_at, deleted').eq('user_id', uid),
  ]);
  if (remoteRes.error) throw remoteRes.error;

  const localByDate = new Map(localEntries.map((e) => [e.date, e]));
  const remoteByDate = new Map((remoteRes.data ?? []).map((r) => [r.date, r]));
  const dates = new Set([...localByDate.keys(), ...remoteByDate.keys()]);

  const toPush = [];
  for (const date of dates) {
    const local = localByDate.get(date);
    const remote = remoteByDate.get(date);
    const localTs = local ? local.updatedAt ?? 0 : -1;
    const remoteTs = remote ? Number(remote.updated_at) : -1;

    if (remote && remoteTs >= localTs) {
      // Cloud gewinnt.
      if (remote.deleted) {
        if (local) {
          await localDelete(STORE_ENTRIES, local.id);
          changedLocal = true;
        }
      } else {
        // Falls lokal ein Eintrag mit anderer id für dasselbe Datum liegt
        // (z.B. beide Geräte offline am selben Tag angelegt), diesen entfernen,
        // damit der by_date-Unique-Index nicht bricht.
        if (local && local.id !== remote.data.id) {
          await localDelete(STORE_ENTRIES, local.id);
        }
        await localPut(STORE_ENTRIES, remote.data);
        changedLocal = true;
      }
    } else if (local) {
      // Lokal gewinnt (oder nur lokal vorhanden) → hochladen.
      const ts = local.updatedAt ?? Date.now();
      if (local.updatedAt == null) {
        await localPut(STORE_ENTRIES, { ...local, updatedAt: ts });
      }
      toPush.push({
        user_id: uid,
        date,
        data: { ...local, updatedAt: ts },
        updated_at: ts,
        deleted: false,
      });
    }
  }
  if (toPush.length) {
    const { error } = await supabase
      .from('entries')
      .upsert(toPush, { onConflict: 'user_id,date' });
    if (error) throw error;
  }

  // — Archivierte Charts (Schlüssel: id) —
  const [localCharts, remoteChartsRes] = await Promise.all([
    getAllArchivedCharts(),
    // Wie bei den Einträgen: explizit auf das eigene Konto filtern, damit die
    // Trennung nicht allein von der serverseitigen RLS abhängt. Kein Leaking.
    supabase.from('archived_charts').select('id, data, updated_at, deleted').eq('user_id', uid),
  ]);
  if (remoteChartsRes.error) throw remoteChartsRes.error;

  const localChartsById = new Map(localCharts.map((c) => [String(c.id), c]));
  const remoteChartsById = new Map((remoteChartsRes.data ?? []).map((r) => [String(r.id), r]));
  const chartIds = new Set([...localChartsById.keys(), ...remoteChartsById.keys()]);

  const chartsToPush = [];
  for (const id of chartIds) {
    const local = localChartsById.get(id);
    const remote = remoteChartsById.get(id);
    const localTs = local ? local.updatedAt ?? 0 : -1;
    const remoteTs = remote ? Number(remote.updated_at) : -1;

    if (remote && remoteTs >= localTs) {
      if (remote.deleted) {
        if (local) {
          await localDelete(STORE_ARCHIVED_CHARTS, local.id);
          changedLocal = true;
        }
      } else {
        await localPut(STORE_ARCHIVED_CHARTS, remote.data);
        changedLocal = true;
      }
    } else if (local) {
      const ts = local.updatedAt ?? Date.now();
      chartsToPush.push({
        user_id: uid,
        id: String(local.id),
        data: { ...local, updatedAt: ts },
        updated_at: ts,
        deleted: false,
      });
    }
  }
  if (chartsToPush.length) {
    const { error } = await supabase
      .from('archived_charts')
      .upsert(chartsToPush, { onConflict: 'user_id,id' });
    if (error) throw error;
  }

  return { ok: true, changedLocal, at: Date.now() };
}
