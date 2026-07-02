import { addArchivedChart } from '../db.js';

/**
 * Serialisiert ein SVG-DOM-Element (vom aktuellen Recharts-Chart) und
 * speichert es als eigenständiges, eingebettetes SVG-Dokument in IndexedDB.
 */
export async function archiveCycleChart({ svgElement, cycle }) {
  if (!svgElement) throw new Error('Kein SVG-Element zum Archivieren gefunden.');

  const clone = svgElement.cloneNode(true);
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  if (!clone.getAttribute('width')) {
    const bbox = svgElement.getBoundingClientRect();
    clone.setAttribute('width', String(bbox.width));
    clone.setAttribute('height', String(bbox.height));
  }

  const serializer = new XMLSerializer();
  const svgMarkup = serializer.serializeToString(clone);

  const record = {
    id: `${cycle.startDate}__${Date.now()}`,
    cycleStartDate: cycle.startDate,
    cycleEndDate: cycle.endDate,
    ovulationDay: cycle.ovulation?.cycleDay ?? null,
    svgMarkup,
    createdAt: new Date().toISOString(),
  };

  await addArchivedChart(record);
  return record;
}

export function svgMarkupToDataUrl(svgMarkup) {
  const encoded = encodeURIComponent(svgMarkup)
    .replace(/'/g, '%27')
    .replace(/"/g, '%22');
  return `data:image/svg+xml;charset=utf-8,${encoded}`;
}
