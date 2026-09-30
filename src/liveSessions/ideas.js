// Live Sessions: Ideensammlung. Jede Idee wird als Kachel mit Titel gezeigt,
// ein Klick öffnet die Notizen dazu.
//   id     eindeutiger Schlüssel
//   title  steht auf der Kachel
//   icon   Emoji auf der Kachel (optional)
//   notes  [String] – ein Eintrag pro Absatz/Stichpunkt

export const LIVE_IDEAS = [
  {
    id: 'gebaermutter-zuhause',
    title: 'Gebärmutter-Zuhause bauen',
    icon: '🏡',
    notes: ['Format: Gruppencall'],
  },
  {
    id: 'blockadensuche',
    title: 'Blockadensuche',
    icon: '🔍',
    notes: ['Format: Einzelcall'],
  },
  {
    id: 'zyklus-verstehen',
    title: 'Zyklus verstehen',
    icon: '🌙',
    notes: ['Format: Gruppencall'],
  },
  {
    id: 'tre-session',
    title: 'TRE Session',
    icon: '🫨',
    notes: [
      'Format: Gruppencall',
      'Zittern auslösen: Beine zusammen – oder auf andere Weise auslösen?',
      'In Kombination mit Breathwork und kraftvoller Musik',
      'Dahinter eine eigene geführte Meditation',
    ],
  },
  {
    id: 'frust-breathwork',
    title: 'Frust Breathwork Session',
    icon: '🎈',
    notes: [
      'Format: Gruppencall',
      'Luftballon füllen und platzen lassen',
      'Thema: Frust, Druck, Angst, dass es wieder nicht klappt …',
      'In einen Luftballon reinatmen: Ein puddingartiger, schleimiger Strang verlässt das Gehirn und fließt in den Luftballon zwischen den Händen.',
      'Unter der Hand tut sich die Erde auf – wie beim Buddeln im Sand-/Erdkasten, es geht ganz weit runter …',
      'Der Luftballon platzt, die Dreckbrühe fließt da hinunter. Zubuddeln, Blumen drüber, ein Affirmations-Fähnchen obendrauf.',
    ],
  },
];
