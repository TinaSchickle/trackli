import { useMemo } from 'react';
import { getCoupleNames } from '../cloud/auth.js';
import { findCycleForDate, fertilityForecast, formatDateDe } from '../utils/nfp.js';
import { todayIso } from '../utils/dates.js';
import { PHASE_MOOD, FERTILITY_TEXT } from '../fuerIhn/phases.js';

// Kachel „Für Ihn“: oben ein kleiner Slot mit ihrer aktuellen Zyklusphase –
// Stimmungsbild und Fruchtbarkeit in wenigen Sätzen, aus denselben Einträgen
// wie der Zykluskalender.
export default function ForHim({ user, cycles, onHome }) {
  const { her } = getCoupleNames(user);
  const today = todayIso();
  const cycle = useMemo(() => findCycleForDate(cycles, today), [cycles, today]);
  const forecast = useMemo(
    () => (cycle ? fertilityForecast(cycle, cycles, today) : null),
    [cycle, cycles, today]
  );

  return (
    <div className="screen">
      <button type="button" className="fd-back" onClick={onHome}>← Übersicht</button>
      <div className="app-header" style={{ padding: '4px 0 12px' }}>
        <div className="eyebrow">Damit du weißt, wie es ihr gerade geht</div>
        <h1 style={{ fontSize: '1.4rem' }}>Für Ihn</h1>
      </div>

      <section className="card fh-phase" aria-live="polite">
        {forecast ? (
          <>
            <div className="fh-phase-head">
              <span className="fh-phase-title">
                {her ? genitive(her) : 'Ihre'} Zyklusphase
              </span>
              <span className="fh-phase-day">Tag {forecast.cycleDay}</span>
            </div>
            <div className={`cib-fertility fh-badges ${forecast.phase}`}>
              <span className="fh-phase-name">{forecast.cyclePhase.name}</span>
              <span className="cib-badge">{forecast.phaseLabel}</span>
            </div>
            <p className="fh-text">{PHASE_MOOD[forecast.cyclePhase.key]}</p>
            <p className="fh-text">
              {FERTILITY_TEXT[forecast.phase]}
              {forecast.nextStart && (
                <> Nächste Periode erwartet um den {formatDateDe(forecast.nextStart.date)}.</>
              )}
            </p>
            {forecast.phase === 'infertile' && (
              <p className="cib-disclaimer">
                * Mit hoher Wahrscheinlichkeit bei korrekter Durchführung der
                Messungen – Softwarefehler vorbehalten, keine Haftung.
              </p>
            )}
          </>
        ) : (
          <p className="fh-text fh-empty">
            Noch kein Zyklus erfasst – sobald im Zykluskalender ein Periodenbeginn
            eingetragen ist, steht hier ihre aktuelle Phase.
          </p>
        )}
      </section>
    </div>
  );
}

// „Annas“, aber „Lukas'“ / „Beatrix'“.
function genitive(name) {
  return /[sßxz]$/i.test(name) ? `${name}'` : `${name}s`;
}
