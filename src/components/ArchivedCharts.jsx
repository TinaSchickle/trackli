import { useEffect, useState } from 'react';
import { getAllArchivedCharts } from '../db.js';
import { svgMarkupToDataUrl } from '../utils/chartExport.js';

export default function ArchivedCharts() {
  const [charts, setCharts] = useState([]);

  useEffect(() => {
    getAllArchivedCharts().then((list) => {
      list.sort((a, b) => b.cycleStartDate.localeCompare(a.cycleStartDate));
      setCharts(list);
    });
  }, []);

  if (charts.length === 0) {
    return (
      <div className="empty-state">
        Noch keine archivierten Zyklus-Charts. Sie werden automatisch beim
        nächsten Periodenbeginn abgelegt.
      </div>
    );
  }

  return (
    <div className="archive-grid">
      {charts.map((c) => (
        <div key={c.id} className="archive-thumb">
          <img
            src={svgMarkupToDataUrl(c.svgMarkup)}
            alt={`Zyklus-Chart ab ${c.cycleStartDate}`}
            style={{ width: '100%', display: 'block', borderRadius: 8 }}
          />
          <div className="cycle-label">
            {formatDate(c.cycleStartDate)} – {c.cycleEndDate ? formatDate(c.cycleEndDate) : '?'}
            {c.ovulationDay ? ` · Ov. Tag ${c.ovulationDay}` : ''}
          </div>
        </div>
      ))}
    </div>
  );
}

function formatDate(iso) {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}
