import { useEffect, useMemo, useRef } from 'react';
import { parseIso, toIso, todayIso, addDays } from '../utils/dates.js';

const WEEKDAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']; // Index = Date.getDay()

const MUCUS_SYMBOLS = {
  'Nichts spürbar/sichtbar': 'Ø',
  'Feucht': 'f',
  'Cremig': 'S',
  'Spinnbar/glasig (Höhepunkt)': 'S+',
  'Wässrig': 'W',
};

const CERVIX_SYMBOLS = {
  'Geschlossen/fest': 'g',
  'Leicht geöffnet/mittel': 'm',
  'Offen/weich': 'o',
};

const MAX_DAY = 40;
// Temperaturskala in Hundertstel °C, damit keine Float-Rundungsfehler entstehen.
const TEMP_STEP = 5; // 0,05 °C pro Zeile
const TEMP_MIN = 3600; // 36,0 °C
const TEMP_BASE_MAX = 3700; // 37,0 °C – wird bei höheren Messwerten erweitert

export default function CycleCalendar({ cycle, entries, onSelectDay }) {
  const scrollRef = useRef(null);

  const entryByDate = useMemo(() => {
    const map = new Map();
    entries.forEach((e) => map.set(e.date, e));
    return map;
  }, [entries]);

  const today = todayIso();

  // Tag 1 = Zyklusbeginn (Periodenbeginn), Tag 0 = Vortag, bis Tag 40.
  const days = useMemo(() => {
    if (!cycle) return [];
    const start = parseIso(cycle.startDate);
    const list = [];
    for (let i = 0; i <= MAX_DAY; i++) {
      const date = addDays(start, i - 1);
      const iso = toIso(date);
      list.push({ dayNum: i, iso, date, entry: entryByDate.get(iso) });
    }
    return list;
  }, [cycle, entryByDate]);

  const tempRows = useMemo(() => {
    let top = TEMP_BASE_MAX;
    days.forEach(({ entry }) => {
      if (typeof entry?.temperature === 'number') {
        const cents = Math.round(entry.temperature * 100);
        if (cents > top) top = Math.ceil(cents / TEMP_STEP) * TEMP_STEP;
      }
    });
    const rows = [];
    for (let v = top; v >= TEMP_MIN; v -= TEMP_STEP) rows.push(v);
    return rows;
  }, [days]);

  const topTemp = tempRows.length ? tempRows[0] : TEMP_BASE_MAX;

  // Heutige Spalte beim Öffnen in die Mitte scrollen.
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const cell = container.querySelector('td.is-today-col');
    if (cell) {
      container.scrollLeft =
        cell.offsetLeft + cell.offsetWidth / 2 - container.clientWidth / 2;
    }
  }, [cycle]);

  if (!cycle) {
    return (
      <div
        className="card empty-state"
        style={{ cursor: 'pointer' }}
        onClick={() => onSelectDay?.(today)}
      >
        Noch kein aktueller Zyklus erfasst.
        <br />
        Tippe hier, um den ersten Eintrag anzulegen.
      </div>
    );
  }

  function tempRowFor(entry) {
    if (typeof entry?.temperature !== 'number') return null;
    let cents = Math.round(entry.temperature / (TEMP_STEP / 100)) * TEMP_STEP;
    if (cents < TEMP_MIN) cents = TEMP_MIN;
    if (cents > topTemp) cents = topTemp;
    return cents;
  }

  // Klick irgendwo auf das Blatt: getroffene Tagesspalte öffnen, sonst heute.
  function handleClick(e) {
    const cell = e.target.closest('[data-iso]');
    onSelectDay?.(cell?.dataset.iso ?? today);
  }

  function colClass(day, extra = '') {
    const classes = [extra];
    if (day.iso === today) classes.push('is-today-col');
    return classes.filter(Boolean).join(' ');
  }

  return (
    <div className="card sheet-card">
      <h3 style={{ fontSize: '1rem' }}>Zyklus ab {cycle.startDate.split('-').reverse().join('.')}</h3>
      <div className="sheet-scroll" ref={scrollRef} onClick={handleClick}>
        <table className="cycle-sheet">
          <tbody>
            <tr>
              <th className="sheet-label">Tag</th>
              {days.map((d) => (
                <td key={d.iso} data-iso={d.iso} className={colClass(d, 'sheet-daynum')}>
                  {d.dayNum}
                </td>
              ))}
            </tr>
            <tr>
              <th className="sheet-label">Datum</th>
              {days.map((d) => (
                <td
                  key={d.iso}
                  data-iso={d.iso}
                  className={colClass(d, d.entry?.isPeriodStart ? 'is-period-day' : '')}
                >
                  {d.date.getDate()}
                </td>
              ))}
            </tr>
            <tr>
              <th className="sheet-label">Wochentag</th>
              {days.map((d) => (
                <td key={d.iso} data-iso={d.iso} className={colClass(d)}>
                  {WEEKDAYS[d.date.getDay()]}
                </td>
              ))}
            </tr>
            <tr>
              <th className="sheet-label">Zervixschleim</th>
              {days.map((d) => (
                <td key={d.iso} data-iso={d.iso} className={colClass(d)} title={d.entry?.cervicalMucus ?? ''}>
                  {MUCUS_SYMBOLS[d.entry?.cervicalMucus] ?? ''}
                </td>
              ))}
            </tr>
            <tr>
              <th className="sheet-label">Muttermund</th>
              {days.map((d) => (
                <td key={d.iso} data-iso={d.iso} className={colClass(d)} title={d.entry?.cervix ?? ''}>
                  {CERVIX_SYMBOLS[d.entry?.cervix] ?? ''}
                </td>
              ))}
            </tr>
            {tempRows.map((v) => (
              <tr key={v} className="sheet-temp-row">
                <th className={`sheet-label sheet-temp-label${v % 10 === 0 ? ' is-major' : ''}`}>
                  {(v / 100).toFixed(2).replace('.', ',')}
                </th>
                {days.map((d) => (
                  <td
                    key={d.iso}
                    data-iso={d.iso}
                    className={colClass(d, v % 10 === 0 ? 'is-major' : '')}
                  >
                    {tempRowFor(d.entry) === v && <span className="temp-dot" />}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="sheet-legend">
        Zervixschleim: Ø nichts · f feucht · S cremig · S+ spinnbar/glasig · W wässrig
        &nbsp;—&nbsp; Muttermund: g geschlossen · m mittel · o offen
      </div>
    </div>
  );
}
