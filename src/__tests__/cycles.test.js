import { describe, it, expect } from 'vitest';
import { segmentIntoCycles } from '../utils/cycles.js';
import { findCycleForDate, fixedTempSite, cycleSite, fertilityForecast, migrateEntry } from '../utils/nfp.js';
import { generateTestEntries, CYCLE_CONFIGS } from '../testData.js';

describe('Testdaten – 10 vollständige Zyklen', () => {
  const entries = generateTestEntries();
  const cycles = segmentIntoCycles(entries);

  it('segmentiert genau 10 Zyklen', () => {
    expect(cycles).toHaveLength(10);
    expect(CYCLE_CONFIGS).toHaveLength(10);
  });

  it('Zyklus 1: Temperatur + Schleim → abgeschlossen', () => {
    expect(cycles[0].evaluation.complete).toBe(true);
    expect(cycles[0].evaluation.symptomMethod).toBe('Zervixschleim');
  });

  it('Zyklus 2: Muttermund noch Lernphase → Schleim entscheidet', () => {
    expect(cycles[1].cervixLearning).toBe(true);
    expect(cycles[1].evaluation.symptomMethod).toBe('Zervixschleim');
  });

  it('Zyklus 3: Muttermund auswertbar → Schleim + Muttermund', () => {
    expect(cycles[2].cervixLearning).toBe(false);
    expect(cycles[2].evaluation.symptomMethod).toBe('Schleim + Muttermund (konservativerer Wert)');
  });

  it('Zyklus 4: Ausnahmeregel 1 greift', () => {
    expect(cycles[3].evaluation.temperature.exception1).toBe(true);
    expect(cycles[3].evaluation.complete).toBe(true);
  });

  it('Zyklus 5: Ausnahmeregel 2 greift', () => {
    expect(cycles[4].evaluation.temperature.exception2).toBe(true);
    expect(cycles[4].evaluation.complete).toBe(true);
  });

  it('Zyklus 6: kein Eisprung → nicht abgeschlossen', () => {
    expect(cycles[5].evaluation.temperature.status).toBe('searching');
    expect(cycles[5].evaluation.complete).toBe(false);
    expect(cycles[5].evaluation.messages.join(' ')).toMatch(/kein.*Eisprung/i);
  });

  it('Zyklus 7: Temperatur + Muttermund (Schleim aus)', () => {
    expect(cycles[6].tracks).toMatchObject({ temp: true, mucus: false, cervix: true });
    expect(cycles[6].evaluation.symptomMethod).toBe('Muttermund (Ersatzzeichen)');
    expect(cycles[6].evaluation.complete).toBe(true);
  });

  it('Zyklus 8: ausgeklammerte Störtage stören die Auswertung nicht', () => {
    expect(cycles[7].evaluation.complete).toBe(true);
  });

  it('Zyklus 9 (kurz) und Zyklus 10 (aktuell) sind abgeschlossen', () => {
    expect(cycles[8].evaluation.complete).toBe(true);
    expect(cycles[9].isCurrent).toBe(true);
    expect(cycles[9].evaluation.complete).toBe(true);
  });

  it('Testeinträge entsprechen bereits dem aktuellen Datenmodell (Migration idempotent)', () => {
    const anyChanged = entries.some((e) => migrateEntry(e).changed);
    expect(anyChanged).toBe(false);
  });
});

describe('Zyklus-Hilfen', () => {
  const entries = generateTestEntries();
  const cycles = segmentIntoCycles(entries);

  it('findCycleForDate ordnet ein Datum dem richtigen Zyklus zu', () => {
    const c3 = cycles[2];
    const mid = c3.entries[5].date;
    expect(findCycleForDate(cycles, mid).id).toBe(c3.id);
  });

  it('fixedTempSite liefert den im Zyklus festgelegten Messort', () => {
    const c1 = cycles[0];
    expect(fixedTempSite(c1.entries)).toBe('rektal');
  });

  it('cycleSite liest die Messart vom Starteintrag (Vorgabe oral)', () => {
    expect(cycleSite(cycles[0])).toBe('rektal');
    expect(cycleSite(null)).toBe('oral');
  });
});

describe('Fruchtbarkeits- & Eisprung-Prognose', () => {
  const cycles = segmentIntoCycles(generateTestEntries());
  const c1 = cycles[0];

  it('ist bis Tag 5 unfruchtbar', () => {
    const f = fertilityForecast(c1, cycles, c1.entries[2].date); // Tag 3
    expect(f.cycleDay).toBe(3);
    expect(f.phase).toBe('infertile');
  });

  it('ist in der fruchtbaren Phase (vor dem Eisprung) fruchtbar', () => {
    const f = fertilityForecast(c1, cycles, c1.entries[8].date); // Tag 9
    expect(f.phase).toBe('fertile');
  });

  it('ist nach dem bestätigten Eisprung wieder unfruchtbar', () => {
    const last = c1.entries[c1.entries.length - 1].date;
    const f = fertilityForecast(c1, cycles, last);
    expect(f.phase).toBe('infertile');
    expect(f.ovulation.kind).toBe('detected');
  });

  it('prognostiziert den Eisprung im laufenden Zyklus (kein Rückblick)', () => {
    // Zyklus 6 (anovulatorisch) → keine Bestätigung, aber eine Vorhersage.
    const c6 = cycles[5];
    const f = fertilityForecast(c6, cycles, c6.entries[7].date);
    expect(['predicted', 'imminent']).toContain(f.ovulation.kind);
    expect(f.ovulation.date).toBeTruthy();
  });
});
