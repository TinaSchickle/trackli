import { useState, useEffect } from 'react';
import { putEntry } from '../db.js';

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

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function EntryForm({ existingEntry, onSaved }) {
  const [form, setForm] = useState(
    existingEntry ?? {
      id: crypto.randomUUID(),
      date: todayIso(),
      temperature: '',
      cervicalMucus: '',
      cervix: '',
      ferning: '',
      notes: '',
      isPeriodStart: false,
    }
  );
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (existingEntry) setForm(existingEntry);
  }, [existingEntry]);

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
        <label htmlFor="date">Datum</label>
        <input
          id="date"
          type="date"
          required
          value={form.date}
          onChange={(e) => update('date', e.target.value)}
        />
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
