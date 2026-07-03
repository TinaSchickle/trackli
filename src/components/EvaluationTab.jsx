// Auswertung erklärt (Sektion 5 der drei NFP-Module) mit Beispielbildern,
// gerendert wie die echte Kurve, als wären Daten eingetragen.

// ── Beispiel-Temperaturkurve als SVG ─────────────────────────────────────────

/**
 * @param {number[]} values Temperaturen in °C (chronologisch, Tag 1..n)
 * @param {number} cover Hilfslinie in °C
 * @param {Object} marks { low:[dayIdx...], higher:[dayIdx...], dropped:dayIdx|null, extra:dayIdx|null }
 */
function MiniTempChart({ values, cover, marks, caption }) {
  const W = 330;
  const H = 150;
  const padL = 38;
  const padR = 8;
  const padT = 14;
  const padB = 22;
  const min = Math.min(...values, cover) - 0.08;
  const max = Math.max(...values, cover + 0.2) + 0.08;
  const x = (i) => padL + (i * (W - padL - padR)) / (values.length - 1);
  const y = (v) => padT + ((max - v) * (H - padT - padB)) / (max - min);

  const isLow = (i) => marks.low?.includes(i);
  const higherNum = (i) => {
    const idx = marks.higher?.indexOf(i);
    return idx != null && idx >= 0 ? idx + 1 : null;
  };

  return (
    <figure className="example-figure">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={caption}>
        {/* Hilfslinie */}
        <line x1={padL - 4} y1={y(cover)} x2={W - padR} y2={y(cover)} className="ex-coverline" />
        <text x={2} y={y(cover) + 3} className="ex-axis">{cover.toFixed(2).replace('.', ',')}</text>
        {/* +0,2 °C-Linie */}
        <line x1={padL - 4} y1={y(cover + 0.2)} x2={W - padR} y2={y(cover + 0.2)} className="ex-plusline" />
        <text x={2} y={y(cover + 0.2) + 3} className="ex-axis">+0,2</text>
        {/* Kurve */}
        <polyline
          points={values.map((v, i) => `${x(i)},${y(v)}`).join(' ')}
          className="ex-curve"
        />
        {values.map((v, i) => {
          const hn = higherNum(i);
          const dropped = marks.dropped === i;
          const extra = marks.extra === i;
          return (
            <g key={i}>
              <circle
                cx={x(i)}
                cy={y(v)}
                r={hn || extra ? 5 : 4}
                className={
                  dropped
                    ? 'ex-dot ex-dot-dropped'
                    : hn || extra
                      ? 'ex-dot ex-dot-higher'
                      : 'ex-dot'
                }
              />
              {isLow(i) && (
                <text x={x(i)} y={y(v) + 15} className="ex-num ex-num-low" textAnchor="middle">
                  {marks.low.indexOf(i) + 1}
                </text>
              )}
              {hn && (
                <text x={x(i)} y={y(v) - 9} className="ex-num ex-num-high" textAnchor="middle">
                  {hn}
                </text>
              )}
              {extra && (
                <text x={x(i)} y={y(v) - 9} className="ex-num ex-num-high" textAnchor="middle">
                  4
                </text>
              )}
              {dropped && (
                <text x={x(i)} y={y(v) - 9} className="ex-num ex-num-dropped" textAnchor="middle">
                  ✕
                </text>
              )}
              <text x={x(i)} y={H - 6} className="ex-axis" textAnchor="middle">
                {i + 1}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption>{caption}</figcaption>
    </figure>
  );
}

// ── Beispiel-Symbolreihe (Schleim / Muttermund) ──────────────────────────────

function MiniSymbolRow({ items, caption }) {
  return (
    <figure className="example-figure">
      <div className="example-symbolrow">
        {items.map((it, i) => (
          <div
            key={i}
            className={`example-symbol${it.peak ? ' is-peak' : ''}${it.fertile ? ' is-fertile' : ''}`}
          >
            <span className="example-symbol-value">{it.label}</span>
            <span className="example-symbol-mark">
              {it.peak ? 'H' : it.count ? it.count : ''}
            </span>
            <span className="example-symbol-day">{i + 1}</span>
          </div>
        ))}
      </div>
      <figcaption>{caption}</figcaption>
    </figure>
  );
}

const LOW6 = [36.5, 36.55, 36.5, 36.45, 36.55, 36.5];

export default function EvaluationTab() {
  return (
    <div className="text-tab">
      <div className="card">
        <h3>Temperatur: Grundregel „3 über 6“</h3>
        <p>
          Es müssen mindestens <strong>6 Tage hintereinander</strong> Werte eingetragen
          sein, bevor ausgewertet werden kann.
        </p>
        <ol>
          <li>Suche <strong>6 Tage hintereinander</strong> mit niedriger Temperatur.</li>
          <li>Ziehe die <strong>Hilfslinie</strong> auf Höhe des <strong>höchsten</strong> dieser 6 Werte.</li>
          <li>Warte auf <strong>3 Tage hintereinander</strong>, deren Werte <strong>alle über</strong> der Hilfslinie liegen.</li>
          <li>Der erste dieser höheren Tage heißt <strong>„1. höhere Messung“</strong>.</li>
          <li>Der <strong>3. höhere Tag</strong> muss <strong>mindestens 0,2 °C über</strong> der Hilfslinie liegen.</li>
          <li>Ist das am <strong>Abend des 3. Tages</strong> erfüllt → <strong>Auswertung fertig</strong>. Der Eisprung hat stattgefunden.</li>
        </ol>
        <MiniTempChart
          values={[...LOW6, 36.65, 36.75, 36.85]}
          cover={36.55}
          marks={{ low: [0, 1, 2, 3, 4, 5], higher: [6, 7, 8] }}
          caption="Grundregel: 6 tiefe Werte (1–6), Hilfslinie bei 36,55 °C, drei höhere Werte (1–3) – der 3. liegt ≥ 0,2 °C über der Linie."
        />
      </div>

      <div className="card">
        <h3>Temperatur: Ausnahme 1 – Anstieg zu langsam</h3>
        <p>
          Der 3. höhere Tag liegt zwar über der Linie, aber <strong>nicht</strong> 0,2 °C
          drüber → einfach <strong>1 Tag länger</strong> messen. Dieser 4. Tag muss nur
          <strong> irgendwie über</strong> der Linie liegen. Dann fertig (Abend von Tag 4).
        </p>
        <MiniTempChart
          values={[...LOW6, 36.65, 36.7, 36.7, 36.65]}
          cover={36.55}
          marks={{ low: [0, 1, 2, 3, 4, 5], higher: [6, 7, 8], extra: 9 }}
          caption="Ausnahme 1: Der 3. höhere Wert (36,70) erreicht die +0,2-Linie nicht – der 4. Tag liegt über der Hilfslinie und schließt die Auswertung ab."
        />
      </div>

      <div className="card">
        <h3>Temperatur: Ausnahme 2 – ein Tag rutscht ab</h3>
        <p>
          Einer der höheren Tage fällt <strong>auf oder unter</strong> die Linie → dieser
          Tag <strong>zählt nicht</strong>. <strong>1 Tag länger</strong> messen; der
          Zusatztag muss <strong>≥ 0,2 °C über</strong> der Linie liegen. Dann fertig.
        </p>
        <MiniTempChart
          values={[...LOW6, 36.65, 36.5, 36.7, 36.8]}
          cover={36.55}
          marks={{ low: [0, 1, 2, 3, 4, 5], higher: [6, 8, 9], dropped: 7 }}
          caption="Ausnahme 2: Tag 8 fällt auf die Hilfslinie zurück (✕, zählt nicht) – der Zusatztag (3) liegt ≥ 0,2 °C über der Linie."
        />
        <p className="field-hint">
          <strong>Wichtig:</strong> Beide Ausnahmen dürfen <strong>nie gleichzeitig</strong>{' '}
          gelten. Passiert das, ist der Eisprung noch nicht sicher – weitermessen, bis
          eine der Regeln sauber greift (neue 6 tiefe Werte + neue Hilfslinie).
        </p>
      </div>

      <div className="card">
        <h3>Zervixschleim: Höhepunkt + 3 Tage</h3>
        <p>Qualitäts-Rangfolge: <code>t &lt; Ø &lt; f &lt; S &lt; S+</code></p>
        <ol>
          <li><strong>Höhepunkt</strong> (immer ein <strong>S+</strong>) = der letzte Tag mit der individuell besten Schleimqualität des Zyklus.</li>
          <li>Erkennbar <strong>erst rückwirkend</strong>: am Folgetag muss die Qualität schlechter sein (Umschwung).</li>
          <li>Danach <strong>3 Tage in Folge</strong> schlechtere Qualität abwarten.</li>
          <li>Wird der Schleim innerhalb dieser 3 Tage wieder besser → Auswertung verwerfen, neuer Höhepunkt möglich, von vorne zählen.</li>
          <li>Nach <strong>S+ +3 Tage</strong> (abends) gilt die schleimbasierte fruchtbare Phase als beendet – aber nur zusammen mit der Temperaturauswertung (doppelte Kontrolle).</li>
        </ol>
        <MiniSymbolRow
          items={[
            { label: 't' },
            { label: 'Ø' },
            { label: 'f' },
            { label: 'S' },
            { label: 'S+', fertile: true },
            { label: 'S+', peak: true, fertile: true },
            { label: 'S', count: 1 },
            { label: 'f', count: 2 },
            { label: 'Ø', count: 3 },
          ]}
          caption="Der letzte S+-Tag ist der Höhepunkt (H); danach 3 Tage schlechtere Qualität (1–3) – am Abend von Tag 3 ist die Schleim-Auswertung abgeschlossen."
        />
      </div>

      <div className="card">
        <h3>Muttermund: Höhepunkt + 3 Tage hart/geschlossen/tief</h3>
        <p>
          Zum Eisprung hin wird der Muttermund <strong>weich, offen und hoch</strong>{' '}
          (◯), danach abrupt wieder <strong>hart, geschlossen und tief</strong> (●). Der
          Umschwung nach dem Eisprung ist meist rascher als der langsame Anstieg davor.
        </p>
        <ol>
          <li><strong>Höhepunkt</strong> = letzter Tag mit der für den Zyklus <strong>weichsten/offensten/höchsten</strong> Ausprägung.</li>
          <li>Erkennbar <strong>erst rückwirkend</strong>: am Folgetag ist der Muttermund wieder deutlich fester, geschlossener, tiefer.</li>
          <li>Danach <strong>3 Tage in Folge</strong> hart, geschlossen und tief abwarten.</li>
          <li>Wird er innerhalb der 3 Tage wieder weicher/offener/höher → verwerfen, von vorne zählen.</li>
          <li>Am <strong>Abend des 3. Tages</strong> ist die muttermundbasierte fruchtbare Phase beendet.</li>
        </ol>
        <MiniSymbolRow
          items={[
            { label: '●' },
            { label: '●' },
            { label: '◯', fertile: true },
            { label: '◯', fertile: true },
            { label: '◯', peak: true, fertile: true },
            { label: '●', count: 1 },
            { label: '●', count: 2 },
            { label: '●', count: 3 },
          ]}
          caption="Letzter weich/offen/hoch-Tag = Höhepunkt (H); danach 3 Tage hart/geschlossen/tief (1–3)."
        />
        <p className="field-hint">
          <strong>Kein Alleingang:</strong> Die Muttermund-Regel ersetzt nur den{' '}
          <strong>Zervixschleim</strong>, nie die Temperatur. Die unfruchtbare 2.
          Zyklushälfte beginnt erst, wenn <strong>Temperatur UND (Schleim oder
          Muttermund)</strong> abgeschlossen sind. Weichen Schleim und Muttermund
          voneinander ab, gilt der <strong>konservativere</strong> (= längere)
          fruchtbare Zeitraum.
        </p>
      </div>
    </div>
  );
}
