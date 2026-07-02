import { useMemo, useState } from 'react';
import EntryForm from './EntryForm.jsx';

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const MONTH_NAMES = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

function parseIso(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function toIso(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDate(iso) {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

function buildMonthGrid(year, month) {
  const firstDay = new Date(year, month, 1);
  const startWeekday = (firstDay.getDay() + 6) % 7; // Montag = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

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

export default function CycleCalendar({ cycle, entries, onSaved }) {
  const [selectedDate, setSelectedDate] = useState(null);

  const entryByDate = useMemo(() => {
    const map = new Map();
    entries.forEach((e) => map.set(e.date, e));
    return map;
  }, [entries]);

  const todayIso = toIso(new Date());

  const months = useMemo(() => {
    if (!cycle) return [];
    const start = parseIso(cycle.startDate);
    const lastEntryIso = cycle.entries.length
      ? cycle.entries[cycle.entries.length - 1].date
      : cycle.startDate;
    const endIso = lastEntryIso > todayIso ? lastEntryIso : todayIso;
    const end = parseIso(endIso);

    const list = [];
    let y = start.getFullYear();
    let m = start.getMonth();
    while (y < end.getFullYear() || (y === end.getFullYear() && m <= end.getMonth())) {
      list.push({ year: y, month: m });
      m++;
      if (m > 11) { m = 0; y++; }
    }
    return list;
  }, [cycle, todayIso]);

  if (!cycle) {
    return <div className="card empty-state">Noch kein aktueller Zyklus erfasst.</div>;
  }

  return (
    <div>
      {months.map(({ year, month }) => (
        <div className="card" key={`${year}-${month}`}>
          <h3 style={{ fontSize: '1rem' }}>{MONTH_NAMES[month]} {year}</h3>
          <div className="calendar-weekdays">
            {WEEKDAYS.map((w) => (
              <div key={w} className="calendar-weekday">{w}</div>
            ))}
          </div>
          <div className="calendar-grid">
            {buildMonthGrid(year, month).map((date, i) => {
              if (!date) return <div key={i} className="calendar-day empty" />;
              const iso = toIso(date);
              const entry = entryByDate.get(iso);
              const inCycle =
                iso >= cycle.startDate && iso <= (cycle.endDate ?? todayIso);
              const classes = ['calendar-day'];
              if (entry) classes.push('has-entry');
              if (entry?.isPeriodStart) classes.push('is-period');
              if (iso === todayIso) classes.push('is-today');
              if (!inCycle) classes.push('out-of-cycle');

              return (
                <button
                  key={iso}
                  type="button"
                  className={classes.join(' ')}
                  onClick={() => setSelectedDate(iso)}
                >
                  <span className="calendar-day-num">{date.getDate()}</span>
                  {typeof entry?.temperature === 'number' && (
                    <span className="calendar-day-temp">
                      {entry.temperature.toFixed(2)}
                    </span>
                  )}
                  {entry && <span className="calendar-day-dot" />}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {selectedDate && (
        <div className="modal-backdrop" onClick={() => setSelectedDate(null)}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <h3>{formatDate(selectedDate)}</h3>
            <EntryForm
              existingEntry={entryByDate.get(selectedDate) ?? emptyEntry(selectedDate)}
              onSaved={(saved) => {
                onSaved?.(saved);
                setSelectedDate(null);
              }}
            />
            <button
              type="button"
              className="btn-secondary"
              style={{ width: '100%', marginTop: 10 }}
              onClick={() => setSelectedDate(null)}
            >
              Schließen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
