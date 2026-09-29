// Spaß-Dates: alle Memory-Karten stehen hier im Code.
//
// Jede Karte hat genau die Infos, die das Quiz abfragt:
//   location  'indoor' | 'outdoor' | 'both'   (both = drinnen UND draußen)
//   duration  30 | 60 | null                  (Minuten, null = unbegrenzt)
//   food      'warm' | 'snacks' | 'none'
// Dazu Inhalt für die Date-Seite:
//   materials  Liste, was ihr braucht
//   steps      [{ text, soon? }]  – soon: true = Platzhalter „kommt bald“
//   media      [{ type: 'image' | 'video', src, caption? }] (optional)
//   cover      Bild für die aufgedeckte Karte (optional, sonst Platzhalter)

export const LOCATION_OPTIONS = [
  { value: 'indoor', label: 'Indoor', icon: '🏠' },
  { value: 'outdoor', label: 'Outdoor', icon: '🌳' },
  { value: 'both', label: 'Beides', icon: '🏡' },
];

export const DURATION_OPTIONS = [
  { value: 30, label: '30 min', icon: '⏱️', short: '30′' },
  { value: 60, label: '1 Stunde', icon: '⏱️', short: '1h' },
  { value: null, label: 'Unbegrenzt', icon: '⏱️', short: '∞' },
];

export const FOOD_OPTIONS = [
  { value: 'warm', label: 'Warmes Essen', icon: '🍝' },
  { value: 'snacks', label: 'Snacks', icon: '🍿' },
  { value: 'none', label: 'Ohne Essen', icon: '🚫' },
];

export function optionFor(options, value) {
  return options.find((o) => o.value === value);
}

// Passt eine Karte zu den Quiz-Antworten? Innerhalb einer Frage reicht eine
// der gewählten Antworten, über die Fragen hinweg muss alles passen. Bei der
// Dauer zählen auch kürzere Dates (wer 1 Stunde hat, schafft auch 30 min);
// unbegrenzte Dates passen nur, wenn „Unbegrenzt“ gewählt ist.
export function matchesFilters(card, { locations, durations, foods }) {
  if (!locations.includes(card.location)) return false;
  if (!foods.includes(card.food)) return false;
  if (durations.includes(null)) return true;
  const maxMinutes = Math.max(...durations);
  return card.duration != null && card.duration <= maxMinutes;
}

