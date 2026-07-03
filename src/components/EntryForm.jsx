import { useState, useEffect, useMemo } from 'react';
import { putEntry } from '../db.js';
import { shiftIso, todayIso, parseIso } from '../utils/dates.js';
import {
  MUCUS,
  MUCUS_CODES,
  CERVIX_STATES,
  TEMP_SITES,
  findCycleForDate,
  fixedTempSite,
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
    tempSite: null,
    tempExcluded: false,
    cervicalMucus: null,
    mucusExcluded: false,
    cervixState: null,
    cervixExcluded: false,
    ferning: '',
    notes: '',
    isPeriodStart: false,
    // Zyklus-Auswertungs-Flags (nur auf dem Starteintrag relevant):
    trackTemp: true,
    trackMucus: true,
    trackCervix: false,
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

export default function EntryForm({
  entries = [],
  cycles = [],
  date,
  onDateChange,
  onSaved,
  pendingPeriodStart = false,
  onPendingConsumed,
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
  useEffect(() => {
    const loaded = entryByDate.get(activeDate) ?? emptyEntry(activeDate);
    setForm(loaded);
    setTempParts(splitTemp(loaded.temperature));
    setSaved(false);
    // entryByDate absichtlich nicht als Dependency: lokale, noch ungespeicherte
    // Änderungen sollen beim Speichern anderer Einträge nicht verworfen werden.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDate]);

  // Zyklus-Kontext des gewählten Datums für Feld-Steuerung & Messort-Fixierung.
  const cycle = useMemo(() => findCycleForDate(cycles, activeDate), [cycles, activeDate]);
  const evaluation = cycle?.evaluation ?? null;
  const cycleDay = cycle
    ? Math.round((parseIso(activeDate) - parseIso(cycle.startDate)) / 86400000) + 1
    : null;

  const tempLocked =
    evaluation?.temperature.status === 'completed' &&
    activeDate > evaluation.temperature.completedDate;
  const mucusLocked =
    evaluation?.mucus.status === 'completed' &&
    activeDate > evaluation.mucus.completedDate;
  const cervixLocked =
    evaluation?.cervix.status === 'completed' &&
    activeDate > evaluation.cervix.completedDate;

  const fixedSite = cycle ? fixedTempSite(cycle.entries, activeDate) : null;
  const effectiveSite = form.tempSite ?? fixedSite;

  // Zyklus-Auswertungs-Flags: liegen auf dem Starteintrag. Am Starttag selbst
  // aus dem Formular lesen (noch nicht gespeicherte Änderung), sonst aus dem Eintrag.
  const isStartDay = !!cycle && activeDate === cycle.startDate;
  const startEntry = cycle ? entryByDate.get(cycle.startDate) : null;
  const tracks = {
    temp: isStartDay ? form.trackTemp ?? true : startEntry?.trackTemp ?? true,
    mucus: isStartDay ? form.trackMucus ?? true : startEntry?.trackMucus ?? true,
    cervix: isStartDay ? form.trackCervix ?? false : startEntry?.trackCervix ?? false,
  };

  async function setTrack(field, value) {
    if (isStartDay || !cycle || !startEntry) {
      update(field, value);
      return;
    }
    const updated = { ...startEntry, [field]: value };
    await putEntry(updated);
    onSaved?.(updated);
  }

  // "Neuen Zyklus starten" aus dem Eisprung-Popup: Periodenbeginn vorbelegen.
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

  function changeSite(site) {
    if (
      site &&
      fixedSite &&
      site !== fixedSite &&
      !window.confirm(
        `Der Messort ist für diesen Zyklus auf „${fixedSite}“ festgelegt und sollte innerhalb eines Zyklus nicht gewechselt werden. Trotzdem ändern?`
      )
    ) {
      return;
    }
    update('tempSite', site);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const toSave = {
      ...form,
      temperature:
        form.temperature === '' || form.temperature == null
          ? null
          : Number(form.temperature),
      tempSite:
        form.temperature === '' || form.temperature == null
          ? form.tempSite
          : (form.tempSite ?? effectiveSite ?? null),
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

      <button
        type="button"
        className={`period-toggle${form.isPeriodStart ? ' active' : ''}`}
        onClick={() => update('isPeriodStart', !form.isPeriodStart)}
        aria-pressed={form.isPeriodStart}
      >
        <span className="period-toggle-icon" aria-hidden="true">🩸</span>
        <span>
          <strong>Periodenbeginn</strong>
          <small>markiert den Zyklusstart (Tag 1)</small>
        </span>
        <span className="period-toggle-state">{form.isPeriodStart ? '✓' : ''}</span>
      </button>

      {/* ── Zyklus-Auswertung: was zählt mit? ──────────── */}
      <div className="cycle-tracks">
        <div className="cycle-tracks-title">Für diesen Zyklus auswerten</div>
        <div className="track-checks">
          <label className={`track-check${tracks.temp ? ' active' : ''}`}>
            <input
              type="checkbox"
              checked={tracks.temp}
              onChange={(e) => setTrack('trackTemp', e.target.checked)}
            />
            Temperatur
          </label>
          <label className={`track-check${tracks.mucus ? ' active' : ''}`}>
            <input
              type="checkbox"
              checked={tracks.mucus}
              onChange={(e) => setTrack('trackMucus', e.target.checked)}
            />
            Zervixschleim
          </label>
          <label className={`track-check${tracks.cervix ? ' active' : ''}`}>
            <input
              type="checkbox"
              checked={tracks.cervix}
              onChange={(e) => setTrack('trackCervix', e.target.checked)}
            />
            Muttermund
          </label>
        </div>
        <p className="field-hint">
          Mindestens <strong>Temperatur + (Zervixschleim oder Muttermund)</strong> nötig.
          Gilt für den ganzen Zyklus.
        </p>
      </div>

      {/* ── Temperatur ─────────────────────────────────── */}
      <fieldset className="module-block">
        <legend>Basaltemperatur</legend>

        {tempLocked ? (
          <LockedNote>
            Temperaturmessung für diesen Zyklus abgeschlossen – der Eisprung hat
            stattgefunden (Auswertung vom {formatDateDe(evaluation.temperature.completedDate)}).
            Die Eingabe ist deaktiviert, bis du die Auswertung durch Ändern früherer
            Werte zurücknimmst.
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
              </div>
            </div>

            <div className="field">
              <label>Messort (1× pro Zyklus festlegen, dann fix)</label>
              <Segmented
                options={TEMP_SITES.map((s) => ({ value: s, label: s }))}
                value={effectiveSite}
                onChange={changeSite}
              />
              {fixedSite && (
                <p className="field-hint">
                  Für diesen Zyklus festgelegt: {fixedSite} (rektal ist am genauesten).
                </p>
              )}
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
      <fieldset className="module-block">
        <legend>Zervixschleim</legend>

        {mucusLocked ? (
          <LockedNote>
            Schleim-Auswertung für diesen Zyklus abgeschlossen (Höhepunkt +3 Tage,
            beendet am {formatDateDe(evaluation.mucus.completedDate)}). Die Eingabe ist
            deaktiviert, bis du die Auswertung durch Ändern früherer Werte zurücknimmst.
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
      <fieldset className="module-block">
        <legend>Muttermund</legend>

        {cervixLocked ? (
          <LockedNote>
            Muttermund-Auswertung für diesen Zyklus abgeschlossen (Höhepunkt +3 Tage
            hart/geschlossen/tief, beendet am {formatDateDe(evaluation.cervix.completedDate)}).
            Die Eingabe ist deaktiviert, bis du die Auswertung durch Ändern früherer
            Werte zurücknimmst.
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

      <div className="field">
        <label htmlFor="ferning">Spucke (Farnkraut-Test)</label>
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

      <div className="field">
        <label htmlFor="notes">Notizen</label>
        <textarea
          id="notes"
          value={form.notes}
          onChange={(e) => update('notes', e.target.value)}
        />
      </div>

      <button type="submit" className="btn-primary">
        {saved ? 'Gespeichert ✓' : 'Eintrag speichern'}
      </button>
    </form>
  );
}
