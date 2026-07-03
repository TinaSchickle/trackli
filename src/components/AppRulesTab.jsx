// App-Regeln (Sektion 6 der drei NFP-Module) als nachlesbare Referenz.
// Das beschriebene Verhalten ist in der App implementiert (Feld-Steuerung,
// Rundung, Hilfslinie, Auswertung) – hier steht, wie die App rechnet.

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

export default function AppRulesTab() {
  return (
    <div className="text-tab">
      <details className="card rule-module" open>
        <summary><h3>🌡️ Temperatur – Rechenlogik</h3></summary>

        <h4>Runden</h4>
        <p>
          Zweite Nachkommastelle auf <strong>0,05er-Schritte</strong> runden
          (36,22 → 36,20 · 36,23 → 36,25 · 36,58 → 36,60), nicht auf ganze Grad. Die
          App speichert intern 2 Nachkommastellen und rundet nur für Kurve und
          Auswertung.
        </p>

        <h4>Hilfslinie (täglich neu berechnet)</h4>
        <RuleTable
          rules={[
            ['1. höhere Messung', 'Der erste Wert, der höher ist als die 6 unmittelbar davor liegenden Werte.'],
            ['Linie', 'Auf Höhe des höchsten dieser 6 Werte, waagerecht über die betroffenen Tage.'],
            ['Keine gültige 1. höhere Messung', 'Keine Linie zeichnen.'],
            ['Täglich neu prüfen', 'Verschiebt sich die 1. höhere Messung (z.B. weil ein Wert wieder abfällt), verschiebt sich auch die Hilfslinie – immer die aktuell gültige 6er-Gruppe verwenden.'],
            ['Lücken', 'Lücken, ausgeklammerte und übersprungene Tage zählen nicht mit – beim Zählen der 6 tiefen (und der 3 höheren) Werte überspringen, als wären sie nicht vorhanden.'],
          ]}
        />

        <h4>Auswertungsregeln</h4>
        <RuleTable
          rules={[
            ['Grundregel', '3 Werte in Folge über der Hilfslinie und der 3. Wert ≥ 0,2 °C über der Linie → am Abend von Tag 3 abgeschlossen.'],
            ['Ausnahmeregel 1 (langsamer Anstieg)', '3. Wert liegt über der Linie, aber nicht 0,2 °C drüber → 4. Tag abwarten; der 4. Wert muss nur über der Linie liegen → am Abend von Tag 4 abgeschlossen.'],
            ['Ausnahmeregel 2 (Ausreißer nach unten)', 'Einer der höheren Werte fällt auf oder unter die Linie → dieser Wert zählt nicht, 1 Tag zusätzlich abwarten; der Zusatzwert muss ≥ 0,2 °C über der Linie liegen → dann abgeschlossen.'],
            ['Verbot', 'Ausnahmeregel 1 und 2 niemals kombinieren. Trifft beides zu → Auswertung verschiebt sich nach hinten: neue 6 tiefe Werte + neue Hilfslinie suchen.'],
            ['Kein Anstieg', 'Bleibt der Anstieg im Zyklus ganz aus → Hinweis: vermutlich kein Eisprung.'],
          ]}
        />

        <h4>Ausklammern (Klammern)</h4>
        <RuleTable
          rules={[
            ['Nur nach oben', 'Nur Werte ausklammern, die nach oben aus dem Niveau ragen (tiefe Ausreißer sind egal).'],
            ['Nur Tieflage', 'Nur Werte der 1. Zyklushälfte ausklammern.'],
            ['Bedingung', 'Wert muss aus dem Tieflagenniveau herausragen und durch einen bekannten Störfaktor erklärbar sein (beides).'],
            ['Wirkung', 'Ausgeklammerter Tag wird komplett übersprungen (wie eine Lücke), auch beim Zählen – im Kalender ausgegraut.'],
          ]}
        />

        <h4>Feld-Steuerung</h4>
        <RuleTable
          rules={[
            ['Temperaturfeld deaktivieren', 'Nach abgeschlossener Auswertung wird das Temperaturfeld für alle Folgetage automatisch deaktiviert (bis die Auswertung durch Ändern früherer Werte zurückgenommen wird), mit Hinweis: „Temperaturmessung für diesen Zyklus abgeschlossen – Eisprung hat stattgefunden.“'],
            ['Messort fixieren', 'Nach der ersten Messung im Zyklus ist der Messort für den Rest des Zyklus festgesetzt (Wechsel nur mit Warnhinweis).'],
            ['Zyklusstart', 'Mit neuem Zyklus (Beginn Menstruation) werden Deaktivierung und Messort-Fixierung aufgehoben.'],
          ]}
        />
      </details>

      <details className="card rule-module">
        <summary><h3>💧 Zervixschleim – Feld-Steuerung</h3></summary>
        <RuleTable
          rules={[
            ['Feld deaktivieren', 'Ist die Auswertungsregel erfüllt (Höhepunkt S+ +3 Tage in Folge schlechter), wird das Zervixschleim-Feld für alle Folgetage nach diesem Datum automatisch deaktiviert.'],
            ['Gültigkeit', 'Die Deaktivierung bleibt bestehen, bis die Auswertung manuell geändert oder zurückgesetzt wird.'],
            ['Bei Rücknahme', 'Ändert sich die Auswertung (z.B. Höhepunkt verworfen), wird das Feld für die betroffenen Tage wieder aktiviert.'],
            ['Zyklusstart', 'Mit neuem Zyklus (Beginn der Menstruation) wird die Deaktivierung aufgehoben und die Eingabe neu freigegeben.'],
          ]}
        />
      </details>

      <details className="card rule-module">
        <summary><h3>👆 Muttermund – App-Verhalten</h3></summary>
        <RuleTable
          rules={[
            ['Drei getrennte Werte', 'Konsistenz, Öffnung und Position werden einzeln gespeichert und dargestellt; die Gesamtbewertung „fruchtbar/unfruchtbar“ wird daraus abgeleitet (weich und/oder offen und/oder hoch → fruchtbar; hart und geschlossen und tief → unfruchtbar).'],
            ['Individuelle Skala', 'Die Auswertung erfolgt relativ zum eigenen Zyklusverlauf, nicht gegen feste Absolutwerte. Die ersten 2–3 Zyklen sind Lern-/Kalibrierphase – die Muttermund-Auswertung sollte dann noch nicht zur Verhütung herangezogen werden.'],
            ['Nur als Ersatz für Schleim', 'Die Muttermund-Auswertung darf nur den Zervixschleim ersetzen, nie die Temperatur. Nie Muttermund + Temperatur allein als doppelte Kontrolle werten, wenn Schleim ebenfalls vorliegt – dann gilt der konservativere Wert.'],
            ['Feld deaktivieren', 'Ist die Auswertungsregel erfüllt (Höhepunkt +3 Tage hart/geschlossen/tief in Folge), wird das Muttermund-Feld für alle Folgetage automatisch deaktiviert, mit Hinweis: „Muttermund-Auswertung für diesen Zyklus abgeschlossen“.'],
            ['Gültigkeit / Rücknahme', 'Die Deaktivierung bleibt, bis die Auswertung geändert/zurückgesetzt wird; dann wird das Feld für die betroffenen Tage wieder aktiviert.'],
            ['Übersprungene / gestörte Tage', 'Als „übersprungen“ oder „Störung“ markierte Tage werden bei der Auswertung übersprungen – wie Lücken (analog Temperatur- und Schleim-Modul).'],
            ['Zyklusstart', 'Mit neuem Zyklus werden Deaktivierung und Auswertung zurückgesetzt und die Eingabe nach Ende der Blutung neu freigegeben.'],
          ]}
        />
      </details>

      <details className="card rule-module">
        <summary><h3>📅 Darstellung im Kalender</h3></summary>
        <RuleTable
          rules={[
            ['Hilfslinie', 'Waagerechte Linie auf Höhe des höchsten der 6 tiefen Werte, quer über die betroffenen Tage.'],
            ['6 tiefe Werte', 'Nummeriert (1–6) als Basis der Hilfslinie.'],
            ['1. höhere Messung', 'Deutlich hervorgehobener Tag (Markierung/Farbe).'],
            ['3 höhere Werte', 'Nummeriert (1–3), erkennbar oberhalb der Hilfslinie.'],
            ['0,2 °C-Abstand', 'Feinere zweite Linie 0,2 °C über der Hilfslinie an den entscheidenden Tagen.'],
            ['Ausnahmeregel aktiv', 'Der 4. Tag ist als Zusatztag gekennzeichnet, wenn Ausnahme 1 oder 2 gegriffen hat.'],
            ['Höhepunkt (Schleim/Muttermund)', 'Deutlich markierter Tag (H); die drei Bestätigungstage sind nummeriert (1–3).'],
            ['Ausgeklammert / Lücke / übersprungen', 'Ausgegraut bzw. farblich abgesetzt – klar als „zählt nicht“ erkennbar.'],
            ['Update', 'Bei jeder neuen Eingabe wird die Darstellung täglich neu berechnet und gezeichnet.'],
          ]}
        />
      </details>
    </div>
  );
}
