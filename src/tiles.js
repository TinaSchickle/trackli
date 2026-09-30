// Kacheln der Startseite – gemeinsam genutzt von App (Dashboard) und
// Admin-Seite (Freischaltung pro Paar). Neue Bereiche kommen einfach hier
// dazu. `active: false` = ausgegraut als „Bald verfügbar“.
//
// Welche Kacheln ein Paar überhaupt sieht, steht in Supabase (tile_access);
// neue Konten bekommen nur DEFAULT_TILES.
export const HUB_TILES = [
  { key: 'questionnaire', title: 'Fragebogen', subtitle: 'Hier fängt alles an', icon: '📝', active: false },
  { key: 'start', title: 'Startpunkt', subtitle: 'Ideensammlung', icon: '🧭', active: true },
  { key: 'trackli', title: 'Trackli', subtitle: 'Zykluskalender nach Sensiplan', icon: '🌙', active: true },
  { key: 'dates', title: 'Spaß-Dates', subtitle: 'Ideen für gemeinsame Zeit', icon: '🎈', active: true },
  { key: 'sexy', title: 'Sexy Time', subtitle: 'Nur für euch zwei', icon: '🔥', active: true },
  { key: 'live', title: 'Live Sessions', subtitle: 'Ideensammlung', icon: '🎙️', active: true },
  { key: 'lifestyle', title: 'Lebensstil', subtitle: 'Kleine Rituale für jeden Tag', icon: '🌿', active: false },
  { key: 'todos', title: 'TODOs', subtitle: 'Was noch ansteht', icon: '✅', active: true },
];

export const DEFAULT_TILES = ['questionnaire'];
