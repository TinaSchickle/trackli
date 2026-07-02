import { useState, useEffect, useMemo } from 'react';
import { putEntry } from '../db.js';
import { shiftIso, todayIso } from '../utils/dates.js';

const MUCUS_OPTIONS = [
  'Nichts spürbar/sichtbar',
  'Feucht',
  'Cremig',
  'Spinnbar/glasig (Höhepunkt)',
  'Wässrig',
];

const CERVIX_OPTIONS = [
  'Geschlossen/fest',
  'Leicht geöffnet/mittel',
  'Offen/weich',
];

const FERNING_OPTIONS = [
  'Kein Farnkraut-Muster',
  'Teilweises Farnkraut-Muster',
  'Vollständiges Farnkraut-Muster',
];

function emptyEntry(dateIso) {
  return {
    id: crypto.randomUUID(),
    date: dateIso,
    temperature: '',
    cervicalMucus: '',
    cervix: '',
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

export default function EntryForm({ entries = [], date, onDateChange, onSaved }) {
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
      temperature: form.temperature === '' ? null : Number(form.temperature),
      cervicalMucus: form.cervicalMucus || null,
      cervix: form.cervix || null,
      ferning: form.ferning || null,
    };
    await putEntry(toSave);
    setSaved(true);
    onSaved?.(toSave);
  }

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
      </div>

      <div className="field">
        <label htmlFor="tempInt">Temperatur (°C)</label>
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
            placeholder="45"
            aria-label="Temperatur Nachkommastellen"
            value={tempDec}
            onChange={(e) =>
              changeTemp(tempInt, e.target.value.replace(/\D/g, '').slice(0, 2))
            }
          />
        </div>
      </div>

      <div className="field">
        <label htmlFor="mucus">Zervixschleim</label>
        <select
          id="mucus"
          value={form.cervicalMucus}
          onChange={(e) => update('cervicalMucus', e.target.value)}
        >
          <option value="">– keine Angabe –</option>
          {MUCUS_OPTIONS.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="cervix">Muttermund</label>
        <select
          id="cervix"
          value={form.cervix}
          onChange={(e) => update('cervix', e.target.value)}
        >
          <option value="">– keine Angabe –</option>
          {CERVIX_OPTIONS.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="ferning">Spucke (Farnkraut-Test)</label>
        <select
          id="ferning"
          value={form.ferning}
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

      <div className="field checkbox-row">
        <input
          id="periodStart"
          type="checkbox"
          checked={form.isPeriodStart}
          onChange={(e) => update('isPeriodStart', e.target.checked)}
        />
        <label htmlFor="periodStart" style={{ margin: 0 }}>
          Periodenbeginn (markiert Zyklusstart)
        </label>
      </div>

      <button type="submit" className="btn-primary">
        {saved ? 'Gespeichert ✓' : 'Eintrag speichern'}
      </button>
    </form>
  );
}
