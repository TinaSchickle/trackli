import { describe, it, expect } from 'vitest';
import {
  roundedCents,
  evaluateTemperature,
  evaluateMucus,
  evaluateCervix,
  evaluateCycle,
  migrateEntry,
  cervixScore,
  cervixKuerzel,
  cervixAgenda,
} from '../utils/nfp.js';

// Hilfsfunktionen zum Bauen von Zyklus-Einträgen (chronologisch ab 2026-01-01).
function day(i) {
  return `2026-01-${String(i + 1).padStart(2, '0')}`;
}
function tempEntries(temps, patchByIndex = {}) {
  return temps.map((t, i) => ({
    date: day(i),
    temperature: t,
    tempExcluded: false,
    ...(patchByIndex[i] || {}),
  }));
}
const LOW6 = [36.5, 36.55, 36.5, 36.45, 36.55, 36.5]; // max 36,55 → Hilfslinie 3655

describe('Rundung (0,05er-Schritte)', () => {
  it('rundet die zweite Nachkommastelle korrekt', () => {
    expect(roundedCents(36.22)).toBe(3620);
    expect(roundedCents(36.23)).toBe(3625);
    expect(roundedCents(36.58)).toBe(3660);
    expect(roundedCents(36.55)).toBe(3655);
  });
});

describe('Temperatur – Grundregel 3 über 6', () => {
  it('schließt am 3. höheren Tag ab (≥ 0,2 °C über der Linie)', () => {
    const r = evaluateTemperature(tempEntries([...LOW6, 36.65, 36.75, 36.85]));
    expect(r.status).toBe('completed');
    expect(r.coverCents).toBe(3655);
    expect(r.exception1).toBe(false);
    expect(r.exception2).toBe(false);
    expect(r.higherIdxs).toHaveLength(3);
  });

  it('bleibt pending, wenn erst 2 höhere Werte vorliegen', () => {
    const r = evaluateTemperature(tempEntries([...LOW6, 36.65, 36.75]));
    expect(r.status).toBe('pending');
  });
});

describe('Temperatur – Ausnahmeregel 1 (langsamer Anstieg)', () => {
  it('wartet den 4. Tag ab, der nur über der Linie liegen muss', () => {
    const r = evaluateTemperature(tempEntries([...LOW6, 36.65, 36.7, 36.7, 36.65]));
    expect(r.status).toBe('completed');
    expect(r.exception1).toBe(true);
    expect(r.exception2).toBe(false);
    expect(r.extraDayIdx).toBe(9);
  });
});

describe('Temperatur – Ausnahmeregel 2 (Ausreißer nach unten)', () => {
  it('überspringt den abgerutschten Tag; Zusatztag ≥ 0,2 °C', () => {
    const r = evaluateTemperature(tempEntries([...LOW6, 36.65, 36.5, 36.7, 36.8]));
    expect(r.status).toBe('completed');
    expect(r.exception2).toBe(true);
    expect(r.exception1).toBe(false);
    expect(r.droppedIdx).toBe(7);
  });
});

describe('Temperatur – Verbot (Ausnahme 1 und 2 nie kombiniert)', () => {
  it('schließt nicht ab, wenn beide Ausnahmen zugleich zuträfen', () => {
    // Ausreißer nach unten UND danach kein 0,2-Anstieg → nicht abgeschlossen.
    const r = evaluateTemperature(tempEntries([...LOW6, 36.65, 36.5, 36.7, 36.7]));
    expect(r.status).not.toBe('completed');
  });
});

describe('Temperatur – kein Anstieg & Ausklammern', () => {
  it('findet ohne Anstieg keine Hilfslinie', () => {
    const r = evaluateTemperature(tempEntries([...LOW6, 36.5, 36.48, 36.52, 36.5]));
    expect(r.status).toBe('searching');
    expect(r.coverCents).toBeNull();
  });

  it('überspringt ausgeklammerte Werte wie Lücken', () => {
    // Ein ausgeklammerter Ausreißer mitten in der Tieflage darf nicht stören.
    const temps = [36.5, 36.55, 36.9, 36.45, 36.55, 36.5, 36.5, 36.65, 36.75, 36.85];
    const r = evaluateTemperature(
      tempEntries(temps, { 2: { tempExcluded: true } })
    );
    expect(r.status).toBe('completed');
    expect(r.coverCents).toBe(3655);
  });
});

describe('Zervixschleim – Höhepunkt + 3 Tage', () => {
  const mk = (codes) => codes.map((code, i) => ({ date: day(i), cervicalMucus: code, mucusExcluded: false }));

  it('schließt 3 Tage nach dem letzten S+ ab', () => {
    const r = evaluateMucus(mk(['t', 'f', 'S', 'S+', 'S', 'f', 'none']));
    expect(r.status).toBe('completed');
    expect(r.peakDate).toBe(day(3));
    expect(r.countedIdxs).toHaveLength(3);
  });

  it('verwirft die Zählung, wenn der Schleim wieder besser wird', () => {
    const r = evaluateMucus(mk(['S+', 'S', 'S+', 'S', 'f', 'none']));
    expect(r.peakDate).toBe(day(2)); // späterer S+ ist der Höhepunkt
    expect(r.status).toBe('completed');
  });

  it('überspringt gestörte Schleimtage', () => {
    const entries = mk(['S+', 'S', 'f', 'none']);
    entries[1].mucusExcluded = true; // gestört → zählt nicht
    const r = evaluateMucus(entries);
    // nur noch 2 gültige schlechtere Tage → pending
    expect(r.status).toBe('pending');
  });
});

