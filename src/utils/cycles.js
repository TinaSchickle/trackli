import { estimateOvulationDay } from './ovulation.js';

/**
 * Segmentiert eine chronologisch sortierte Liste von Einträgen in Zyklen,
 * anhand des isPeriodStart-Flags. Jeder Zyklus reicht vom eigenen
 * Periodenbeginn bis (exklusiv) zum nächsten Periodenbeginn.
 * @param {Array<Object>} allEntries - unsortiert erlaubt
 * @returns {Array<{startDate:string, endDate:string|null, entries:Array, isCurrent:boolean, length:number|null, ovulation:Object|null}>}
 */
export function segmentIntoCycles(allEntries) {
  const sorted = [...allEntries].sort((a, b) => a.date.localeCompare(b.date));
  const startIndices = sorted
    .map((e, i) => (e.isPeriodStart ? i : -1))
    .filter((i) => i !== -1);

  if (startIndices.length === 0) return [];

  const cycles = [];
  for (let c = 0; c < startIndices.length; c++) {
    const start = startIndices[c];
    const end = c + 1 < startIndices.length ? startIndices[c + 1] : sorted.length;
    const cycleEntries = sorted.slice(start, end);
    const isCurrent = c === startIndices.length - 1;

    cycles.push({
      id: cycleEntries[0].date,
      startDate: cycleEntries[0].date,
      endDate: isCurrent ? null : cycleEntries[cycleEntries.length - 1].date,
      length: isCurrent ? null : cycleEntries.length,
      entries: cycleEntries,
      isCurrent,
      ovulation: estimateOvulationDay(cycleEntries),
    });
  }
  return cycles;
}
