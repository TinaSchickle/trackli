import { useEffect, useMemo, useRef, useState } from 'react';
import { parseIso, toIso, todayIso, addDays } from '../utils/dates.js';
import {
  MUCUS,
  cervixKuerzel,
  cervixAgenda,
  cervixScore,
  CERVIX_FERTILE_SCORE,
  formatCents,
} from '../utils/nfp.js';

const WEEKDAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']; // Index = Date.getDay()

const FERNING_LEVELS = {
  'Kein Farnkraut-Muster': 0,
  'Teilweises Farnkraut-Muster': 1,
  'Vollständiges Farnkraut-Muster': 2,
};

// Bildliche Darstellung des Farnkraut-Musters (Spucke-Test):
// 0 = nur Punkte (kein Muster), 1 = halber Farnwedel, 2 = ganzer Farnwedel.
function FernIcon({ level }) {
  const stroke = 'currentColor';
  if (level === 0) {
    return (
      <svg className="fern-icon" viewBox="0 0 20 18" width="16" height="15" aria-hidden="true">
        <circle cx="6" cy="5" r="1.3" fill={stroke} />
        <circle cx="13" cy="4" r="1.3" fill={stroke} />
        <circle cx="9" cy="10" r="1.3" fill={stroke} />
        <circle cx="15" cy="12" r="1.3" fill={stroke} />
        <circle cx="5" cy="13" r="1.3" fill={stroke} />
      </svg>
    );
  }
  const branches =
    level === 1
      ? [[15, 8.5], [12, 7.5]] // nur untere Hälfte: halbes Muster
      : [[15, 8.5], [12, 7.5], [9, 6.5], [6, 5.5]];
  return (
    <svg
      className="fern-icon"
      viewBox="0 0 20 18"
      width="16"
      height="15"
      aria-hidden="true"
      fill="none"
      stroke={stroke}
      strokeWidth="1.3"
      strokeLinecap="round"
    >
      <line x1="10" y1="2" x2="10" y2="16" />
      {branches.map(([y, dx]) => (
        <g key={y}>
          <line x1="10" y1={y} x2={10 - dx + 3} y2={y - 4} />
          <line x1="10" y1={y} x2={10 + dx - 3} y2={y - 4} />
        </g>
      ))}
      {level === 1 && <circle cx="6" cy="4" r="1.1" fill={stroke} stroke="none" />}
      {level === 1 && <circle cx="14" cy="3.5" r="1.1" fill={stroke} stroke="none" />}
    </svg>
  );
}

const MAX_DAY = 40;
// Temperaturskala in Hundertstel °C, damit keine Float-Rundungsfehler entstehen.
const TEMP_STEP = 5; // 0,05 °C pro Zeile
const TEMP_MIN = 3600; // 36,0 °C
const TEMP_BASE_MAX = 3700; // 37,0 °C – wird bei höheren Messwerten erweitert

