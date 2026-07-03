// Zentrale NFP-Datengrundlage & Auswertungslogik (symptothermal, Sensiplan-Basis).
// Quelle: NFP/nfp_zervixschleim.md, NFP/nfp_muttermund.md, NFP/nfp_temperatur.md
//
// ⚠️ Diese Implementierung ist nicht fachlich zertifiziert und ersetzt keine
// Sensiplan-Schulung oder ärztliche/fachliche Prüfung.

// ── Zervixschleim ────────────────────────────────────────────────────────────

export const MUCUS_CODES = ['t', 'none', 'f', 'S', 'S+'];

export const MUCUS = {
  t: {
    symbol: 't',
    agenda: 'trocken',
    description:
      'Trocken – raues, juckendes oder unangenehmes Gefühl, nichts gesehen',
    rank: 0,
  },
  none: {
    symbol: 'Ø',
    agenda: 'nichts',
    description: 'Nichts gefühlt und nichts gesehen',
    rank: 1,
  },
  f: {
    symbol: 'f',
    agenda: 'feucht',
    description: 'Feucht gefühlt, aber nichts gesehen',
    rank: 2,
  },
  S: {
    symbol: 'S',
    agenda: 'feucht & cremig',
    description:
      'Feucht/nass gefühlt und Schleim sichtbar – cremig, weißlich, klumpig, zäh oder gelblich',
    rank: 3,
  },
  'S+': {
    symbol: 'S+',
    agenda: 'spinnbar / glasig',
    description:
      'Nass, glitschig gefühlt und Schleim sichtbar – glasklar, spinnbar, dehnbar wie rohes Eiweiß',
    rank: 4,
  },
};

// ── Muttermund ───────────────────────────────────────────────────────────────

export const CERVIX_FIRMNESS = {
  hart: { label: 'hart', kuerzel: 'h', score: 0 },
  mittel: { label: 'mittel', kuerzel: 'm', score: 1 },
  weich: { label: 'weich', kuerzel: 'w', score: 2 },
};

export const CERVIX_OPENING = {
  geschlossen: { label: 'geschlossen', kuerzel: '·', score: 0 },
  leicht: { label: 'leicht offen', kuerzel: 'o', score: 1 },
  offen: { label: 'offen', kuerzel: 'O', score: 2 },
};

export const CERVIX_POSITION = {
  tief: { label: 'tief', kuerzel: '↓', score: 0 },
  mittel: { label: 'mittel', kuerzel: '→', score: 1 },
  hoch: { label: 'hoch', kuerzel: '↑', score: 2 },
};

/** Gesamt-Score 0–6 (0 = hart·geschlossen·tief, 6 = weich·offen·hoch). */
export function cervixScore(entry) {
  const f = CERVIX_FIRMNESS[entry.cervixFirmness];
  const o = CERVIX_OPENING[entry.cervixOpening];
  const p = CERVIX_POSITION[entry.cervixPosition];
  if (!f || !o || !p) return null;
  return f.score + o.score + p.score;
}

export function cervixKuerzel(entry) {
  const f = CERVIX_FIRMNESS[entry.cervixFirmness];
  const o = CERVIX_OPENING[entry.cervixOpening];
  const p = CERVIX_POSITION[entry.cervixPosition];
  if (!f && !o && !p) return '';
  return [f?.kuerzel ?? '', o?.kuerzel ?? '', p?.kuerzel ?? ''].join(' ').trim();
}

/** Agenda-Text laut Sektion 2 (fest/zu · Übergang · weich/offen). */
export function cervixAgenda(entry) {
  if (entry.cervixExcluded) return '–';
  const s = cervixScore(entry);
  if (s == null) return '';
  if (s === 0) return 'fest / zu';
  if (s === 6) return 'weich / offen';
  return 'Übergang';
}

// ── Temperatur ───────────────────────────────────────────────────────────────

export const TEMP_SITES = ['oral', 'rektal', 'vaginal'];

/** Rundet auf 0,05er-Schritte und liefert Hundertstel-°C (Ganzzahl, keine Float-Fehler). */
export function roundedCents(temperature) {
  return Math.round(Math.round(temperature * 100) / 5) * 5;
}