describe('Muttermund – kombinierter Zustand + Auswertung', () => {
  const mk = (states) => states.map((s, i) => ({ date: day(i), cervixState: s, cervixExcluded: false }));

  it('liefert Score/Kürzel/Agenda für die 3 Stufen', () => {
    expect(cervixScore({ cervixState: 'fest' })).toBe(0);
    expect(cervixScore({ cervixState: 'weich' })).toBe(2);
    expect(cervixKuerzel({ cervixState: 'weich' })).toBe('◯');
    expect(cervixAgenda({ cervixState: 'fest' })).toBe('fest / zu');
    expect(cervixAgenda({ cervixExcluded: true })).toBe('–');
  });

  it('schließt 3 feste Tage nach dem weich-Höhepunkt ab', () => {
    const r = evaluateCervix(mk(['fest', 'uebergang', 'weich', 'fest', 'fest', 'fest']));
    expect(r.status).toBe('completed');
    expect(r.peakDate).toBe(day(2));
    expect(r.countedIdxs).toHaveLength(3);
  });
});

describe('Doppelte Kontrolle (evaluateCycle)', () => {
  function cycle(overrides = []) {
    const base = [...LOW6, 36.65, 36.75, 36.85];
    const mucus = ['t', 'none', 'f', 'S', 'S+', 'S', 'f', 'none', 'none'];
    const cervix = ['fest', 'fest', 'uebergang', 'weich', 'weich', 'fest', 'fest', 'fest', 'fest'];
    return base.map((t, i) => ({
      date: day(i),
      temperature: t,
      tempExcluded: false,
      cervicalMucus: mucus[i] ?? null,
      mucusExcluded: false,
      cervixState: cervix[i] ?? null,
      cervixExcluded: false,
      ...(overrides[i] || {}),
    }));
  }

  it('ist erst erfüllt, wenn Temperatur UND Schleim abgeschlossen sind', () => {
    const ev = evaluateCycle(cycle(), { trackTemp: true, trackMucus: true, trackCervix: false });
    expect(ev.complete).toBe(true);
    expect(ev.symptomMethod).toBe('Zervixschleim');
    expect(ev.infertileFrom).not.toBeNull();
  });

  it('nutzt den Muttermund als Ersatz, wenn Schleim nicht ausgewertet wird', () => {
    const ev = evaluateCycle(cycle(), { trackTemp: true, trackMucus: false, trackCervix: true });
    expect(ev.complete).toBe(true);
    expect(ev.symptomMethod).toBe('Muttermund (Ersatzzeichen)');
  });

  it('ist ohne zweites Zeichen nicht erfüllt (nur Temperatur)', () => {
    const ev = evaluateCycle(cycle(), { trackTemp: true, trackMucus: false, trackCervix: false });
    expect(ev.complete).toBe(false);
  });

  it('zählt den Muttermund in der Lernphase nicht mit', () => {
    const ev = evaluateCycle(cycle(), {
      trackTemp: true,
      trackMucus: false,
      trackCervix: true,
      cervixLearning: true,
    });
    expect(ev.complete).toBe(false);
  });
});

describe('Migration alter Einträge', () => {
  it('hebt alte Schleim-Skala, Muttermund-Trio und Störflags an', () => {
    const { entry } = migrateEntry({
      date: '2025-01-01',
      cervicalMucus: 'Wässrig',
      cervixFirmness: 'weich',
      cervixOpening: 'offen',
      cervixPosition: 'hoch',
      tempSkipped: true,
      cervixDisturbed: true,
    });
    expect(entry.cervicalMucus).toBe('S');
    expect(entry.cervixState).toBe('weich');
    expect(entry.tempExcluded).toBe(true);
    expect(entry.cervixExcluded).toBe(true);
    expect('cervixFirmness' in entry).toBe(false);
    expect('tempSkipped' in entry).toBe(false);
  });

  it('wandelt die sehr alte cervix-String-Kodierung um', () => {
    const { entry } = migrateEntry({ date: '2025-01-01', cervix: 'Geschlossen/fest' });
    expect(entry.cervixState).toBe('fest');
    expect('cervix' in entry).toBe(false);
  });

  it('ist idempotent (neues Modell bleibt unverändert)', () => {
    const modern = {
      date: '2026-01-01',
      temperature: 36.5,
      tempSite: 'rektal',
      tempExcluded: false,
      cervicalMucus: 'S+',
      mucusExcluded: false,
      cervixState: 'weich',
      cervixExcluded: false,
      ferning: null,
      notes: '',
      isPeriodStart: true,
    };
    const { changed } = migrateEntry(modern);
    expect(changed).toBe(false);
  });
});
