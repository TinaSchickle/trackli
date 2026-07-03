import { useState, useEffect, useMemo } from 'react';
import { putEntry } from '../db.js';
import { shiftIso, todayIso, parseIso } from '../utils/dates.js';
import {
  MUCUS,
  MUCUS_CODES,
  CERVIX_FIRMNESS,
  CERVIX_OPENING,
  CERVIX_POSITION,
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

const TEMP_SKIP_INFO =
  'Überspringen bei Störfaktoren, die den Messwert verfälschen: Feiern/Alkohol, ' +
  'zu wenig oder zu viel Schlaf, Zeitzonen-/Umgebungswechsel (Reisen), Stress, ' +
  'spätabends intensiver Sport, Krankheit/Fieber, Verletzungen, Medikamente, ' +
  'Supplements, Cortison.';

const TEMP_EXCLUDE_INFO =
  'Ausklammern nur, wenn der Wert nach OBEN aus dem Tieflagen-Niveau der ' +
  '1. Zyklushälfte herausragt UND durch einen bekannten Störfaktor erklärbar ist ' +
  '(beides). Der Tag wird bei der Auswertung komplett übersprungen – wie eine Lücke.';

const MUCUS_DISTURB_INFO =
  'Störung markieren, wenn etwas in die Sekretbildung eingreift: Sperma, Gleitgel, ' +
  'Infektionen; Medikamente, die auf Schleimhäute/Drüsen wirken (z.B. Schleimlöser, ' +
  'Augentropfen, Nasenspray). Achtung: Erregungsschleim nicht mit Zervixschleim ' +
  'verwechseln (verschwindet schnell). Gestörte Tage zählen bei der Auswertung nicht mit.';

const CERVIX_SKIP_INFO =
  'Überspringen bei Blutung (nicht tasten – Infektionsrisiko), Infektion, sexueller ' +
  'Erregung oder Unsicherheit. Der Tag wird im Kalender ausgegraut und zählt bei der ' +
  'Auswertung nicht mit.';

const CERVIX_DISTURB_INFO =
  'Störung markieren bei bekanntem Störfaktor: Infektionen/Entzündungen, Zysten/Polypen, ' +
  'kurz nach Geburt oder in der Stillzeit, Beckenboden-/Senkungsbefunde. Bei anhaltenden ' +
  'Auffälligkeiten (Schmerz, Blutung außerhalb der Regel, tastbare Knoten) ärztlich abklären.';

function emptyEntry(dateIso) {
  return {
    id: crypto.randomUUID(),
    date: dateIso,
    temperature: '',
    tempSite: null,
    tempSkipped: false,
    tempExcluded: false,
    cervicalMucus: null,
    mucusDisturbed: false,
    cervixFirmness: null,
    cervixOpening: null,
    cervixPosition: null,
    cervixSkipped: false,
    cervixDisturbed: false,
    ferning: '',
    notes: '',
    isPeriodStart: false,
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

export default function EntryForm({ entries = [], cycles = [], date, onDateChange, onSaved }) {
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
        form.temperature === '' || form.temperature == null || form.tempSkipped
          ? null
          : Number(form.temperature),
      tempSite:
        form.temperature === '' || form.temperature == null || form.tempSkipped
          ? form.tempSite
          : (form.tempSite ?? effectiveSite ?? null),
      cervicalMucus: form.cervicalMucus || null,
      cervixFirmness: form.cervixFirmness || null,
      cervixOpening: form.cervixOpening || null,
      cervixPosition: form.cervixPosition || null,
      ferning: form.ferning || null,
    };
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
                  disabled={form.tempSkipped}
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
                  disabled={form.tempSkipped}
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
                disabled={form.tempSkipped}
              />
              {fixedSite && (
                <p className="field-hint">
                  Für diesen Zyklus festgelegt: {fixedSite} (rektal ist am genauesten).
                </p>
              )}
            </div>

            <div className="field checkbox-row">
              <input
                id="tempSkipped"
                type="checkbox"
                checked={form.tempSkipped}
                onChange={(e) => update('tempSkipped', e.target.checked)}
              />
              <label htmlFor="tempSkipped" style={{ margin: 0 }}>
                Messung überspringen
              </label>
              <InfoToggle text={TEMP_SKIP_INFO} />
            </div>

            <div className="field checkbox-row">
              <input
                id="tempExcluded"
                type="checkbox"
                checked={form.tempExcluded}
                onChange={(e) => update('tempExcluded', e.target.checked)}
              />
              <label htmlFor="tempExcluded" style={{ margin: 0 }}>
                Wert ausklammern (Störung)
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
                id="mucusDisturbed"
                type="checkbox"
                checked={form.mucusDisturbed}
                onChange={(e) => update('mucusDisturbed', e.target.checked)}
              />
              <label htmlFor="mucusDisturbed" style={{ margin: 0 }}>
                Störung
              </label>
              <InfoToggle text={MUCUS_DISTURB_INFO} />
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
              <label>Konsistenz (hart = Nasenspitze · weich = Ohrläppchen/Unterlippe)</label>
              <Segmented
                options={Object.entries(CERVIX_FIRMNESS).map(([v, o]) => ({
                  value: v,
                  label: o.label,
                }))}
                value={form.cervixFirmness}
                onChange={(v) => update('cervixFirmness', v)}
                disabled={form.cervixSkipped}
              />
            </div>

            <div className="field">
              <label>Muttermundöffnung (äußeres Grübchen)</label>
              <Segmented
                options={Object.entries(CERVIX_OPENING).map(([v, o]) => ({
                  value: v,
                  label: o.label,
                }))}
                value={form.cervixOpening}
                onChange={(v) => update('cervixOpening', v)}
                disabled={form.cervixSkipped}
              />
            </div>

            <div className="field">
              <label>Position / Höhe (tief = nah am Scheidenausgang)</label>
              <Segmented
                options={Object.entries(CERVIX_POSITION).map(([v, o]) => ({
                  value: v,
                  label: o.label,
                }))}
                value={form.cervixPosition}
                onChange={(v) => update('cervixPosition', v)}
                disabled={form.cervixSkipped}
              />
              <p className="field-hint">
                Je weicher, offener und höher, desto fruchtbarer – je härter,
                geschlossener und tiefer, desto unfruchtbarer.
              </p>
            </div>

            <div className="field checkbox-row">
              <input
                id="cervixSkipped"
                type="checkbox"
                checked={form.cervixSkipped}
                onChange={(e) => update('cervixSkipped', e.target.checked)}
              />
              <label htmlFor="cervixSkipped" style={{ margin: 0 }}>
                Beobachtung übersprungen
              </label>
              <InfoToggle text={CERVIX_SKIP_INFO} />
            </div>

            <div className="field checkbox-row">
              <input
                id="cervixDisturbed"
                type="checkbox"
                checked={form.cervixDisturbed}
                onChange={(e) => update('cervixDisturbed', e.target.checked)}
              />
              <label htmlFor="cervixDisturbed" style={{ margin: 0 }}>
                Störung
              </label>
              <InfoToggle text={CERVIX_DISTURB_INFO} />
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