export default function CycleCalendar({ cycles = [], entries, onSelectDay }) {
  const scrollRef = useRef(null);
  const [idx, setIdx] = useState(null);

  // Standardmäßig den aktuellen (letzten) Zyklus zeigen; per Pfeilen blätterbar.
  const activeIdx = idx == null ? cycles.length - 1 : Math.min(Math.max(idx, 0), cycles.length - 1);
  const cycle = cycles[activeIdx] ?? null;

  const entryByDate = useMemo(() => {
    const map = new Map();
    entries.forEach((e) => map.set(e.date, e));
    return map;
  }, [entries]);

  const today = todayIso();
  const evaluation = cycle?.evaluation ?? null;

  // Tag 1 = Zyklusbeginn (Periodenbeginn), Tag 0 = Vortag. Abgeschlossene Zyklen
  // enden bei ihrer echten Länge (kein Übergreifen in den Folgezyklus), der
  // aktuelle Zyklus zeigt bis Tag 40.
  const days = useMemo(() => {
    if (!cycle) return [];
    const maxDay = cycle.isCurrent
      ? MAX_DAY
      : Math.min(MAX_DAY, cycle.length ?? cycle.entries.length);
    const start = parseIso(cycle.startDate);
    const list = [];
    for (let i = 0; i <= maxDay; i++) {
      const date = addDays(start, i - 1);
      const iso = toIso(date);
      list.push({ dayNum: i, iso, date, entry: entryByDate.get(iso) });
    }
    return list;
  }, [cycle, entryByDate]);

  // Auswertungs-Markierungen (Eintrags-Index → ISO-Datum des Zyklus).
  const marks = useMemo(() => {
    const m = {
      temp: new Map(), // iso -> {lowNum?, higherNum?, firstHigher?, dropped?, extraDay?}
      mucus: new Map(), // iso -> {peak?, countNum?}
      cervix: new Map(), // iso -> {peak?, countNum?}
      coverCents: null,
      coverFrom: null,
      coverTo: null,
    };
    if (!evaluation || !cycle) return m;
    const isoOf = (idx) => cycle.entries[idx]?.date;
    const t = evaluation.temperature;

    if (t.coverCents != null) {
      m.coverCents = t.coverCents;
      m.coverFrom = isoOf(t.low6[0]);
      const lastMarked =
        t.completedIdx ?? t.extraDayIdx ?? t.higherIdxs[t.higherIdxs.length - 1] ?? t.firstHigherIdx;
      m.coverTo = isoOf(lastMarked);
      t.low6.forEach((idx, i) => m.temp.set(isoOf(idx), { lowNum: i + 1 }));
      t.higherIdxs.forEach((idx, i) =>
        m.temp.set(isoOf(idx), {
          higherNum: i + 1,
          firstHigher: idx === t.firstHigherIdx,
        })
      );
      if (t.droppedIdx != null) m.temp.set(isoOf(t.droppedIdx), { dropped: true });
      if (t.extraDayIdx != null) m.temp.set(isoOf(t.extraDayIdx), { extraDay: true });
    }

    const mu = evaluation.mucus;
    if (mu.peakIdx != null) {
      m.mucus.set(isoOf(mu.peakIdx), { peak: true });
      mu.countedIdxs.forEach((idx, i) => m.mucus.set(isoOf(idx), { countNum: i + 1 }));
    }

    const ce = evaluation.cervix;
    if (ce.peakIdx != null) {
      m.cervix.set(isoOf(ce.peakIdx), { peak: true });
      ce.countedIdxs.forEach((idx, i) => m.cervix.set(isoOf(idx), { countNum: i + 1 }));
    }
    return m;
  }, [evaluation, cycle]);

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

  function inCoverRange(iso) {
    return (
      marks.coverCents != null &&
      marks.coverFrom != null &&
      marks.coverTo != null &&
      iso >= marks.coverFrom &&
      iso <= marks.coverTo
    );
  }

  // Für diesen Zyklus deaktivierte Zeichen werden im Kalender ausgeblendet.
  const tracks = cycle.tracks ?? { temp: true, mucus: true, cervix: true, ferning: true };

  const explanations = evaluation
    ? [
        ...(tracks.temp ? evaluation.temperature.messages : []),
        ...(tracks.mucus ? evaluation.mucus.messages : []),
        ...(tracks.cervix ? evaluation.cervix.messages : []),
        ...evaluation.messages,
      ]
    : [];

  return (
    <div className="card sheet-card">
      {cycles.length > 1 && (
        <div className="cycle-nav">
          <button
            type="button"
            className="btn-secondary date-nav-btn"
            aria-label="Vorheriger Zyklus"
            disabled={activeIdx === 0}
            onClick={() => setIdx(activeIdx - 1)}
          >
            ‹
          </button>
          <span className="cycle-nav-label">
            Zyklus {activeIdx + 1} / {cycles.length}
            {cycle.isCurrent ? ' · aktuell' : ''}
          </span>
          <button
            type="button"
            className="btn-secondary date-nav-btn"
            aria-label="Nächster Zyklus"
            disabled={activeIdx === cycles.length - 1}
            onClick={() => setIdx(activeIdx + 1)}
          >
            ›
          </button>
        </div>
      )}
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
            {tracks.mucus && (
            <tr>
              <th className="sheet-label">Zervixschleim</th>
              {days.map((d) => {
                const info = d.entry?.cervicalMucus ? MUCUS[d.entry.cervicalMucus] : null;
                const mark = marks.mucus.get(d.iso);
                const cls = [
                  d.entry?.mucusExcluded ? 'is-notcounted' : '',
                  mark?.peak ? 'is-peak' : '',
                ]
                  .filter(Boolean)
                  .join(' ');
                return (
                  <td
                    key={d.iso}
                    data-iso={d.iso}
                    className={colClass(d, cls)}
                    title={
                      info
                        ? `${info.agenda} – ${info.description}${d.entry?.mucusExcluded ? ' (ausgeklammert – zählt nicht)' : ''}`
                        : ''
                    }
                  >
                    {info?.symbol ?? ''}
                    {mark?.peak && <span className="mark-num mark-peak">H</span>}
                    {mark?.countNum && <span className="mark-num">{mark.countNum}</span>}
                  </td>
                );
              })}
            </tr>
            )}
            {tracks.cervix && (
            <tr>
              <th className="sheet-label">Muttermund</th>
              {days.map((d) => {
                const score = d.entry ? cervixScore(d.entry) : null;
                const mark = marks.cervix.get(d.iso);
                const excluded = d.entry?.cervixExcluded;
                const cls = [
                  excluded ? 'is-notcounted' : '',
                  !excluded && score === CERVIX_FERTILE_SCORE ? 'is-fertile' : '',
                  mark?.peak ? 'is-peak' : '',
                ]
                  .filter(Boolean)
                  .join(' ');
                return (
                  <td
                    key={d.iso}
                    data-iso={d.iso}
                    className={colClass(d, `cervix-cell ${cls}`)}
                    title={
                      d.entry
                        ? `${cervixAgenda(d.entry)}${excluded ? ' (ausgeklammert – zählt nicht)' : ''}`
                        : ''
                    }
                  >
                    {d.entry ? cervixKuerzel(d.entry) || (excluded ? '–' : '') : ''}
                    {mark?.peak && <span className="mark-num mark-peak">H</span>}
                    {mark?.countNum && <span className="mark-num">{mark.countNum}</span>}
                  </td>
                );
              })}
            </tr>
            )}
            {tracks.ferning && (
            <tr>
              <th className="sheet-label">Spucke</th>
              {days.map((d) => (
                <td key={d.iso} data-iso={d.iso} className={colClass(d)} title={d.entry?.ferning ?? ''}>
                  {d.entry?.ferning in FERNING_LEVELS && (
                    <FernIcon level={FERNING_LEVELS[d.entry.ferning]} />
                  )}
                </td>
              ))}
            </tr>
            )}
            {tracks.temp && tempRows.map((v) => (
              <tr key={v} className="sheet-temp-row">
                <th className={`sheet-label sheet-temp-label${v % 10 === 0 ? ' is-major' : ''}`}>
                  {(v / 100).toFixed(2).replace('.', ',')}
                </th>
                {days.map((d) => {
                  const mark = marks.temp.get(d.iso);
                  const notCounted = d.entry?.tempExcluded;
                  const cellCls = [
                    v % 10 === 0 ? 'is-major' : '',
                    notCounted ? 'is-notcounted' : '',
                    v === marks.coverCents && inCoverRange(d.iso) ? 'is-coverline' : '',
                    v === marks.coverCents + 20 &&
                    inCoverRange(d.iso) &&
                    marks.temp.get(d.iso)?.higherNum
                      ? 'is-plusline'
                      : '',
                  ]
                    .filter(Boolean)
                    .join(' ');
                  const hasDot = tempRowFor(d.entry) === v;
                  return (
                    <td key={d.iso} data-iso={d.iso} className={colClass(d, cellCls)}>
                      {hasDot && (
                        <span
                          className={`temp-dot${mark?.higherNum ? ' is-higher' : ''}${mark?.firstHigher ? ' is-first-higher' : ''}${mark?.dropped ? ' is-dropped' : ''}${notCounted ? ' is-muted' : ''}`}
                        />
                      )}
                      {hasDot && mark?.lowNum && <span className="mark-num mark-low">{mark.lowNum}</span>}
                      {hasDot && mark?.higherNum && <span className="mark-num mark-high">{mark.higherNum}</span>}
                      {hasDot && mark?.extraDay && <span className="mark-num mark-high">4</span>}
                      {hasDot && mark?.dropped && <span className="mark-num mark-dropped">✕</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {tracks.temp && marks.coverCents != null && (
        <div className="sheet-coverinfo">
          Hilfslinie: {formatCents(marks.coverCents)} °C · feine Linie: +0,2 °C (
          {formatCents(marks.coverCents + 20)} °C)
        </div>
      )}

      {explanations.length > 0 && (
        <div className="sheet-explanations">
          {explanations.map((msg, i) => (
            <p key={i}>ℹ️ {msg}</p>
          ))}
        </div>
      )}

      <div className="sheet-legend">
        <div>
          Zervixschleim: t trocken · Ø nichts · f feucht · S feucht &amp; cremig ·
          S+ spinnbar / glasig · H Höhepunkt · ¹²³ Tage danach
        </div>
        <div>
          Muttermund: ● fest / zu · ◐ Übergang · ◯ weich / offen (grün = fruchtbar) ·
          H Höhepunkt · ¹²³ Tage danach
        </div>
        <div>
          Temperatur: ¹⁻⁶ tiefe Werte (Basis der Hilfslinie) · ¹⁻³ höhere Werte ·
          4 = Zusatztag (Ausnahmeregel) · ✕ zählt nicht · grau = übersprungen/ausgeklammert
        </div>
        <div>
          Spucke: <FernIcon level={0} /> kein · <FernIcon level={1} /> teilweises ·{' '}
          <FernIcon level={2} /> vollständiges Farnkraut-Muster
        </div>
      </div>
    </div>
  );
}
