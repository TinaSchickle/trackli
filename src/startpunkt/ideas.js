// Startpunkt: Ideensammlung. Jede Idee wird als Kachel mit Titel gezeigt,
// ein Klick öffnet die Notizen dazu.
//   id     eindeutiger Schlüssel
//   title  steht auf der Kachel
//   icon   Emoji auf der Kachel (optional)
//   notes  [String] – ein Eintrag pro Absatz/Stichpunkt

export const START_IDEAS = [
  {
    id: 'farben',
    title: 'Farben',
    icon: '🚦',
    notes: [
      '🔴 Rot = unangenehm, ist mir zu viel, überfordert mich',
      '🟠 Orange = Ich bin mir unsicher, irgendwas passt gerade nicht',
      '🟢 Grün = voll schön, ich genieße das',
    ],
  },
  {
    id: 'ausmachen',
    title: 'Ausmachen',
    icon: '📅',
    notes: [
      '1 Tag pro Woche festlegen.',
      'Könnt ihr das nicht fix machen: Setzt euch jeden Sonntagabend kurz hin und macht einen Tag für die nächste Woche fest.',
      'Sonntagabends dann entscheiden, ob Spaß oder Sexy Time, und bereits ein Date raussuchen, um evtl. Materialien besorgen zu können.',
      'TODO: vielleicht auch als kurzes Video erklären',
    ],
  },
];
