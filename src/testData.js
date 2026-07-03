// 10 vollständige Testzyklen zum manuellen Ausprobieren und als Fixture für
// die Unit-Tests (src/__tests__). Jeder Zyklus deckt ein anderes Szenario ab.
//
// Nutzung im Browser (Dev-Konsole / preview_eval):
//   import('/src/testData.js').then(m => m.seedTestData())

let _uid = 0;

function addISO(s, n) {
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(y, m - 1, d + n);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function mkEntry(date, patch) {
  return {
    id: `test-${date}-${_uid++}`,
    date,
    temperature: null,
    tempSite: null,
    tempExcluded: false,
    cervicalMucus: null,
    mucusExcluded: false,
    cervixState: null,
    cervixExcluded: false,
    ferning: null,
    notes: '',
    isPeriodStart: false,
    trackTemp: true,
    trackMucus: true,
    trackCervix: false,
    ...patch,
  };
}

const LOWS = [50, 45, 55, 50, 48, 52, 54, 49, 51, 47, 53, 50, 52, 50, 48, 51, 49, 53, 50, 52];
const c = (cents) => Math.round((36 + cents / 100) * 100) / 100;

// Temperaturkurve: tiefe Werte bis ovDay, danach Anstieg je nach Typ.
function tempSeq(length, ovDay, rise, anov) {
  const arr = [];
  for (let i = 1; i <= length; i++) {
    if (anov || i < ovDay) {
      arr.push(c(LOWS[(i - 1) % LOWS.length]));
      continue;
    }
    const k = i - ovDay; // 0-basierter Index der Hochlage
    let highs;
    if (rise === 'slow') highs = [65, 68, 68, 72, 74, 72, 76, 74, 75];
    else if (rise === 'outlier') highs = [70, 52, 80, 86, 84, 86, 83, 85, 82];
    else highs = [70, 80, 85, 82, 84, 80, 86, 83, 85, 82];
    arr.push(c(highs[k] ?? highs[highs.length - 1]));
  }
  return arr;
}

// Schleim: Aufbau bis S+ (Höhepunkt an ovDay), danach abfallend.
function mucusSeq(length, ovDay) {
  const arr = [];
  for (let i = 1; i <= length; i++) {
    let code;
    if (i <= 4) code = 'none';
    else if (i <= ovDay - 5) code = 't';
    else if (i <= ovDay - 3) code = 'f';
    else if (i <= ovDay - 1) code = 'S';
    else if (i === ovDay) code = 'S+';
    else if (i === ovDay + 1) code = 'S';
    else if (i === ovDay + 2) code = 'f';
    else if (i === ovDay + 3) code = 'none';
    else code = 't';
    arr.push(code);
  }
  return arr;
}

// Muttermund: weich am Höhepunkt (ovDay), sonst fest, davor Übergang.
function cervixSeq(length, ovDay) {
  const arr = [];
  for (let i = 1; i <= length; i++) {
    let state;
    if (i <= 4) state = null; // Blutung: nicht tasten
    else if (i === ovDay || i === ovDay - 1) state = 'weich';
    else if (i === ovDay - 2) state = 'uebergang';
    else state = 'fest';
    arr.push(state);
  }
  return arr;
}

function buildCycle(startISO, cfg) {
  const {
    length,
    ovDay,
    rise = 'normal',
    anov = false,
    tracks = { temp: true, mucus: true, cervix: false },
    site = 'rektal',
    excludedTempDays = [],
    excludedMucusDays = [],
    note = '',
  } = cfg;

  const temps = tempSeq(length, ovDay, rise, anov);
  const muc = mucusSeq(length, ovDay);
  const cerv = cervixSeq(length, ovDay);
  const entries = [];

  for (let i = 1; i <= length; i++) {
    const date = addISO(startISO, i - 1);
    const patch = {
      temperature: temps[i - 1],
      tempSite: site,
      cervicalMucus: muc[i - 1],
      cervixState: cerv[i - 1],
      trackTemp: tracks.temp,
      trackMucus: tracks.mucus,
      trackCervix: tracks.cervix,
    };
    if (i === 1) {
      patch.isPeriodStart = true;
      if (note) patch.notes = note;
    }
    if (i <= 4) patch.cervixExcluded = true; // Blutung: Muttermund nicht tasten
    if (excludedTempDays.includes(i)) {
      patch.tempExcluded = true;
      patch.notes = 'Störung: Fieber';
    }
    if (excludedMucusDays.includes(i)) {
      patch.mucusExcluded = true;
    }
    entries.push(mkEntry(date, patch));
  }
  return entries;
}

// Reihenfolge & Szenarien der 10 Zyklen.
export const CYCLE_CONFIGS = [
  { length: 28, ovDay: 14, rise: 'normal', tracks: { temp: true, mucus: true, cervix: false }, note: 'Zyklus 1: Standard (Temperatur + Schleim)' },
  { length: 29, ovDay: 15, rise: 'normal', tracks: { temp: true, mucus: true, cervix: true }, note: 'Zyklus 2: alle drei Zeichen – Muttermund noch Lernphase' },
  { length: 28, ovDay: 13, rise: 'normal', tracks: { temp: true, mucus: true, cervix: true }, note: 'Zyklus 3: alle drei Zeichen, Muttermund jetzt auswertbar' },
  { length: 30, ovDay: 16, rise: 'slow', tracks: { temp: true, mucus: true, cervix: false }, note: 'Zyklus 4: Ausnahmeregel 1 (langsamer Anstieg)' },
  { length: 28, ovDay: 14, rise: 'outlier', tracks: { temp: true, mucus: true, cervix: false }, note: 'Zyklus 5: Ausnahmeregel 2 (Ausreißer nach unten)' },
  { length: 33, ovDay: 99, anov: true, tracks: { temp: true, mucus: true, cervix: false }, note: 'Zyklus 6: kein Eisprung (kein Temperaturanstieg)' },
  { length: 28, ovDay: 14, rise: 'normal', tracks: { temp: true, mucus: false, cervix: true }, note: 'Zyklus 7: Temperatur + Muttermund (Schleim gestört/aus)' },
  { length: 29, ovDay: 15, rise: 'normal', tracks: { temp: true, mucus: true, cervix: true }, excludedTempDays: [9], excludedMucusDays: [10], note: 'Zyklus 8: mit ausgeklammerten Störtagen' },
  { length: 24, ovDay: 12, rise: 'normal', tracks: { temp: true, mucus: true, cervix: false }, note: 'Zyklus 9: kurzer Zyklus' },
  { length: 28, ovDay: 14, rise: 'normal', tracks: { temp: true, mucus: true, cervix: true }, note: 'Zyklus 10: aktueller Zyklus – Eisprung erkannt (Popup)' },
];

// Erzeugt alle Einträge; cycle10 endet so, dass es der aktuelle Zyklus ist.
export function generateTestEntries(firstStart = '2025-09-20') {
  let start = firstStart;
  const all = [];
  for (const cfg of CYCLE_CONFIGS) {
    const entries = buildCycle(start, cfg);
    all.push(...entries);
    start = addISO(start, cfg.length);
  }
  return all;
}

// Schreibt die Testdaten direkt in IndexedDB (ohne bestehende zu behalten).
export async function seedTestData() {
  const entries = generateTestEntries();
  const db = await new Promise((res, rej) => {
    const r = indexedDB.open('nfp-tracker', 1);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  await new Promise((res, rej) => {
    const tx = db.transaction('entries', 'readwrite');
    const store = tx.objectStore('entries');
    store.clear();
    entries.forEach((e) => store.put(e));
    tx.oncomplete = res;
    tx.onerror = () => rej(tx.error);
  });
  db.close();
  return entries.length;
}
