// Ovulationsschätzung auf Basis der NFP-Auswertung (siehe utils/nfp.js).
// ⚠️ Nicht fachlich zertifiziert – ersetzt keine Sensiplan-Schulung.

import { evaluateTemperature, evaluateMucus } from './nfp.js';

/**
 * Ermittelt den Umschlagpunkt (letzter "tiefer" Tag) nach der 3-über-6-Regel
 * inkl. Ausnahmeregeln aus der vollständigen Temperaturauswertung.
 * @param {Array<{date: string, temperature: number|null}>} entries - chronologisch sortierte Einträge EINES Zyklus
 * @returns {{ dayIndex: number, date: string, coverline: number, confirmedOn: string } | null}
 */
export function findTemperatureShift(entries) {
  const t = evaluateTemperature(entries);
  if (t.status !== 'completed') return null;
  const lastLowIdx = t.low6[t.low6.length - 1];
  return {
    dayIndex: lastLowIdx,
    date: entries[lastLowIdx]?.date,
    coverline: t.coverCents / 100,
    confirmedOn: t.completedDate,
  };
}

/**
 * Kombiniert Temperatur-Umschlagpunkt mit Schleim-Höhepunkt zu einer
 * geschätzten Ovulationstag-Angabe (Zyklustag, 1-basiert).
 */
export function estimateOvulationDay(entries) {
  const shift = findTemperatureShift(entries);
  const mucus = evaluateMucus(entries);
  const mucusPeakIdx = mucus.peakIdx; // auch bei "pending" bereits ein Kandidat

  if (!shift && mucusPeakIdx == null) return null;

  // Wenn beide vorhanden: Ovulation ≈ Schleim-Höhepunkt, sofern zeitlich
  // plausibel nah am Temperaturanstieg (Sensiplan-Grundidee); sonst
  // konservativ den späteren der beiden Indikatoren verwenden.
  let ovulationIdx;
  if (shift && mucusPeakIdx != null) {
    ovulationIdx = Math.max(shift.dayIndex, mucusPeakIdx);
  } else if (shift) {
    ovulationIdx = shift.dayIndex;
  } else {
    ovulationIdx = mucusPeakIdx;
  }

  return {
    cycleDay: ovulationIdx + 1,
    date: entries[ovulationIdx]?.date ?? null,
    method:
      shift && mucusPeakIdx != null ? 'Temperatur + Schleim' : shift ? 'Temperatur' : 'Schleim',
    thermalShift: shift,
  };
}