export function formatCents(cents) {
  return (cents / 100).toFixed(2).replace('.', ',');
}

export function formatDateDe(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

// ── Migration alter Einträge ─────────────────────────────────────────────────

const OLD_MUCUS = {
  'Nichts spürbar/sichtbar': 'none',
  'Feucht': 'f',
  'Cremig': 'S',
  'Spinnbar/glasig (Höhepunkt)': 'S+',
  'Wässrig': 'S',
};

const OLD_CERVIX = {
  'Geschlossen/fest': { firm: 'hart', open: 'geschlossen', pos: 'tief' },
  'Leicht geöffnet/mittel': { firm: 'mittel', open: 'leicht', pos: 'mittel' },
  'Offen/weich': { firm: 'weich', open: 'offen', pos: 'hoch' },
};

/**
 * Hebt einen Eintrag auf das aktuelle Datenmodell (neue Schleim-Skala,
 * Muttermund als 3 Eigenschaften, Modul-Flags). Idempotent.
 */
export function migrateEntry(e) {
  let changed = false;
  const n = { ...e };

  if (n.cervicalMucus && OLD_MUCUS[n.cervicalMucus]) {
    n.cervicalMucus = OLD_MUCUS[n.cervicalMucus];
    changed = true;
  }
  if ('cervix' in n) {
    const mapped = typeof n.cervix === 'string' ? OLD_CERVIX[n.cervix] : null;
    if (mapped) {
      n.cervixFirmness = mapped.firm;
      n.cervixOpening = mapped.open;
      n.cervixPosition = mapped.pos;
    }
    delete n.cervix;
    changed = true;
  }
  // Frühere getrennte Skip-/Störungs-Flags zu je einem "ausklammern"-Flag
  // pro Modul zusammenführen.
  if ('excluded' in n || 'tempSkipped' in n) {
    n.tempExcluded = !!(n.excluded || n.tempSkipped || n.tempExcluded);
    delete n.excluded;
    delete n.tempSkipped;
    changed = true;
  }
  if ('mucusDisturbed' in n) {
    n.mucusExcluded = !!(n.mucusDisturbed || n.mucusExcluded);
    delete n.mucusDisturbed;
    changed = true;
  }
  if ('cervixSkipped' in n || 'cervixDisturbed' in n) {
    n.cervixExcluded = !!(n.cervixSkipped || n.cervixDisturbed || n.cervixExcluded);
    delete n.cervixSkipped;
    delete n.cervixDisturbed;
    changed = true;
  }
  const boolDefaults = ['tempExcluded', 'mucusExcluded', 'cervixExcluded'];
  for (const k of boolDefaults) {
    if (!(k in n)) {
      n[k] = false;
      changed = true;
    }
  }
  const nullDefaults = ['tempSite', 'cervixFirmness', 'cervixOpening', 'cervixPosition'];
  for (const k of nullDefaults) {
    if (!(k in n)) {
      n[k] = null;
      changed = true;
    }
  }
  return { entry: n, changed };
}

// ── Temperatur-Auswertung (3-über-6 mit Ausnahmeregeln) ──────────────────────

const RISE_MIN_CENTS = 20; // 0,2 °C

/**
 * Wertet die Basaltemperatur eines Zyklus aus (Grundregel + Ausnahme 1/2,
 * nie kombiniert; Hilfslinie täglich neu; Lücken/übersprungene/ausgeklammerte
 * Tage zählen nicht mit).
 *
 * @param {Array} entries chronologisch sortierte Einträge EINES Zyklus
 * @returns {{
 *   status: 'no_data'|'searching'|'pending'|'completed',
 *   coverCents: number|null,
 *   low6: number[],            // Eintrags-Indizes der 6 tiefen Werte
 *   firstHigherIdx: number|null,
 *   higherIdxs: number[],      // gezählte höhere Tage (1..3)
 *   droppedIdx: number|null,   // Ausnahme 2: Tag auf/unter der Linie (zählt nicht)
 *   extraDayIdx: number|null,  // Ausnahme 1: der 4. Tag
 *   exception1: boolean, exception2: boolean,
 *   completedIdx: number|null, completedDate: string|null,
 *   messages: string[],
 * }}
 */
export function evaluateTemperature(entries) {
  const temps = [];
  entries.forEach((e, idx) => {
    if (
      typeof e.temperature === 'number' &&
      !Number.isNaN(e.temperature) &&
      !e.tempExcluded
    ) {
      temps.push({ idx, date: e.date, cents: roundedCents(e.temperature) });
    }
  });

  const base = {
    status: 'searching',
    coverCents: null,
    low6: [],
    firstHigherIdx: null,
    higherIdxs: [],
    droppedIdx: null,
    extraDayIdx: null,
    exception1: false,
    exception2: false,
    completedIdx: null,
    completedDate: null,
    messages: [],
  };

  if (temps.length === 0) {
    return { ...base, status: 'no_data', messages: ['Noch keine Temperaturwerte in diesem Zyklus.'] };
  }
  if (temps.length < 7) {
    return {
      ...base,
      messages: [
        `Erst ${temps.length} gültige Messwerte – für die Auswertung braucht es mindestens 6 tiefe Werte in Folge plus einen Anstieg.`,
      ],
    };
  }

  for (let k = 6; k < temps.length; k++) {
    const low6 = temps.slice(k - 6, k);
    const cover = Math.max(...low6.map((t) => t.cents));
    if (temps[k].cents <= cover) continue;

    const rise = confirmRise(temps, k, cover);
    if (rise.outcome === 'failed') continue;

    const result = {
      ...base,
      status: rise.outcome, // 'pending' | 'completed'
      coverCents: cover,
      low6: low6.map((t) => t.idx),
      firstHigherIdx: temps[k].idx,
      higherIdxs: rise.higher.map((i) => temps[i].idx),
      droppedIdx: rise.dropped != null ? temps[rise.dropped].idx : null,
      extraDayIdx: rise.extraDay != null ? temps[rise.extraDay].idx : null,
      exception1: rise.exception1,
      exception2: rise.exception2,
      completedIdx: rise.completedIdx != null ? temps[rise.completedIdx].idx : null,
      completedDate: rise.completedIdx != null ? temps[rise.completedIdx].date : null,
    };
    result.messages = tempMessages(result, entries);
    return result;
  }

  return {
    ...base,
    messages: [
      'Hilfslinie: noch keine 1. höhere Messung gefunden (kein Wert liegt über den 6 Werten davor).',
    ],
  };
}

/** Versucht ab Kandidat k (1. höhere Messung) den Anstieg regelkonform zu bestätigen. */
function confirmRise(temps, k, cover) {
  const higher = [k];
  let dropped = null;
  let exception1 = false;
  let i = k + 1;

  while (i < temps.length) {
    const v = temps[i].cents;

    if (exception1) {
      // Ausnahme 1: der 4. Tag muss nur irgendwie über der Linie liegen.
      if (v > cover) {
        return { outcome: 'completed', higher, dropped, exception1: true, exception2: false, extraDay: i, completedIdx: i };
      }
      // 4. Tag fällt auf/unter die Linie → bräuchte zusätzlich Ausnahme 2 → verboten.
      return { outcome: 'failed' };
    }

    if (v > cover) {
      higher.push(i);
      if (higher.length === 3) {
        if (v >= cover + RISE_MIN_CENTS) {
          return {
            outcome: 'completed',
            higher,
            dropped,
            exception1: false,
            exception2: dropped != null,
            extraDay: null,
            completedIdx: i,
          };
        }
        // 3. Wert nicht 0,2 °C drüber
        if (dropped != null) return { outcome: 'failed' }; // Ausnahme 1 + 2 verboten
        exception1 = true;
        i++;
        continue;
      }
    } else {
      // Wert fällt auf oder unter die Linie
      if (dropped != null) return { outcome: 'failed' }; // zweiter Ausreißer → neue Suche
      dropped = i;
    }
    i++;
  }

  return {
    outcome: 'pending',
    higher,
    dropped,
    exception1,
    exception2: dropped != null,
    extraDay: null,
    completedIdx: null,
  };
}

function tempMessages(r, entries) {
  const msgs = [];
  const cover = formatCents(r.coverCents);
  msgs.push(
    `Hilfslinie bei ${cover} °C – Höhe des höchsten der 6 tiefen Werte (Tage vor der 1. höheren Messung am ${formatDateDe(entries[r.firstHigherIdx]?.date)}).`
  );
  if (r.droppedIdx != null) {
    msgs.push(
      `Ausnahmeregel 2: Der Wert vom ${formatDateDe(entries[r.droppedIdx]?.date)} fiel auf/unter die Hilfslinie und zählt nicht. Der Zusatztag muss ≥ 0,2 °C über der Linie liegen.`
    );
  }
  if (r.status === 'completed') {
    const rule = r.exception1
      ? ' (Ausnahmeregel 1: langsamer Anstieg, 4. Tag über der Linie)'
      : r.exception2
        ? ' (Ausnahmeregel 2: Ausreißer übersprungen)'
        : ' (Grundregel 3-über-6)';
    msgs.push(
      `Temperaturauswertung abgeschlossen am Abend des ${formatDateDe(r.completedDate)}${rule}. Der Eisprung hat stattgefunden – die Messung kann für diesen Zyklus beendet werden.`
    );
  } else {
    if (r.exception1) {
      msgs.push(
        'Ausnahmeregel 1: Der 3. höhere Wert liegt über der Linie, aber nicht 0,2 °C darüber – es wird ein 4. Tag abgewartet (muss nur über der Linie liegen).'
      );
    } else {
      msgs.push(
        `${r.higherIdxs.length} von 3 höheren Messungen über der Hilfslinie – der 3. Wert muss mindestens 0,2 °C über der Linie liegen.`
      );
    }
  }
  return msgs;
}

// ── Zervixschleim-Auswertung (Höhepunkt + 3 Tage) ────────────────────────────

/**
 * @returns {{
 *   status: 'no_data'|'searching'|'pending'|'completed',
 *   peakIdx: number|null, peakDate: string|null,
 *   countedIdxs: number[],       // die Tage 1–3 mit schlechterer Qualität
 *   completedDate: string|null,
 *   messages: string[],
 * }}
 */
export function evaluateMucus(entries) {
  const valid = [];
  entries.forEach((e, idx) => {
    if (e.cervicalMucus && MUCUS[e.cervicalMucus] && !e.mucusExcluded) {
      valid.push({ idx, date: e.date, code: e.cervicalMucus });
    }
  });

  const base = {
    status: 'searching',
    peakIdx: null,
    peakDate: null,
    countedIdxs: [],
    completedDate: null,
    messages: [],
  };

  if (valid.length === 0) {
    return { ...base, status: 'no_data', messages: ['Noch keine Schleim-Beobachtungen in diesem Zyklus.'] };
  }

  for (let a = 0; a < valid.length; a++) {
    if (valid[a].code !== 'S+') continue;

    // Folgetage mit schlechterer Qualität zählen; taucht wieder S+ auf,
    // wird verworfen und der spätere S+-Tag zum neuen Kandidaten.
    const counted = [];
    let brokeAt = null;
    for (let b = a + 1; b < valid.length && counted.length < 3; b++) {
      if (valid[b].code === 'S+') {
        brokeAt = b;
        break;
      }
      counted.push(b);
    }
    if (brokeAt != null) {
      a = brokeAt - 1; // Schleife springt zum späteren S+
      continue;
    }

    const completed = counted.length === 3;
    const result = {
      ...base,
      status: completed ? 'completed' : 'pending',
      peakIdx: valid[a].idx,
      peakDate: valid[a].date,
      countedIdxs: counted.map((b) => valid[b].idx),
      completedDate: completed ? valid[counted[2]].date : null,
    };
    if (completed) {
      result.messages = [
        `Schleim-Höhepunkt am ${formatDateDe(result.peakDate)} (letzter S+): danach 3 Tage schlechtere Qualität – Auswertung am Abend des ${formatDateDe(result.completedDate)} abgeschlossen. Die Schleim-Eingabe wird für die Folgetage deaktiviert.`,
      ];
    } else {
      result.messages = [
        `Möglicher Schleim-Höhepunkt am ${formatDateDe(result.peakDate)} (S+). ${counted.length} von 3 Tagen mit schlechterer Qualität abgewartet – wird die Qualität wieder besser, beginnt die Zählung von vorn.`,
      ];
    }
    return result;
  }

  return { ...base, messages: ['Noch kein Höhepunkt erkennbar (es braucht mindestens einen S+-Tag).'] };
}

// ── Muttermund-Auswertung (Höhepunkt + 3 Tage hart/geschlossen/tief) ─────────

/**
 * @returns {{
 *   status: 'no_data'|'searching'|'pending'|'completed',
 *   peakIdx: number|null, peakDate: string|null,
 *   countedIdxs: number[],
 *   completedDate: string|null,
 *   maxScore: number|null,
 *   messages: string[],
 * }}
 */
export function evaluateCervix(entries) {
  const valid = [];
  entries.forEach((e, idx) => {
    if (e.cervixExcluded) return;
    const s = cervixScore(e);
    if (s != null) valid.push({ idx, date: e.date, score: s });
  });

  const base = {
    status: 'searching',
    peakIdx: null,
    peakDate: null,
    countedIdxs: [],
    completedDate: null,
    maxScore: null,
    messages: [],
  };

  if (valid.length === 0) {
    return { ...base, status: 'no_data', messages: ['Noch keine Muttermund-Beobachtungen in diesem Zyklus.'] };
  }

  const maxScore = Math.max(...valid.map((v) => v.score));
  if (maxScore === 0) {
    return {
      ...base,
      maxScore,
      messages: ['Der Muttermund war bisher durchgehend hart, geschlossen und tief – noch kein fruchtbarer Umschwung erkennbar.'],
    };
  }

  let peak = null; // Index in valid
  let counted = [];
  let completedAt = null;

  for (let x = 0; x < valid.length; x++) {
    const s = valid[x].score;
    if (s === maxScore) {
      // neuer/späterer Höhepunkt-Kandidat → Zählung von vorn
      peak = x;
      counted = [];
    } else if (peak != null) {
      if (s === 0) {
        counted.push(x);
        if (counted.length === 3) {
          completedAt = x;
          break;
        }
      } else {
        // wieder weicher/offener/höher (aber nicht Maximum) → von vorne zählen
        counted = [];
      }
    }
  }

  if (peak == null) return { ...base, maxScore, messages: ['Noch kein Höhepunkt erkennbar.'] };

  const completed = completedAt != null;
  const result = {
    ...base,
    status: completed ? 'completed' : 'pending',
    peakIdx: valid[peak].idx,
    peakDate: valid[peak].date,
    countedIdxs: counted.map((x) => valid[x].idx),
    completedDate: completed ? valid[completedAt].date : null,
    maxScore,
  };
  if (completed) {
    result.messages = [
      `Muttermund-Höhepunkt am ${formatDateDe(result.peakDate)} (weichste/offenste/höchste Ausprägung): danach 3 Tage hart, geschlossen und tief – Auswertung am Abend des ${formatDateDe(result.completedDate)} abgeschlossen. Muttermund-Auswertung für diesen Zyklus abgeschlossen.`,
    ];
  } else {
    result.messages = [
      `Möglicher Muttermund-Höhepunkt am ${formatDateDe(result.peakDate)}. ${result.countedIdxs.length} von 3 Tagen hart/geschlossen/tief abgewartet – wird der Muttermund wieder weicher/offener/höher, beginnt die Zählung von vorn.`,
    ];
  }
  return result;
}

// ── Gesamt-Auswertung (doppelte Kontrolle) ───────────────────────────────────

const NO_RISE_HINT_DAY = 26;

/**
 * Kombiniert Temperatur + (Schleim oder Muttermund) zur doppelten Kontrolle.
 * Muttermund ersetzt nur den Schleim, nie die Temperatur. Liegen Schleim UND
 * Muttermund vor, gilt der konservativere (spätere) Zeitpunkt.
 *
 * @param {Array} entries Einträge EINES Zyklus (chronologisch)
 * @param {{cervixLearning?: boolean}} opts
 */
export function evaluateCycle(entries, opts = {}) {
  const temperature = evaluateTemperature(entries);
  const mucus = evaluateMucus(entries);
  const cervix = evaluateCervix(entries);
  const cervixLearning = !!opts.cervixLearning;

  const mucusObserved = mucus.status !== 'no_data';
  const cervixObserved = cervix.status !== 'no_data';
  const cervixUsable = cervixObserved && !cervixLearning;

  // Symptom-Seite der doppelten Kontrolle (konservativ):
  let symptomDate = null;
  let symptomMethod = null;
  if (mucusObserved && cervixUsable) {
    if (mucus.status === 'completed' && cervix.status === 'completed') {
      symptomDate = mucus.completedDate >= cervix.completedDate ? mucus.completedDate : cervix.completedDate;
      symptomMethod = 'Schleim + Muttermund (konservativerer Wert)';
    }
  } else if (mucusObserved) {
    if (mucus.status === 'completed') {
      symptomDate = mucus.completedDate;
      symptomMethod = 'Zervixschleim';
    }
  } else if (cervixUsable) {
    if (cervix.status === 'completed') {
      symptomDate = cervix.completedDate;
      symptomMethod = 'Muttermund (Ersatzzeichen)';
    }
  }

  const tempDone = temperature.status === 'completed';
  const complete = tempDone && symptomDate != null;
  const infertileFrom = complete
    ? (temperature.completedDate >= symptomDate ? temperature.completedDate : symptomDate)
    : null;

  const messages = [];
  if (complete) {
    messages.push(
      `Doppelte Kontrolle erfüllt (Temperatur + ${symptomMethod}): Die unfruchtbare Zyklusphase beginnt am Abend des ${formatDateDe(infertileFrom)}.`
    );
  } else if (tempDone && !symptomDate) {
    messages.push(
      'Temperaturauswertung abgeschlossen – die doppelte Kontrolle wartet noch auf die Schleim- bzw. Muttermund-Auswertung.'
    );
  } else if (!tempDone && symptomDate) {
    messages.push(
      'Schleim-/Muttermund-Auswertung abgeschlossen – die doppelte Kontrolle wartet noch auf die Temperaturauswertung.'
    );
  }
  if (
    temperature.status === 'searching' &&
    entries.length >= NO_RISE_HINT_DAY
  ) {
    messages.push(
      `Bisher kein Temperaturanstieg erkennbar (Zyklustag ${entries.length}) – vermutlich hat (noch) kein Eisprung stattgefunden.`
    );
  }
  if (cervixObserved && cervixLearning) {
    messages.push(
      'Lernphase Muttermund: In den ersten 2–3 Zyklen sollte die Muttermund-Auswertung noch nicht zur Verhütung herangezogen werden.'
    );
  }

  return {
    temperature,
    mucus,
    cervix,
    cervixLearning,
    symptomDate,
    symptomMethod,
    complete,
    infertileFrom,
    messages,
  };
}

// ── Hilfen für Formular & Kalender ───────────────────────────────────────────

/** Findet den Zyklus, in den ein Datum fällt (Start ≤ Datum < nächster Start). */
export function findCycleForDate(cycles, iso) {
  let found = null;
  for (const c of cycles) {
    if (c.startDate <= iso) found = c;
  }
  if (!found) return null;
  if (!found.isCurrent && found.endDate && iso > found.endDate) return null;
  return found;
}

/** Erster im Zyklus festgelegter Messort (fixiert für den Rest des Zyklus). */
export function fixedTempSite(cycleEntries, exceptDate = null) {
  for (const e of cycleEntries) {
    if (e.date === exceptDate) continue;
    if (e.tempSite && typeof e.temperature === 'number') return e.tempSite;
  }
  return null;
}