export const CARDS = [
  {
    id: 'bolognese-schlacht',
    title: 'Die Spaghetti-Bolognese-Schlacht',
    location: 'indoor',
    duration: null,
    food: 'warm',
    intro: 'Blind kochen, gefesselt helfen – und dann essen wie die Kinder.',
    materials: [
      'Spaghetti',
      'Tomatensoße',
      'Hackfleisch',
      'Zwiebeln',
      'Zwei Tücher (Augenbinde + Hände zusammenbinden)',
      'Unbeschichtetes Backpapier für den Tisch',
      'Handy/Box für die Kinder-Playlist',
    ],
    steps: [
      { text: 'Geht gemeinsam einkaufen. Ihr braucht Spaghetti, Tomatensoße, Hackfleisch und Zwiebeln.' },
      { text: 'Alles parat legen.' },
      { text: 'Einem werden die Augen verbunden, dem anderen die Hände.' },
      { text: 'Dem mit den verbundenen Augen werden Anweisungen gegeben – gemeinsam kocht ihr so das Essen.' },
      { text: 'Essen fertig kochen. Augenbinde ab und Hände wieder frei.' },
      { text: 'Den Tisch mit unbeschichtetem Backpapier auslegen.' },
      // TODO: Link zur Kinder-Playlist kommt noch von Tina.
      { text: 'Kinder-Playlist anmachen.', note: 'Link folgt' },
      { text: 'Lasst eure inneren Kinder raus: Esst mit den Händen, nur mit dem Mund, esst gemeinsam – und trefft euch mit einem Kuss in der Mitte.' },
      // TODO: Timer, der nach x Minuten verschiedene kleine Aufträge einblendet.
      { text: 'Advanced: Timer mit kleinen Aufträgen zwischendurch.', soon: true },
    ],
  },

  // ── Beispiel-Dates (Platzhalter, dürfen ersetzt/gelöscht werden) ──────────
  {
    id: 'picknick',
    title: 'Überraschungs-Picknick',
    location: 'outdoor',
    duration: null,
    food: 'snacks',
    intro: 'Jeder packt heimlich drei Dinge in den Korb.',
    materials: ['Decke', 'Picknickkorb', 'Je drei geheime Snacks'],
    steps: [
      { text: 'Jeder kauft heimlich drei Snacks, die der andere mag – oder noch nie probiert hat.' },
      { text: 'Sucht euch ein schönes Plätzchen draußen.' },
      { text: 'Packt abwechselnd aus und lasst den anderen blind raten.' },
    ],
  },
  {
    id: 'sternegucken',
    title: 'Sterne gucken',
    location: 'outdoor',
    duration: 60,
    food: 'snacks',
    intro: 'Decke, Tee, Himmel – und eigene Sternbilder erfinden.',
    materials: ['Warme Decke', 'Thermoskanne Tee oder Kakao', 'Kleine Snacks'],
    steps: [
      { text: 'Sucht euch einen dunklen Ort ohne viel Licht.' },
      { text: 'Legt euch hin und lasst die Augen 10 Minuten an die Dunkelheit gewöhnen.' },
      { text: 'Erfindet abwechselnd eigene Sternbilder – samt Geschichte dazu.' },
    ],
  },
  {
    id: 'massage-abend',
    title: 'Massage-Abend',
    location: 'indoor',
    duration: 60,
    food: 'none',
    intro: 'Zweimal 25 Minuten nur für den anderen.',
    materials: ['Massageöl', 'Handtücher', 'Ruhige Playlist', 'Kerzen'],
    steps: [
      { text: 'Raum warm machen, Kerzen an, Playlist starten.' },
      { text: 'Einer massiert 25 Minuten, dann wird getauscht.' },
      { text: 'Sagt, was sich gut anfühlt – und was noch besser wäre.' },
    ],
  },
  {
    id: 'blind-tasting',
    title: 'Blind-Tasting',
    location: 'indoor',
    duration: 30,
    food: 'snacks',
    intro: 'Schokolade, Chips oder Obst – wer schmeckt mehr raus?',
    materials: ['Augenbinde', '5–6 verschiedene Snacks', 'Zettel + Stift für Punkte'],
    steps: [
      { text: 'Jeder stellt heimlich eine Auswahl für den anderen zusammen.' },
      { text: 'Augen verbinden und probieren lassen.' },
      { text: 'Wer mehr richtig errät, darf sich etwas wünschen.' },
    ],
  },
  {
    id: 'fragen-spaziergang',
    title: 'Fragen-Spaziergang',
    location: 'outdoor',
    duration: 60,
    food: 'none',
    intro: 'Eine Runde laufen und Fragen stellen, die ihr euch noch nie gestellt habt.',
    materials: ['Bequeme Schuhe', 'Eine Liste mit Fragen (z. B. „36 Fragen zum Verlieben“)'],
    steps: [
      { text: 'Sucht euch eine Runde von etwa einer Stunde.' },
      { text: 'Stellt euch abwechselnd eine Frage – ohne Handy nebenher.' },
    ],
  },
  {
    id: 'pizza-wettbacken',
    title: 'Pizza-Wettbacken',
    location: 'indoor',
    duration: null,
    food: 'warm',
    intro: 'Jeder belegt eine Pizza für den anderen.',
    materials: ['Pizzateig', 'Tomatensoße', 'Käse', 'Beläge nach Wahl'],
    steps: [
      { text: 'Teig vorbereiten und in zwei Hälften teilen.' },
      { text: 'Jeder belegt eine Pizza für den anderen – ohne dass der zuschaut.' },
      { text: 'Gemeinsam backen, tauschen, bewerten.' },
    ],
  },
  {
    id: 'schnitzeljagd',
    title: 'Schnitzeljagd',
    location: 'both',
    duration: null,
    food: 'none',
    intro: 'Hinweise drinnen und draußen – am Ende wartet eine Überraschung.',
    materials: ['Zettel + Stift', 'Kleine Überraschung als Ziel'],
    steps: [
      { text: 'Einer versteckt 5–8 Hinweise drinnen und draußen.' },
      { text: 'Der andere folgt den Hinweisen bis zur Überraschung.' },
      { text: 'Nächstes Mal wird getauscht.' },
    ],
  },
  {
    id: 'kuechen-disco',
    title: 'Küchen-Disco',
    location: 'indoor',
    duration: 30,
    food: 'none',
    intro: 'Licht aus, Musik laut, jeder wählt abwechselnd einen Song.',
    materials: ['Musikbox', 'Bunte Lampe oder Handy-Taschenlampe'],
    steps: [
      { text: 'Licht dimmen, Musik laut.' },
      { text: 'Abwechselnd wählt jeder einen Song – der andere muss mittanzen.' },
    ],
  },
];
