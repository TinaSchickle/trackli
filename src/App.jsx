import { useEffect, useMemo, useRef, useState } from 'react';
import { getAllEntries, syncNow, prepareLocalDataForUser, releaseLocalData } from './db.js';
import { isCloudConfigured } from './cloud/supabase.js';
import { getUser, onAuthChange, isAdmin } from './cloud/auth.js';
import { segmentIntoCycles } from './utils/cycles.js';
import { todayIso } from './utils/dates.js';
import EntryForm from './components/EntryForm.jsx';
import CycleCalendar from './components/CycleCalendar.jsx';
import Dashboard from './components/Dashboard.jsx';
import StatusTab from './components/StatusTab.jsx';
import EvaluationTab from './components/EvaluationTab.jsx';
import RulesTab from './components/RulesTab.jsx';
import AppRulesTab from './components/AppRulesTab.jsx';
import UsersTab from './components/UsersTab.jsx';
import BackupModal from './components/BackupModal.jsx';
import AccountModal from './components/AccountModal.jsx';
import OvulationModal from './components/OvulationModal.jsx';
import Nav, { TABS, visibleTabs } from './components/Nav.jsx';
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

  // Cloud-/Konto-Zustand
  const [user, setUser] = useState(null);
  const [showAccount, setShowAccount] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState(null);
  const [syncError, setSyncError] = useState(null);
  const syncRunning = useRef(false);
  // Vorheriger Anmeldezustand, um echtes Abmelden vom „noch nie angemeldet"-
  // Start zu unterscheiden (nur beim echten Abmelden lokale Daten löschen).
  const prevUserIdRef = useRef(undefined);

  async function reloadEntries() {
    const data = await getAllEntries();
    setEntries(data);
  }

  // Vollständiger Abgleich lokal ⇄ Cloud. Läuft nie doppelt gleichzeitig.
  async function runSync() {
    if (syncRunning.current) return;
    syncRunning.current = true;
    setSyncing(true);
    setSyncError(null);
    try {
      const res = await syncNow();
      if (res.ok) {
        if (res.changedLocal) await reloadEntries();
        setLastSyncAt(res.at);
      }
    } catch (err) {
      setSyncError(err?.message || String(err));
    } finally {
      setSyncing(false);
      syncRunning.current = false;
    }
  }

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

  // Anmeldestatus verfolgen. onAuthChange feuert direkt beim Start mit der
  // aktuellen Sitzung – dort stoßen wir den ersten Abgleich an. Danach jedes
  // Mal bei An-/Abmeldung.
  useEffect(() => {
    if (!isCloudConfigured) return;
    getUser().then(setUser);
    const unsub = onAuthChange(async (u) => {
      const prevId = prevUserIdRef.current;
      prevUserIdRef.current = u?.id ?? null;
      setUser(u);
      if (u) {
        // Fremde lokale Daten (anderes Konto) vor dem Sync verwerfen; eigene
        // bzw. herrenlose Alt-Daten werden übernommen.
        await prepareLocalDataForUser(u.id);
        runSync();
      } else {
        // Nur beim echten Abmelden (vorher war jemand angemeldet) lokale Daten
        // löschen – nicht beim initialen „noch nie angemeldet"-Zustand, dessen
        // Daten bei der ersten Anmeldung noch übernommen werden sollen.
        if (prevId) {
          await releaseLocalData();
          await reloadEntries();
        }
        setLastSyncAt(null);
      }
    });
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Beim Zurückkehren zur App (anderer Tab/Gerät) erneut abgleichen, damit
  // frische Einträge von anderen Geräten ankommen.
  useEffect(() => {
    if (!isCloudConfigured) return;
    function onVisible() {
      if (document.visibilityState === 'visible') runSync();
    }
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cycles = useMemo(() => segmentIntoCycles(entries), [entries]);
  const currentCycle = cycles.find((c) => c.isCurrent);

  // Zugriffsrechte. Ist die Cloud gar nicht eingerichtet, ist keine Anmeldung
  // möglich – dann läuft alles wie bisher rein lokal mit vollem Zugriff.
  const authed = !isCloudConfigured || !!user;
  const admin = !isCloudConfigured || isAdmin(user);
  const tabs = useMemo(() => visibleTabs({ authed, admin }), [authed, admin]);
  // Der aktive Tab muss immer erlaubt sein. Wechselt der Anmeldezustand und der
  // bisherige Tab ist nicht mehr sichtbar, auf einen Standard zurückfallen.
  const activeTab = tabs.some((t) => t.key === tab) ? tab : authed ? 'entry' : 'rules';

  // Eisprung-Popup: sobald die doppelte Kontrolle des aktuellen Zyklus erfüllt
  // ist und der Nutzer im Eintrag-Tab ist (einmalig pro Zyklus, bis verworfen).
  const showOvModal =
    activeTab === 'entry' &&
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
      <header
        className="app-header"
        style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}
      >
        <div>
          <div className="eyebrow">NFP · Sensiplan</div>
          <h1 style={{ fontSize: '1.4rem' }}>Zykluskalender · {TAB_LABELS[activeTab]}</h1>
        </div>
        <button
          onClick={() => setShowAccount(true)}
          title={user ? `Angemeldet: ${user.email}` : 'Konto & Sync'}
          aria-label="Konto und Synchronisierung"
          style={{
            background: 'transparent',
            border: 'none',
            fontSize: '1.4rem',
            lineHeight: 1,
            cursor: 'pointer',
            position: 'relative',
            padding: 4,
          }}
        >
          {syncing ? '🔄' : user ? '☁️' : '👤'}
          {user && !syncing && !syncError && (
            <span
              aria-hidden="true"
              style={{
                position: 'absolute',
                right: 2,
                bottom: 2,
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#2e7d32',
              }}
            />
          )}
          {syncError && (
            <span
              aria-hidden="true"
              style={{
                position: 'absolute',
                right: 2,
                bottom: 2,
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#b3261e',
              }}
            />
          )}
        </button>
      </header>

      <div className="screen">
        {isCloudConfigured && !user && (
          <button
            type="button"
            onClick={() => setShowAccount(true)}
            className="card"
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              marginBottom: 16,
              cursor: 'pointer',
              border: '1px solid var(--color-border, #e0d7d0)',
              background: 'var(--color-surface, #fff)',
            }}
          >
            <strong>Anmelden für deinen Zyklus</strong>
            <div style={{ color: 'var(--color-text-soft)', fontSize: '0.9rem', marginTop: 4 }}>
              Melde dich an, um Eintrag, Kalender, Status und Dashboard zu sehen.
              Ohne Anmeldung sind nur „So geht's" und „Regeln" verfügbar.
            </div>
          </button>
        )}
        {activeTab === 'entry' && (
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
        {activeTab === 'calendar' && (
          <CycleCalendar
            cycles={cycles}
            entries={entries}
            onSelectDay={(iso) => {
              setSelectedDate(iso);
              setTab('entry');
            }}
          />
        )}
        {activeTab === 'status' && <StatusTab cycle={currentCycle} />}
        {activeTab === 'evaluation' && <EvaluationTab />}
        {activeTab === 'rules' && <RulesTab initialSign={guideSign} />}
        {activeTab === 'appRules' && <AppRulesTab />}
        {activeTab === 'users' && <UsersTab currentUser={user} />}
        {activeTab === 'dashboard' && <Dashboard cycles={cycles} />}
      </div>

      <Nav tabs={tabs} active={activeTab} onChange={setTab} />

      {showBackup && <BackupModal onClose={() => setShowBackup(false)} />}

      {showAccount && (
        <AccountModal
          user={user}
          syncing={syncing}
          lastSyncAt={lastSyncAt}
          syncError={syncError}
          onClose={() => setShowAccount(false)}
        />
      )}

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
