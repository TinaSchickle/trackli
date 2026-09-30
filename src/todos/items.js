// TODOs: offene Punkte als einfache Liste.
//   id     eindeutiger Schlüssel
//   title  Text des Punkts
//   icon   Emoji davor (optional)
//   notes  [String] – Details darunter (optional)

export const TODO_ITEMS = [
  { id: 'affirmationen-aufnahme', title: 'Affirmationen Aufnahme', icon: '🎧' },
  { id: 'schoenere-memory-karten', title: 'Schönere Memory-Karten', icon: '🃏' },
  {
    id: 'komplimente-box',
    title: 'Komplimente-Box',
    icon: '💌',
    notes: [
      'Kann einfach ein Einmachglas sein',
      'Zwei verschiedene Farben Papier – oder einfach zwei Falttechniken (per Video zeigen)',
      'Einer der Easy Tasks der Daily Challenge',
    ],
  },
  {
    id: 'buddies',
    title: 'Buddies',
    icon: '🤝',
    notes: ['Auch schon bei erst 2 Klient*innen – damit die beiden sich verbinden können'],
  },
  {
    id: 'handy-hintergrund-affirmation',
    title: 'Handy-Hintergrund um Affirmation erweitern',
    icon: '📱',
    notes: [
      'Ist eine Aufgabe in Good Night',
      'Herausfinden, wie man Affirmationen am einfachsten mit auf den Bildschirm bekommt',
      'Möglichkeit 1 – Bild mit Text (iPhone + Android, am einfachsten): Lieblingsfoto in der Fotos-/Galerie-App öffnen, über „Bearbeiten“ bzw. „Markieren“ Text draufschreiben, speichern und als Hintergrund festlegen. Alternativ Vorlage in Canva (Format „Handy-Hintergrund“).',
      'Möglichkeit 2 – Trackli macht das Bild: In Good Night Affirmation auswählen/eintippen → App erzeugt ein fertiges Hintergrundbild zum Speichern. Für Klientinnen am bequemsten, wäre aber ein kleines Feature zum Bauen.',
      'Möglichkeit 3 – Android Sperrbildschirm-Text: Bei vielen Android-Handys (z. B. Samsung: Einstellungen → Sperrbildschirm → Kontaktinformationen) lässt sich ein eigener Text direkt auf dem Sperrbildschirm anzeigen – ganz ohne Bild.',
      'Möglichkeit 4 – Widget: Affirmations-App mit Sperr-/Homebildschirm-Widget (z. B. „I am“, iPhone + Android) oder bei Android ein Notiz-Widget (z. B. Google Notizen) mit der Affirmation.',
      'Möglichkeit 5 – iPhone Kurzbefehle: Automation, die täglich einen Hintergrund mit wechselnder Affirmation setzt. Schick, aber aufwendiger einzurichten – eher für Technik-Fans.',
      'Empfehlung: In der Good-Night-Aufgabe Möglichkeit 1 per kurzem Video zeigen; Möglichkeit 2 als spätere Erweiterung merken.',
    ],
  },
];
