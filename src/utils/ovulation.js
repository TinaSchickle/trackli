// ⚠️ WICHTIG: Diese Implementierung ist eine vereinfachte Annäherung an die
// Sensiplan-3-über-6-Regel. Sie dient der App-internen Auswertung/Charting,
// ist aber NICHT fachlich zertifiziert und ersetzt keine Sensiplan-Schulung
// oder ärztliche/fachliche Prüfung. Vor produktivem Einsatz unbedingt gegen
// echte Zyklusdaten und die offizielle Sensiplan-Regelwerksbeschreibung
// verifizieren (insbesondere Ausnahme-/Störungsregeln bei Ausreißern,
// Krankheit, Zeitverschiebung etc. sind hier NICHT abgebildet).

/**
 * Ermittelt den Umschlagpunkt (letzter "tiefer" Tag) nach der 3-über-6-Regel.
 * @param {Array<{date: string, temperature: number|null}>} entries - chronologisch sortierte Einträge EINES Zyklus
 * @returns {{ dayIndex: number, date: string, coverline: number, confirmedOn: string } | null}
 *   dayIndex = Index (0-basiert) des letzten Tages der "6 tiefen" Werte,
 *   also der geschätzte Tag des Temperaturanstiegs (Umschlagpunkt).
 */
export function findTemperatureShift(entries) {
  const temps = entries
    .map((e, i) => ({ ...e, idx: i }))
    .filter((e) => typeof e.temperature === 'number' && !Number.isNaN(e.temperature));

  if (temps.length < 9) return null; // 6 tiefe + 3 hohe Werte nötig

  for (let k = 6; k <= temps.length - 3; k++) {
    const low6 = temps.slice(k - 6, k);
    const high3 = temps.slice(k, k + 3);
    const maxLow = Math.max(...low6.map((t) => t.temperature));

    const allHigher = high3.every((t) => t.temperature > maxLow);
    const thirdHighEnough = high3[2].temperature >= maxLow + 0.2;

    if (allHigher && thirdHighEnough) {
      const shiftEntry = temps[k - 1]; // letzter tiefer Tag = Umschlagpunkt
      return {
        dayIndex: shiftEntry.idx,
        date: shiftEntry.date,
        coverline: maxLow,
        confirmedOn: high3[2].date,
      };
    }
  }
  return null;
}

const MUCUS_PEAK = 'Spinnbar/glasig (Höhepunkt)';

/**
 * Kombiniert Temperatur-Umschlagpunkt mit Schleim-Höhepunkt zu einer
 * geschätzten Ovulationstag-Angabe (Zyklustag, 1-basiert).
 * @param {Array<{date:string, temperature:number|null, cervicalMucus:string|null}>} entries
 */
export function estimateOvulationDay(entries) {
  const shift = findTemperatureShift(entries);
  const mucusPeakIdx = entries.findIndex((e) => e.cervicalMucus === MUCUS_PEAK);

  if (!shift && mucusPeakIdx === -1) return null;

  // Wenn beide vorhanden: Ovulation ≈ Schleim-Höhepunkt, sofern zeitlich
  // plausibel nah am Temperaturanstieg (Sensiplan-Grundidee); sonst
  // konservativ den späteren der beiden Indikatoren verwenden.
  let ovulationIdx;
  if (shift && mucusPeakIdx !== -1) {
    ovulationIdx = Math.max(shift.dayIndex, mucusPeakIdx);
  } else if (shift) {
    ovulationIdx = shift.dayIndex;
  } else {
    ovulationIdx = mucusPeakIdx;
  }

  return {
    cycleDay: ovulationIdx + 1,
    date: entries[ovulationIdx]?.date ?? null,
    method: shift && mucusPeakIdx !== -1 ? 'Temperatur + Schleim' : shift ? 'Temperatur' : 'Schleim',
    thermalShift: shift,
  };
}
