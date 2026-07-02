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
  const [saved, setSaved] = useState(false);

  // Beim Datumswechsel die Werte des gewählten Tages laden (oder leeres Formular).
  useEffect(() => {
    setForm(entryByDate.get(activeDate) ?? emptyEntry(activeDate));
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
        <label htmlFor="temperature">Temperatur (°C)</label>
        <input
          id="temperature"
          type="number"
          step="0.01"
          min="34"
          max="42"
          placeholder="z. B. 36.45"
          value={form.temperature}
          onChange={(e) => update('temperature', e.target.value)}
        />
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
