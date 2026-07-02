import { useEffect, useMemo, useRef, useState } from 'react';
import { getAllEntries } from './db.js';
import { segmentIntoCycles } from './utils/cycles.js';
import { todayIso } from './utils/dates.js';
import { archiveCycleChart } from './utils/chartExport.js';
import EntryForm from './components/EntryForm.jsx';
import CycleCalendar from './components/CycleCalendar.jsx';
import Dashboard from './components/Dashboard.jsx';
import ArchivedCharts from './components/ArchivedCharts.jsx';
import CycleChart from './components/CycleChart.jsx';
import BackupModal from './components/BackupModal.jsx';
import Nav from './components/Nav.jsx';

export default function App() {
  const [entries, setEntries] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState('entry');
  const [selectedDate, setSelectedDate] = useState(todayIso());
  const [showBackup, setShowBackup] = useState(false);
  const hiddenChartRef = useRef(null);

  useEffect(() => {
    getAllEntries().then((data) => {
      setEntries(data);
      setLoaded(true);
    });
  }, []);

  const cycles = useMemo(() => segmentIntoCycles(entries), [entries]);
  const currentCycle = cycles.find((c) => c.isCurrent);

  async function handleEntrySaved(savedEntry) {
    const isNewPeriodStart =
      savedEntry.isPeriodStart && !entries.some((e) => e.id === savedEntry.id);

    // Vor dem State-Update archivieren: an dieser Stelle spiegelt `cycles`
    // (und damit das versteckte CycleChart) noch den ALTEN, gerade zu Ende
    // gehenden Zyklus wider.
    if (isNewPeriodStart && currentCycle && currentCycle.entries.length > 0) {
      try {
        const svg = hiddenChartRef.current?.querySelector('svg');
        if (svg) {
          await archiveCycleChart({ svgElement: svg, cycle: { ...currentCycle, endDate: savedEntry.date } });
        }
      } catch (err) {
        console.error('Chart-Archivierung fehlgeschlagen:', err);
      }
      setShowBackup(true);
    }

    setEntries((prev) => {
      const idx = prev.findIndex((e) => e.id === savedEntry.id);
      if (idx === -1) return [...prev, savedEntry];
      const copy = [...prev];
      copy[idx] = savedEntry;
      return copy;
    });
  }

  if (!loaded) {
    return (
      <div className="app-shell">
        <div className="screen empty-state">Lädt…</div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="eyebrow">NFP · Sensiplan</div>
        <h1 style={{ fontSize: '1.4rem' }}>Zykluskalender</h1>
      </header>

      <div className="screen">
        {tab === 'entry' && (
          <EntryForm
            entries={entries}
            date={selectedDate}
            onDateChange={setSelectedDate}
            onSaved={handleEntrySaved}
          />
        )}
        {tab === 'calendar' && (
          <CycleCalendar
            cycle={currentCycle}
            entries={entries}
            onSelectDay={(iso) => {
              setSelectedDate(iso);
              setTab('entry');
            }}
          />
        )}
        {tab === 'dashboard' && <Dashboard cycles={cycles} />}
        {tab === 'archive' && <ArchivedCharts />}
      </div>

      <Nav active={tab} onChange={setTab} />

      {showBackup && <BackupModal onClose={() => setShowBackup(false)} />}

      {/* Verstecktes Chart für den aktuellen (bzw. gerade endenden) Zyklus,
          dient ausschließlich als Quelle für die SVG-Archivierung. */}
      <div
        ref={hiddenChartRef}
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: 480,
          height: 240,
          opacity: 0,
          pointerEvents: 'none',
          zIndex: -1,
        }}
      >
        <CycleChart cycle={currentCycle} />
      </div>
    </div>
  );
}
