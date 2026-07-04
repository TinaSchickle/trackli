import { useState, useEffect, useMemo } from 'react';
import { putEntry } from '../db.js';
import { shiftIso, todayIso, parseIso } from '../utils/dates.js';
import {
  MUCUS,
  MUCUS_CODES,
  CERVIX_STATES,
  TEMP_SITES,
  findCycleForDate,
  cycleSite,
  fertilityForecast,
  formatDateDe,
} from '../utils/nfp.js';

const FERNING_OPTIONS = [
  'Kein Farnkraut-Muster',
  'Teilweises Farnkraut-Muster',
  'Vollständiges Farnkraut-Muster',
];

const TEMP_EXCLUDE_INFO =
  'Ausklammern bei Störfaktoren, die den Messwert verfälschen: Feiern/Alkohol, zu wenig ' +
  'oder zu viel Schlaf, Zeitzonen-/Umgebungswechsel (Reisen), Stress, spätabends ' +
  'intensiver Sport, Krankheit/Fieber, Verletzungen, Medikamente, Supplements, Cortison. ' +
  'Ein eingetragener Wert bleibt erhalten, zählt aber bei der Auswertung nicht mit ' +
  '(wie eine Lücke). Auch nutzen, wenn gar nicht gemessen wurde.';

const MUCUS_EXCLUDE_INFO =
  'Ausklammern, wenn etwas in die Sekretbildung eingreift: Sperma, Gleitgel, Infektionen; ' +
  'Medikamente, die auf Schleimhäute/Drüsen wirken (z.B. Schleimlöser, Augentropfen, ' +
  'Nasenspray). Achtung: Erregungsschleim nicht mit Zervixschleim verwechseln ' +
  '(verschwindet schnell). Ausgeklammerte Tage zählen bei der Auswertung nicht mit.';

const CERVIX_EXCLUDE_INFO =
  'Ausklammern bei Blutung (nicht tasten – Infektionsrisiko), sexueller Erregung, ' +
  'Infektionen/Entzündungen, Zysten/Polypen, kurz nach Geburt/Stillzeit, ' +
  'Beckenboden-/Senkungsbefunden oder Unsicherheit. Der Tag wird ausgegraut und zählt ' +
  'bei der Auswertung nicht mit. Bei anhaltenden Auffälligkeiten (Schmerz, Blutung ' +
  'außerhalb der Regel, tastbare Knoten) ärztlich abklären.';

function emptyEntry(dateIso) {
  return {
    id: crypto.randomUUID(),
    date: dateIso,
    temperature: '',
    tempSite: 'oral', // Messart – am Periodenbeginn festgelegt, Vorgabe oral
    tempExcluded: false,
    cervicalMucus: null,
    mucusExcluded: false,
    cervixState: null,
    cervixExcluded: false,
    ferning: '',
    notes: '',
    isPeriodStart: false,
    // Zyklus-Flags werden NICHT vorbelegt: fehlt die Angabe, erbt der Zyklus die
    // Einstellung des vorigen (deaktivierte Zeichen wirken durchgängig weiter).
  };
}

// Zerlegt einen gespeicherten Temperaturwert in Vor- und Nachkommateil.
// Ohne Wert: Vorkomma-Vorgabe 36, Nachkomma leer (leer = keine Messung).
function splitTemp(temperature) {
  if (temperature === '' || temperature == null) return ['36', ''];
  const [intPart, decPart] = String(temperature).split('.');
  return [intPart, decPart ?? '0'];
}

function InfoToggle({ text }) {
  return (
    <details className="info-details">
      <summary aria-label="Info anzeigen">ⓘ</summary>
      <p>{text}</p>
    </details>
  );
}

