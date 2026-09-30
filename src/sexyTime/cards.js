// Sexy Time: alle Karten stehen hier im Code – gleicher Aufbau wie bei den
// Spaß-Dates (siehe ../funDates/cards.js), nur ohne Quiz-Filter
// (location/duration/food entfallen).
//   materials  Liste, was ihr braucht
//   steps      [{ text, soon?, note? }] (optional)
//   media      [{ type: 'image' | 'video', src, caption? }] (optional)
//   cover      Bild für die aufgedeckte Karte (optional)
//
// Die IDs teilen sich die Tabelle fun_dates_done mit den Spaß-Dates und
// müssen deshalb über beide Listen hinweg eindeutig sein.

export const SEXY_CARDS = [
  {
    id: 'sexy-brustmassagen-meditation',
    title: 'Brustmassagen-Meditation',
    materials: ['Öl (Kokosöl, Massageöl oder Olivenöl)'],
    steps: [],
  },
];
