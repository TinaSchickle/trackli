import { OvulationChart, CycleLengthChart } from './Charts.jsx';

export default function Dashboard({ cycles }) {
  const completed = cycles.filter((c) => !c.isCurrent);
  const avgCycleLength = average(completed.map((c) => c.length));
  const avgOvulationDay = average(
    completed.map((c) => c.ovulation?.cycleDay).filter((v) => typeof v === 'number')
  );

  const currentCycle = cycles.find((c) => c.isCurrent);

  return (
    <div>
      <div className="stat-grid" style={{ marginBottom: 16 }}>
        <div className="stat">
          <div className="value">{avgCycleLength ?? '–'}</div>
          <div className="label">Ø Zykluslänge (Tage)</div>
        </div>
        <div className="stat">
          <div className="value">{avgOvulationDay ?? '–'}</div>
          <div className="label">Ø Ovulationstag</div>
        </div>
      </div>

      {currentCycle && (
        <div className="card">
          <h3 style={{ fontSize: '1rem' }}>Aktueller Zyklus</h3>
          <p style={{ margin: '0 0 4px', fontSize: '0.9rem', color: 'var(--color-text-soft)' }}>
            Start: {formatDate(currentCycle.startDate)} · Tag {currentCycle.entries.length}
          </p>
          {currentCycle.ovulation ? (
            <p style={{ margin: 0, fontSize: '0.9rem' }}>
              Ovulation geschätzt: Tag {currentCycle.ovulation.cycleDay} (
              {currentCycle.ovulation.method})
            </p>
          ) : (
            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--color-text-soft)' }}>
              Noch keine ausreichende Datenlage für eine Ovulationsschätzung.
            </p>
          )}
        </div>
      )}

      <div className="card">
        <h3 style={{ fontSize: '1rem' }}>Ovulationstag pro Zyklus</h3>
        <OvulationChart cycles={cycles} />
      </div>

      <div className="card">
        <h3 style={{ fontSize: '1rem' }}>Zykluslänge pro Zyklus</h3>
        <CycleLengthChart cycles={cycles} />
      </div>
    </div>
  );
}

function average(arr) {
  const vals = arr.filter((v) => typeof v === 'number' && !Number.isNaN(v));
  if (vals.length === 0) return null;
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
}

function formatDate(iso) {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}
