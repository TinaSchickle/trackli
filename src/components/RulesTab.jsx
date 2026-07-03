// Rulebook (Sektion 4 der drei NFP-Module) als nachlesbare Referenz.

function RuleTable({ rules }) {
  return (
    <dl className="rule-list">
      {rules.map(([term, detail]) => (
        <div key={term} className="rule-item">
          <dt>{term}</dt>
          <dd>{detail}</dd>
        </div>
      ))}
    </dl>
  );
}

const TEMP_RULES = [
  ['Start', 'Beginn des Zyklus (1. Tag der Menstruation) – ab hier täglich messen.'],
  ['Ende', 'Sobald die Temperaturauswertung abgeschlossen ist (Abend des 3. höheren Tages bzw. per Ausnahmeregel Tag 4).'],
  ['Messort', 'Oral (unter der Zunge), rektal oder vaginal – rektal am genauesten. Innerhalb eines Zyklus immer gleicher Ort; das Thermometer nicht während der 3-Minuten-Messung herausnehmen.'],
  ['Wann', 'Direkt nach dem Aufwachen, vor dem Aufstehen im Bett (Aufstehen verfälscht).'],
  ['Ruhe davor', 'Idealerweise ≥ 6 h Schlaf/Ruhe vor der Messung.'],
  ['Dauer', 'Genau 3 Minuten messen (Ovy-Thermometer oder Stoppuhr); der Piepton allein ist oft zu früh.'],
  ['Thermometer', '2 Nachkommastellen Pflicht (0,01 °C bzw. analog mit 0,05er-Skala); Modell sonst egal.'],
  ['Störfaktoren', 'Feiern/Alkohol, wenig oder zu viel Schlaf, Umgebungs-/Zeitzonenwechsel (Reisen), Stress, spätabends intensiver Sport, Krankheit/Fieber, Verletzungen, Medikamente, Supplements, Cortison → als Störung markierbar.'],
];

const MUCUS_RULES = [
  ['Start', 'Nach Ende der Menstruation (während der Blutung nicht beurteilbar).'],
  ['Ende', 'Sobald die Höhepunkt-Auswertung abgeschlossen ist – d.h. am Abend von S+ +3 Tage.'],
  ['Wo', 'Scheideneingang (mit Finger oder Toilettenpapier); wenn unsicher auch innen / am Muttermund.'],
  ['Wann', 'Beim Toilettengang vor dem Pinkeln. Anfangs mehrmals täglich – am Abend die beste gemessene Qualität des Tages eintragen. Mit Übung genügt 1× nach dem Aufstehen.'],
  ['Empfinden zählt mit', 'Auch ohne sichtbaren Schleim ist das Gefühl (trocken / feucht / nass) eine eigene Info.'],
  ['Störfaktoren', 'Alles, was in die Sekretbildung eingreift, kann das Schleimbild verfälschen → als Störung markieren: Sperma, Gleitgel, Infektionen; Medikamente, die auf Schleimhäute/Drüsen wirken – z.B. Schleimlöser (Husten), Augentropfen, Nasenspray (verengt Gefäße → Drüsen arbeiten weniger).'],
  ['Erregung', 'Erregungsschleim nicht mit Zervixschleim verwechseln (verschwindet schnell).'],
];

const CERVIX_RULES = [
  ['Start', 'Nach Ende der Menstruation (kein Blut mehr). Während der Blutung nicht tasten (Infektionsrisiko, nicht beurteilbar).'],
  ['Ende', 'Sobald die Muttermund-Auswertung abgeschlossen ist – der Muttermund ist an 3 Tagen in Folge wieder hart, geschlossen und tief. Dann bis zur nächsten Menstruation unfruchtbar.'],
  ['Wo', 'In der Scheide bis zum „Ende“/zur „Wand“ tasten: das ertastbare Grübchen am Ende ist der Muttermund (unterster Teil des Gebärmutterhalses, ca. 2–3 cm langes Endstück der Gebärmutter, das in die Scheide ragt).'],
  ['Womit', 'Sauberer (gewaschener) Zeige- oder Mittelfinger – am besten der Mittelfinger, weil länger und dadurch weiter reichend. Kurze Nägel, saubere Hände.'],
  ['Wann', '1× täglich, möglichst zur gleichen Tageszeit und in gleicher Körperhaltung. Nicht direkt nach dem Aufwachen im Liegen als Erstversuch – erst mit Übung.'],
  ['Blase leeren', 'Vorher Wasser lassen (nach dem Pinkeln tasten). Eine volle Blase liegt anatomisch dicht an und kann Position/Erreichbarkeit verändern.'],
  ['Körperhaltung', 'Egal, aber immer gleich wählen: auf der Toilette sitzend, ein Bein erhöht (z.B. Badewannenrand) oder liegend. Konstanz macht die Tageswerte vergleichbar.'],
  ['Wenn nicht erreichbar', 'Ist die Scheide „zu lang“ / der Muttermund zu hoch: mit der anderen Hand knapp unter dem Bauchnabel die Gebärmutter sanft nach unten drücken, dann wird der Muttermund tiefer und tastbar.'],
  ['Tasthilfe Konsistenz', 'Hart/derb = wie die Nasenspitze/Nasenknorpel · weich = wie Ohrläppchen oder Unterlippe.'],
  ['Warum (Zweck)', 'Sinnvoll als Backup, wenn die Zervixschleim-Beobachtung Probleme macht – z.B. medikamentös bedingt (Schleimlöser, Nasenspray, Antihistaminika), bei dauerhaftem Feuchtigkeitsgefühl, Infektneigung, oder wenn der Schleim schwer zu deuten ist. Der Muttermund ersetzt dann den Schleim in der Auswertung.'],
  ['Übung nötig', 'Der Tastbefund ist anfangs schwer einzuordnen. Erst nach mehreren Zyklen (ca. 2–3) verlässlich. Wichtig ist der Verlauf im eigenen Zyklus, nicht ein Absolutwert.'],
  ['Störfaktoren', 'Blutung (nicht tasten), sexuelle Erregung (verändert Konsistenz/Position kurzfristig), Infektionen/Entzündungen des Muttermunds, Zysten/Polypen, kurz nach Geburt oder bei Stillzeit, Beckenboden-/Senkungsbefunde. Bei anhaltenden Auffälligkeiten (Schmerz, Blutung außerhalb der Regel, tastbare Knoten) → ärztlich abklären, nicht selbst deuten.'],
];

export default function RulesTab() {
  return (
    <div className="text-tab">
      <div className="card">
        <p style={{ marginTop: 0 }}>
          NFP wertet <strong>symptothermal</strong> aus: Zervixschleim{' '}
          <strong>+</strong> Basaltemperatur (doppelte Kontrolle). Der Muttermund ist
          ein optionales Zusatz- bzw. Ersatzzeichen für den Schleim – nie für die
          Temperatur.
        </p>
      </div>

      <details className="card rule-module" open>
        <summary><h3>🌡️ Basaltemperatur</h3></summary>
        <RuleTable rules={TEMP_RULES} />
      </details>

      <details className="card rule-module">
        <summary><h3>💧 Zervixschleim</h3></summary>
        <RuleTable rules={MUCUS_RULES} />
      </details>

      <details className="card rule-module">
        <summary><h3>👆 Muttermund</h3></summary>
        <RuleTable rules={CERVIX_RULES} />
      </details>
    </div>
  );
}
