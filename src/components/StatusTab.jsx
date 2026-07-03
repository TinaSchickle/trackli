import { useState } from 'react';
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

function StatusDot({ status }) {
  const b = STATUS_BADGE[status] ?? STATUS_BADGE.no_data;
  return <span className={`status-dot ${b.cls}`} aria-label={b.label} title={b.label} />;
}

function Messages({ messages }) {
  if (!messages?.length) return null;
  return (
    <div className="status-messages">
      {messages.map((m, i) => (
        <p key={i}>{m}</p>
      ))}
    </div>
  );
}

function TempDetail({ t }) {
  return (
    <>
      {t.coverCents != null && (
        <p className="status-keyfacts">
          Hilfslinie: <strong>{formatCents(t.coverCents)} °C</strong> · höhere
          Messungen: <strong>{t.higherIdxs.length} / 3</strong>
          {t.exception1 && ' · Ausnahmeregel 1 aktiv'}
          {t.exception2 && ' · Ausnahmeregel 2 aktiv'}
        </p>
      )}
      <Messages messages={t.messages} />
    </>
  );
}

function MucusDetail({ mucus }) {
  return (
    <>
      {mucus.peakDate && (
        <p className="status-keyfacts">
          Höhepunkt-Kandidat: <strong>{formatDateDe(mucus.peakDate)}</strong> ·
          schlechtere Tage: <strong>{mucus.countedIdxs.length} / 3</strong>
        </p>
      )}
      <Messages messages={mucus.messages} />
    </>
  );
}

function CervixDetail({ cervix, cervixLearning }) {
  return (
    <>
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
    </>
  );
}

export default function StatusTab({ cycle }) {
  const [active, setActive] = useState(null);

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

  // Nur aktive Zeichen erscheinen als Umschalter-Reiter.
  const signs = [
    tracks.temp && { key: 'temp', label: 'Temperatur', status: t.status },
    tracks.mucus && { key: 'mucus', label: 'Zervixschleim', status: mucus.status },
    tracks.cervix && { key: 'cervix', label: 'Muttermund', status: cervix.status },
  ].filter(Boolean);

  // Startansicht: das gerade laufende Zeichen, sonst das erste aktive.
  const preferred = signs.find((s) => s.status === 'pending')?.key ?? signs[0]?.key ?? null;
  const effectiveActive = signs.some((s) => s.key === active) ? active : preferred;
  const activeSign = signs.find((s) => s.key === effectiveActive);

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

      {signs.length > 0 && activeSign && (
        <>
          <div className="status-switch" role="tablist">
            {signs.map((s) => (
              <button
                key={s.key}
                type="button"
                role="tab"
                aria-selected={effectiveActive === s.key}
                className={`status-switch-btn${effectiveActive === s.key ? ' active' : ''}`}
                onClick={() => setActive(s.key)}
              >
                <StatusDot status={s.status} />
                {s.label}
              </button>
            ))}
          </div>

          <div className="card">
            <div className="status-card-head">
              <h3 style={{ fontSize: '1rem', margin: 0 }}>{activeSign.label}</h3>
              <Badge status={activeSign.status} />
            </div>
            {effectiveActive === 'temp' && <TempDetail t={t} />}
            {effectiveActive === 'mucus' && <MucusDetail mucus={mucus} />}
            {effectiveActive === 'cervix' && (
              <CervixDetail cervix={cervix} cervixLearning={cervixLearning} />
            )}
          </div>
        </>
      )}
    </div>
  );
}
