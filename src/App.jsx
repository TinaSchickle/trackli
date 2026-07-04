import { useEffect, useMemo, useState } from 'react';
import { getAllEntries } from './db.js';
import { segmentIntoCycles } from './utils/cycles.js';
import { todayIso } from './utils/dates.js';
import EntryForm from './components/EntryForm.jsx';
import CycleCalendar from './components/CycleCalendar.jsx';
import Dashboard from './components/Dashboard.jsx';
import StatusTab from './components/StatusTab.jsx';
import EvaluationTab from './components/EvaluationTab.jsx';
import RulesTab from './components/RulesTab.jsx';
import AppRulesTab from './components/AppRulesTab.jsx';
import BackupModal from './components/BackupModal.jsx';
import OvulationModal from './components/OvulationModal.jsx';
import Nav, { TABS } from './components/Nav.jsx';
import { formatDateDe } from './utils/nfp.js';

const TAB_LABELS = Object.fromEntries(TABS.map((t) => [t.key, t.label]));

export default function App() {
  const [entries, setEntries] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState('entry');
  const [selectedDate, setSelectedDate] = useState(todayIso());
  const [showBackup, setShowBackup] = useState(false);
  const [ovDismissed, setOvDismissed] = useState(null);
  const [pendingPeriodStart, setPendingPeriodStart] = useState(false);
  const [guideSign, setGuideSign] = useState(null);

  // Deep-Link aus dem Eintrag-Tab zur passenden „So geht's“-Anleitung.
  function openGuide(sign) {
    setGuideSign(sign);
    setTab('rules');
  }

  useEffect(() => {
    getAllEntries().then((data) => {
      setEntries(data);
      setLoaded(true);
    });
  }, []);

  const cycles = useMemo(() => segmentIntoCycles(entries), [entries]);
  const currentCycle = cycles.find((c) => c.isCurrent);

  // Eisprung-Popup: sobald die doppelte Kontrolle des aktuellen Zyklus erfüllt
  // ist und der Nutzer im Eintrag-Tab ist (einmalig pro Zyklus, bis verworfen).
  const showOvModal =
    tab === 'entry' &&
    !!currentCycle?.evaluation?.complete &&
    ovDismissed !== currentCycle.id;

  // "Zykluskalender abschließen": Popup schließen und den fertigen Zyklus im
  // Kalender anzeigen. Ein neuer Zyklus entsteht erst beim nächsten Periodenbeginn.
  function finishCycleFromModal() {
    setOvDismissed(currentCycle.id);
    setTab('calendar');
  }

  async function handleEntrySaved(savedEntry) {
    const isNewPeriodStart =
      savedEntry.isPeriodStart && !entries.some((e) => e.id === savedEntry.id);

    // Beim Start eines neuen Zyklus an die Datensicherung erinnern.
    if (isNewPeriodStart && currentCycle && currentCycle.entries.length > 0) {
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
        <h1 style={{ fontSize: '1.4rem' }}>Zykluskalender · {TAB_LABELS[tab]}</h1>
      </header>

      <div className="screen">
        {tab === 'entry' && (
          <EntryForm
            entries={entries}
            cycles={cycles}
            date={selectedDate}
            onDateChange={setSelectedDate}
            onSaved={handleEntrySaved}
            pendingPeriodStart={pendingPeriodStart}
            onPendingConsumed={() => setPendingPeriodStart(false)}
            onOpenGuide={openGuide}
          />
        )}
        {tab === 'calendar' && (
          <CycleCalendar
            cycles={cycles}
            entries={entries}
            onSelectDay={(iso) => {
              setSelectedDate(iso);
              setTab('entry');
            }}
          />
        )}
        {tab === 'status' && <StatusTab cycle={currentCycle} />}
        {tab === 'evaluation' && <EvaluationTab />}
        {tab === 'rules' && <RulesTab initialSign={guideSign} />}
        {tab === 'appRules' && <AppRulesTab />}
        {tab === 'dashboard' && <Dashboard cycles={cycles} />}
      </div>

      <Nav active={tab} onChange={setTab} />

      {showBackup && <BackupModal onClose={() => setShowBackup(false)} />}

      {showOvModal && (
        <OvulationModal
          infertileFrom={formatDateDe(currentCycle.evaluation.infertileFrom)}
          method={currentCycle.evaluation.symptomMethod}
          onKeepLogging={() => setOvDismissed(currentCycle.id)}
          onFinish={finishCycleFromModal}
        />
      )}
    </div>
  );
}