function Segmented({ options, value, onChange, disabled }) {
  return (
    <div className={`segmented${disabled ? ' is-disabled' : ''}`}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          disabled={disabled}
          title={o.title ?? ''}
          className={value === o.value ? 'active' : ''}
          onClick={() => onChange(value === o.value ? null : o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function LockedNote({ children }) {
  return <p className="locked-note">🔒 {children}</p>;
}

// "Für diesen Zyklus deaktivieren" – blendet das Zeichen aus Auswertung & Kalender aus.
function ModuleDisable({ id, checked, onChange }) {
  return (
    <label className="module-disable" htmlFor={id}>
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      Deaktivieren (bleibt aus, bis wieder aktiviert)
    </label>
  );
}

function DisabledNote() {
  return (
    <p className="disabled-note">
      Deaktiviert – für den ganzen Zyklus ignoriert und nicht im Kalender angezeigt.
      Bleibt auch in Folgezyklen aus, bis du es wieder aktivierst.
    </p>
  );
}

export default function EntryForm({
  entries = [],
  cycles = [],
  date,
  onDateChange,
  onSaved,
  pendingPeriodStart = false,
  onPendingConsumed,
  onOpenGuide,
}) {
  const activeDate = date ?? todayIso();

  const entryByDate = useMemo(() => {
    const map = new Map();
    entries.forEach((e) => map.set(e.date, e));
    return map;
  }, [entries]);

  const [form, setForm] = useState(
    () => entryByDate.get(activeDate) ?? emptyEntry(activeDate)
  );
  const [[tempInt, tempDec], setTempParts] = useState(() =>
    splitTemp((entryByDate.get(activeDate) ?? {}).temperature)
  );
  const [saved, setSaved] = useState(false);

  // Beim Datumswechsel die Werte des gewählten Tages laden (oder leeres Formular).
  // Ist noch kein Zyklus getrackt, wird der Periodenbeginn automatisch aktiviert.
  useEffect(() => {
    const existing = entryByDate.get(activeDate);
    const loaded = existing ?? emptyEntry(activeDate);
    if (!existing && cycles.length === 0) loaded.isPeriodStart = true;
    setForm(loaded);
    setTempParts(splitTemp(loaded.temperature));
    setSaved(false);
    // entryByDate absichtlich nicht als Dependency: lokale, noch ungespeicherte
    // Änderungen sollen beim Speichern anderer Einträge nicht verworfen werden.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDate]);

  // Zyklus-Kontext des gewählten Datums.
  const cycle = useMemo(() => findCycleForDate(cycles, activeDate), [cycles, activeDate]);
  const evaluation = cycle?.evaluation ?? null;
  const cycleDay = cycle
    ? Math.round((parseIso(activeDate) - parseIso(cycle.startDate)) / 86400000) + 1
    : null;
  const forecast = useMemo(
    () => (cycle ? fertilityForecast(cycle, cycles, activeDate) : null),
    [cycle, cycles, activeDate]
  );

  const tempLocked =
    evaluation?.temperature.status === 'completed' &&
    activeDate > evaluation.temperature.completedDate;
  const mucusLocked =
    evaluation?.mucus.status === 'completed' &&
    activeDate > evaluation.mucus.completedDate;
  const cervixLocked =
    evaluation?.cervix.status === 'completed' &&
    activeDate > evaluation.cervix.completedDate;

  // Zyklus-Flags & Messart liegen auf dem Starteintrag. Am Starttag aus dem
  // Formular lesen (ungespeicherte Änderung), sonst aus dem gespeicherten Eintrag.
  const isStartDay = !!cycle && activeDate === cycle.startDate;
  const startEntry = cycle ? entryByDate.get(cycle.startDate) : null;
  // Innerhalb eines Zyklus gilt die (durchgereichte) Zyklus-Auflösung. Ohne Zyklus
  // (neuer, noch ungespeicherter Start) erbt das Formular vom letzten Zyklus.
  const inheritedTracks = cycles.length
    ? cycles[cycles.length - 1].tracks
    : { temp: true, mucus: true, cervix: true, ferning: true };
  const tracks = cycle
    ? cycle.tracks
    : {
        temp: form.trackTemp ?? inheritedTracks.temp,
        mucus: form.trackMucus ?? inheritedTracks.mucus,
        cervix: form.trackCervix ?? inheritedTracks.cervix,
        ferning: form.trackFerning ?? inheritedTracks.ferning,
      };
  const site = isStartDay ? form.tempSite ?? 'oral' : cycleSite(cycle);
  const lastPeriodStart = cycles.length ? cycles[cycles.length - 1].startDate : null;

  // Schreibt ein Zyklus-weites Feld (Flags/Messart) auf den Starteintrag – oder
  // ins Formular, wenn wir am Starttag stehen bzw. noch kein Zyklus existiert.
  async function setCycleField(field, value) {
    const stored = cycle ? entryByDate.get(cycle.startDate) : null;
    // Am Starttag (oder wenn noch kein Starteintrag gespeichert ist) im Formular
    // halten, damit die Auswahl sofort reagiert und beim Speichern erhalten bleibt.
    if (isStartDay || !stored) update(field, value);
    // Zusätzlich sofort auf dem gespeicherten Starteintrag persistieren, damit
    // Kalender und Auswertung unmittelbar reagieren (nicht erst beim Speichern).
    if (stored) {
      const updated = { ...stored, [field]: value };
      await putEntry(updated);
      onSaved?.(updated);
    }
  }

  // "Neuen Zyklus starten" aus dem Popup: Periodenbeginn vorbelegen.
  useEffect(() => {
    if (pendingPeriodStart) {
      setForm((f) => ({ ...f, isPeriodStart: true }));
      setSaved(false);
      onPendingConsumed?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingPeriodStart]);

  function setDate(iso) {
    if (onDateChange) onDateChange(iso);
    else setForm(entryByDate.get(iso) ?? emptyEntry(iso));
  }

  function handleDateKeyDown(e) {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      setDate(shiftIso(activeDate, e.key === 'ArrowLeft' ? -1 : 1));
    }
  }

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    setSaved(false);
  }

  // Nachkomma leer = keine Messung; erst mit Nachkommawert entsteht eine Temperatur.
  function changeTemp(intPart, decPart) {
    setTempParts([intPart, decPart]);
    update(
      'temperature',
      decPart === '' || intPart === '' ? '' : `${intPart}.${decPart}`
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const toSave = {
      ...form,
      temperature:
        form.temperature === '' || form.temperature == null
          ? null
          : Number(form.temperature),
      tempSite: form.tempSite ?? 'oral',
      cervicalMucus: form.cervicalMucus || null,
      cervixState: form.cervixState || null,
      ferning: form.ferning || null,
    };

    // Neuer Zyklus, während der aktuelle noch nicht abgeschlossen ist:
    // Sicherheitsabfrage – außer es liegen bereits ≥ 20 Tage seit Zyklusstart.
    if (toSave.isPeriodStart) {
      const prevCycle = cycles.find((c) => c.isCurrent);
      const wasAlreadyStart = entryByDate.get(toSave.date)?.isPeriodStart;
      const startsNewCycle = prevCycle && toSave.date > prevCycle.startDate;
      if (startsNewCycle && !wasAlreadyStart && !prevCycle.evaluation.complete) {
        const days = Math.round(
          (parseIso(toSave.date) - parseIso(prevCycle.startDate)) / 86400000
        );
        if (days < 20) {
          const ok = window.confirm(
            'Willst du wirklich einen neuen Zyklus starten? Dein aktueller Zyklus ' +
              'wird unterbrochen und abgespeichert.'
          );
          if (!ok) return;
        }
      }
    }

    await putEntry(toSave);
    setSaved(true);
    onSaved?.(toSave);
  }

  const selectedMucus = form.cervicalMucus ? MUCUS[form.cervicalMucus] : null;

  return (
    <form className="card" onSubmit={handleSubmit}>
      {/* ── Info-Box: Zyklusstatus & Prognose (nicht interaktiv) ── */}
      <div className="cycle-info-box" role="status" aria-live="polite">
        <div className="cib-title">Aktueller Zyklus</div>
        {cycle && forecast ? (
          <>
            <div className="cib-row">
              <span>Zyklusstart</span>
              <strong>{formatDateDe(cycle.startDate)} · Tag {forecast.cycleDay}</strong>
            </div>
            <div className="cib-row">
              <span>Messart</span>
              <strong>{site}</strong>
            </div>
            {forecast.nextStart && (
              <div className="cib-row">
                <span>Nächster Start (erwartet)</span>
                <strong>
                  {formatDateDe(forecast.nextStart.date)} · {forecast.nextStart.basis}
                </strong>
              </div>
            )}
            <div className={`cib-fertility ${forecast.phase}`}>
              <span className="cib-badge">
                {forecast.phaseLabel}
                {forecast.phase === 'infertile' ? '*' : ''}
              </span>
              <span className="cib-note">{forecast.phaseNote} {forecast.ovulation.text}</span>
            </div>
            {forecast.phase === 'infertile' && (
              <div className="cib-disclaimer">
                * Mit hoher Wahrscheinlichkeit bei korrekter Durchführung der Messungen –
                Softwarefehler vorbehalten, keine Haftung.
              </div>
            )}
            {forecast.cyclePhase && (
              <div className="cib-phase">
                <span className="cib-phase-name">{forecast.cyclePhase.name}</span>
                <span className="cib-phase-sym">
                  Typische Symptome: {forecast.cyclePhase.symptoms.join(' · ')}
                </span>
              </div>
            )}
          </>
        ) : (
          <div className="cib-empty">
            Noch kein Zyklus erfasst – markiere unten den Periodenbeginn (Tag 1).
          </div>
        )}
      </div>

      {/* ── Datum ─────────────────────────────────────── */}
      <div className="field">
        <label htmlFor="date">Datum (← → Tag wechseln)</label>
        <div className="date-nav">
          <button
            type="button"
            className="btn-secondary date-nav-btn"
            aria-label="Vorheriger Tag"
            onClick={() => setDate(shiftIso(activeDate, -1))}
          >
            ‹
          </button>
          <input
            id="date"
            type="date"
            required
            value={activeDate}
            onKeyDown={handleDateKeyDown}
            onChange={(e) => e.target.value && setDate(e.target.value)}
          />
          <button
            type="button"
            className="btn-secondary date-nav-btn"
            aria-label="Nächster Tag"
            onClick={() => setDate(shiftIso(activeDate, 1))}
          >
            ›
          </button>
        </div>
        {cycleDay != null && cycleDay >= 1 && (
          <p className="field-hint">Zyklustag {cycleDay}</p>
        )}
      </div>

      {/* ── Temperatur ─────────────────────────────────── */}
      <fieldset className={`module-block${tracks.temp ? '' : ' is-off'}`}>
        <legend>
          <button type="button" className="module-guide-link" onClick={() => onOpenGuide?.('temp')}>
            Basaltemperatur <span aria-hidden="true">↗</span>
          </button>
        </legend>
        <ModuleDisable id="disTemp" checked={!tracks.temp} onChange={(v) => setCycleField('trackTemp', !v)} />

        {!tracks.temp ? (
          <DisabledNote />
        ) : tempLocked ? (
          <LockedNote>
            Temperaturmessung für diesen Zyklus abgeschlossen – der Eisprung hat
            stattgefunden (Auswertung vom {formatDateDe(evaluation.temperature.completedDate)}).
          </LockedNote>
        ) : (
          <>
            <div className="field">
              <label htmlFor="tempInt">Temperatur (°C, 2 Nachkommastellen)</label>
              <div className="temp-split">
                <input
                  id="tempInt"
                  type="number"
                  min="34"
                  max="41"
                  step="1"
                  aria-label="Temperatur Vorkommastelle"
                  value={tempInt}
                  onChange={(e) => changeTemp(e.target.value, tempDec)}
                  onBlur={() => { if (tempInt === '') changeTemp('36', tempDec); }}
                />
                <span className="temp-comma" aria-hidden="true">,</span>
                <input
                  id="tempDec"
                  type="text"
                  inputMode="numeric"
                  maxLength={2}
                  placeholder="55"
                  aria-label="Temperatur Nachkommastellen"
                  value={tempDec}
                  onChange={(e) =>
                    changeTemp(tempInt, e.target.value.replace(/\D/g, '').slice(0, 2))
                  }
                />
                <span className="temp-site-hint">Messart: {site}</span>
              </div>
            </div>

            <div className="field checkbox-row">
              <input
                id="tempExcluded"
                type="checkbox"
                checked={form.tempExcluded}
                onChange={(e) => update('tempExcluded', e.target.checked)}
              />
              <label htmlFor="tempExcluded" style={{ margin: 0 }}>
                Messung ausklammern (Störung)
              </label>
              <InfoToggle text={TEMP_EXCLUDE_INFO} />
            </div>
          </>
        )}
      </fieldset>

      {/* ── Zervixschleim ──────────────────────────────── */}
      <fieldset className={`module-block${tracks.mucus ? '' : ' is-off'}`}>
        <legend>
          <button type="button" className="module-guide-link" onClick={() => onOpenGuide?.('mucus')}>
            Zervixschleim <span aria-hidden="true">↗</span>
          </button>
        </legend>
        <ModuleDisable id="disMucus" checked={!tracks.mucus} onChange={(v) => setCycleField('trackMucus', !v)} />

        {!tracks.mucus ? (
          <DisabledNote />
        ) : mucusLocked ? (
          <LockedNote>
            Schleim-Auswertung für diesen Zyklus abgeschlossen (Höhepunkt +3 Tage,
            beendet am {formatDateDe(evaluation.mucus.completedDate)}).
          </LockedNote>
        ) : (
          <>
            <div className="field">
              <Segmented
                options={MUCUS_CODES.map((c) => ({
                  value: c,
                  label: MUCUS[c].symbol,
                  title: MUCUS[c].description,
                }))}
                value={form.cervicalMucus}
                onChange={(v) => update('cervicalMucus', v)}
              />
              <p className="field-hint">
                {selectedMucus
                  ? `${selectedMucus.symbol}: ${selectedMucus.description}`
                  : 'Antippen zum Auswählen – erneut antippen für „keine Angabe“.'}
              </p>
              {cycleDay != null && cycleDay >= 1 && cycleDay <= 4 && (
                <p className="field-hint">
                  Während der Blutung (ca. Tag 1–4) ist der Schleim nicht beurteilbar –
                  Eintrag optional.
                </p>
              )}
            </div>

            <div className="field checkbox-row">
              <input
                id="mucusExcluded"
                type="checkbox"
                checked={form.mucusExcluded}
                onChange={(e) => update('mucusExcluded', e.target.checked)}
              />
              <label htmlFor="mucusExcluded" style={{ margin: 0 }}>
                Messung ausklammern (Störung)
              </label>
              <InfoToggle text={MUCUS_EXCLUDE_INFO} />
            </div>
          </>
        )}
      </fieldset>

      {/* ── Muttermund ─────────────────────────────────── */}
      <fieldset className={`module-block${tracks.cervix ? '' : ' is-off'}`}>
        <legend>
          <button type="button" className="module-guide-link" onClick={() => onOpenGuide?.('cervix')}>
            Muttermund <span aria-hidden="true">↗</span>
          </button>
        </legend>
        <ModuleDisable id="disCervix" checked={!tracks.cervix} onChange={(v) => setCycleField('trackCervix', !v)} />

        {!tracks.cervix ? (
          <DisabledNote />
        ) : cervixLocked ? (
          <LockedNote>
            Muttermund-Auswertung für diesen Zyklus abgeschlossen (Höhepunkt +3 Tage
            hart/geschlossen/tief, beendet am {formatDateDe(evaluation.cervix.completedDate)}).
          </LockedNote>
        ) : (
          <>
            {cycle?.cervixLearning && (
              <p className="field-hint learning-hint">
                Lernphase: In den ersten 2–3 Zyklen dient das Tasten dem Kennenlernen des
                eigenen Verlaufs – die Muttermund-Auswertung sollte noch nicht zur
                Verhütung herangezogen werden.
              </p>
            )}

            <div className="field">
              <label>Zustand (Konsistenz · Öffnung · Position zusammengefasst)</label>
              <Segmented
                options={Object.entries(CERVIX_STATES).map(([v, o]) => ({
                  value: v,
                  label: `${o.kuerzel} ${o.label}`,
                  title: o.label,
                }))}
                value={form.cervixState}
                onChange={(v) => update('cervixState', v)}
              />
              <p className="field-hint">
                <strong>fest / zu</strong> = hart, geschlossen, tief (wie Nasenspitze) ·
                <strong> weich / offen</strong> = weich, offen, hoch (wie Ohrläppchen). Je
                weicher/offener/höher, desto fruchtbarer.
              </p>
            </div>

            <div className="field checkbox-row">
              <input
                id="cervixExcluded"
                type="checkbox"
                checked={form.cervixExcluded}
                onChange={(e) => update('cervixExcluded', e.target.checked)}
              />
              <label htmlFor="cervixExcluded" style={{ margin: 0 }}>
                Messung ausklammern (Störung)
              </label>
              <InfoToggle text={CERVIX_EXCLUDE_INFO} />
            </div>
          </>
        )}
      </fieldset>

      {/* ── Spucke (Farnkraut-Test) ────────────────────── */}
      <fieldset className={`module-block${tracks.ferning ? '' : ' is-off'}`}>
        <legend>Spucke (Farnkraut-Test)</legend>
        <ModuleDisable id="disFerning" checked={!tracks.ferning} onChange={(v) => setCycleField('trackFerning', !v)} />

        {!tracks.ferning ? (
          <DisabledNote />
        ) : (
          <div className="field">
            <select
              id="ferning"
              value={form.ferning ?? ''}
              onChange={(e) => update('ferning', e.target.value)}
            >
              <option value="">– keine Angabe –</option>
              {FERNING_OPTIONS.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </div>
        )}
      </fieldset>

      {/* ── Notizen ────────────────────────────────────── */}
      <div className="field">
        <label htmlFor="notes">Notizen</label>
        <textarea
          id="notes"
          value={form.notes}
          onChange={(e) => update('notes', e.target.value)}
        />
      </div>

      {/* ── Periodenbeginn + Messart (ganz unten) ──────── */}
      <div className="cycle-setup">
        <button
          type="button"
          className={`period-toggle${form.isPeriodStart ? ' active' : ''}`}
          onClick={() => update('isPeriodStart', !form.isPeriodStart)}
          aria-pressed={form.isPeriodStart}
        >
          <span className="period-toggle-icon" aria-hidden="true">🩸</span>
          <span>
            <strong>Periodenbeginn</strong>
            {lastPeriodStart && (
              <small>Letzter Start: {formatDateDe(lastPeriodStart)}</small>
            )}
          </span>
          <span className="period-toggle-state">{form.isPeriodStart ? '✓' : ''}</span>
        </button>

        <div className="messart-row">
          <label>Messart – gilt für den ganzen Zyklus</label>
          <Segmented
            options={TEMP_SITES.map((s) => ({ value: s, label: s }))}
            value={site}
            onChange={(v) => setCycleField('tempSite', v || 'oral')}
          />
        </div>
      </div>

      <button type="submit" className="btn-primary">
        {saved ? 'Gespeichert ✓' : 'Eintrag speichern'}
      </button>
    </form>
  );
}
