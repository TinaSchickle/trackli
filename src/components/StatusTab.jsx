import { formatCents, formatDateDe } from '../utils/nfp.js';

const STATUS_BADGE = {
  no_data: { label: 'keine Daten', cls: 'badge-idle' },
  searching: { label: 'beobachten', cls: 'badge-idle' },
  pending: { label: 'läuft', cls: 'badge-pending' },
  completed: { label: 'abgeschlossen', cls: 'badge-done' },
};

function Badge({ status }) {
  const b = STATUS_BADGE[status] ?? STATUS_BADGE.no_data;
  return <span className={`status-badge ${b.cls}`}>{b.label}</span>;
}

function ModuleCard({ title, status, children }) {
  return (
    <div className="card">
      <div className="status-card-head">
        <h3 style={{ fontSize: '1rem', margin: 0 }}>{title}</h3>
        <Badge status={status} />
      </div>
      {children}
    </div>
  );
}

function Messages({ messages }) {
  return (
    <div className="status-messages">
      {messages.map((m, i) => (
        <p key={i}>{m}</p>
      ))}
    </div>
  );
}

export default function StatusTab({ cycle }) {
  if (!cycle) {
    return (
      <div className="card empty-state">
        Noch kein aktueller Zyklus erfasst – lege im Eintrag-Tab einen
        Periodenbeginn an.
      </div>
    );
  }

  const { temperature: t, mucus, cervix, cervixLearning, tracks } = cycle.evaluation;
  const ev = cycle.evaluation;
  const cycleDay = cycle.entries.length;
  const trackLabels = [
    tracks.temp && 'Temperatur',
    tracks.mucus && 'Zervixschleim',
    tracks.cervix && 'Muttermund',
  ].filter(Boolean);

  return (
    <div>
      <div className="card">
        <h3 style={{ fontSize: '1rem' }}>
          Aktueller Zyklus · Tag {cycleDay} (Start {formatDateDe(cycle.startDate)})
        </h3>
        {ev.complete ? (
          <p className="status-result done">
            ✅ Doppelte Kontrolle erfüllt: unfruchtbare Zyklusphase seit dem Abend
            des {formatDateDe(ev.infertileFrom)} (Temperatur + {ev.symptomMethod}).
          </p>
        ) : (
          <p className="status-result open">
            ⏳ Doppelte Kontrolle noch nicht erfüllt – die fruchtbare Phase gilt als
            nicht beendet. Es müssen Temperatur <strong>und</strong> Schleim (oder
            Muttermund als Ersatz) abgeschlossen sein.
          </p>
        )}
        {ev.messages.length > 0 && <Messages messages={ev.messages} />}
        <p className="field-hint">
          Ausgewertet werden: <strong>{trackLabels.join(' + ') || '– nichts aktiviert –'}</strong>
        </p>
      </div>

      <ModuleCard title={`Basaltemperatur${tracks.temp ? '' : ' (nicht aktiviert)'}`} status={t.status}>
        {t.coverCents != null && (
          <p className="status-keyfacts">
            Hilfslinie: <strong>{formatCents(t.coverCents)} °C</strong> · höhere
            Messungen: <strong>{t.higherIdxs.length} / 3</strong>
            {t.exception1 && ' · Ausnahmeregel 1 aktiv'}
            {t.exception2 && ' · Ausnahmeregel 2 aktiv'}
          </p>
        )}
        <Messages messages={t.messages} />
      </ModuleCard>

      <ModuleCard title={`Zervixschleim${tracks.mucus ? '' : ' (nicht aktiviert)'}`} status={mucus.status}>
        {mucus.peakDate && (
          <p className="status-keyfacts">
            Höhepunkt-Kandidat: <strong>{formatDateDe(mucus.peakDate)}</strong> ·
            schlechtere Tage: <strong>{mucus.countedIdxs.length} / 3</strong>
          </p>
        )}
        <Messages messages={mucus.messages} />
      </ModuleCard>

      <ModuleCard title={`Muttermund${tracks.cervix ? '' : ' (nicht aktiviert)'}`} status={cervix.status}>
        {cervixLearning && (
          <p className="field-hint learning-hint">
            Lernphase (Zyklus 1–3): Auswertung dient nur dem Kennenlernen und wird
            nicht für die doppelte Kontrolle verwendet.
          </p>
        )}
        {cervix.peakDate && (
          <p className="status-keyfacts">
            Höhepunkt-Kandidat: <strong>{formatDateDe(cervix.peakDate)}</strong> ·
            Tage hart/geschlossen/tief: <strong>{cervix.countedIdxs.length} / 3</strong>
          </p>
        )}
        <Messages messages={cervix.messages} />
      </ModuleCard>
    </div>
  );
}
