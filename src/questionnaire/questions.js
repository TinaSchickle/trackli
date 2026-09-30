// Fragebogen – „Hier fängt alles an“. Jede Etappe ist ein Level mit eigenem
// Abzeichen. Neue Fragen einfach in `questions` ergänzen; die `id` ist der
// Schlüssel der gespeicherten Antwort und darf sich danach nicht mehr ändern.
//
// Fragetypen:
//   date   – Datumsfeld (mit „Weiter“-Knopf)
//   single – eine Antwort antippen, klappt dann sofort zu
//   multi  – mehrere Antworten ankreuzen (mit „Weiter“-Knopf)
// `label` darf eine Funktion der Namen ({ her, him }) sein.
// `comingSoon: true` = Etappe ist sichtbar, aber noch gesperrt.

export const XP_PER_QUESTION = 10;

export const SECTIONS = [
  {
    id: 'us',
    title: 'Ihr zwei',
    icon: '💞',
    badge: 'Dream-Team',
    questions: [
      { id: 'birth_her', type: 'date', icon: '🎂', label: ({ her }) => `Geburtsdatum ${her || 'Sie'}` },
      { id: 'birth_him', type: 'date', icon: '🎂', label: ({ him }) => `Geburtsdatum ${him || 'Er'}` },
      { id: 'together_since', type: 'date', icon: '💑', label: 'In einer Beziehung seit' },
      { id: 'ttc_since', type: 'date', icon: '👶', label: 'Im aktiven Kinderwunsch seit' },
    ],
  },
  {
    id: 'cycle',
    title: 'Dein Zyklus',
    icon: '🌸',
    badge: 'Zyklus-Kennerin',
    questions: [
      {
        id: 'bleeding',
        type: 'single',
        icon: '🩸',
        label: 'Wie stark ist deine Blutung?',
        options: [
          { value: 'light', label: 'Leicht', icon: '💧' },
          { value: 'medium', label: 'Mittel', icon: '💧💧' },
          { value: 'heavy', label: 'Stark', icon: '💧💧💧' },
          { value: 'very_heavy', label: 'Sehr stark', icon: '🌊' },
        ],
      },
      {
        id: 'mucus_observe',
        type: 'single',
        icon: '🔍',
        label: 'Beobachtest du deinen Zervixschleim?',
        options: [
          { value: 'daily', label: 'Ja, täglich', icon: '✅' },
          { value: 'sometimes', label: 'Manchmal', icon: '🤏' },
          { value: 'no', label: 'Nein, noch nicht', icon: '🙈' },
        ],
      },
      {
        id: 'mucus_notes',
        type: 'multi',
        icon: '💧',
        label: 'Auffälligkeiten im Zervixschleim',
        options: [
          { value: 'none', label: 'Nichts Auffälliges', icon: '👌', exclusive: true },
          { value: 'little', label: 'Kaum Schleim', icon: '🏜️' },
          { value: 'no_peak', label: 'Kein spinnbarer Schleim', icon: '🕸️' },
          { value: 'long', label: 'Sehr lange feucht', icon: '💦' },
          { value: 'color', label: 'Ungewöhnliche Farbe/Geruch', icon: '🎨' },
          { value: 'unsure', label: 'Weiß ich nicht', icon: '🤷‍♀️', exclusive: true },
        ],
      },
      {
        id: 'regularity',
        type: 'single',
        icon: '📅',
        label: 'Wie regelmäßig ist dein Zyklus?',
        options: [
          { value: 'regular', label: 'Sehr regelmäßig (± 2 Tage)', icon: '🎯' },
          { value: 'slightly', label: 'Leicht schwankend', icon: '〰️' },
          { value: 'irregular', label: 'Sehr unregelmäßig', icon: '🎢' },
          { value: 'unknown', label: 'Weiß ich nicht', icon: '🤷‍♀️' },
        ],
      },
      {
        id: 'pain',
        type: 'single',
        icon: '⚡',
        label: 'Wie stark sind deine Schmerzen rund um die Periode?',
        options: [
          { value: 'none', label: 'Keine', icon: '😌' },
          { value: 'light', label: 'Leicht', icon: '🙂' },
          { value: 'strong', label: 'Stark', icon: '😣' },
          { value: 'very_strong', label: 'Sehr stark', icon: '😖' },
        ],
      },
      {
        id: 'mood',
        type: 'single',
        icon: '🎭',
        label: 'Hast du Stimmungsschwankungen im Zyklus?',
        options: [
          { value: 'none', label: 'Kaum', icon: '☀️' },
          { value: 'light', label: 'Leicht', icon: '⛅' },
          { value: 'clear', label: 'Deutlich', icon: '🌦️' },
          { value: 'strong', label: 'Stark', icon: '⛈️' },
        ],
      },
    ],
  },
  {
    id: 'ttc',
    title: 'Kinderwunsch',
    icon: '🌱',
    badge: 'Weg-Bereiterin',
    comingSoon: true,
    questions: [
      {
        id: 'ttc_tried',
        type: 'multi',
        icon: '🧪',
        label: 'Was habt ihr schon ausprobiert?',
        // Details folgen.
        options: [],
      },
    ],
  },
];

export function questionLabel(q, names) {
  return typeof q.label === 'function' ? q.label(names) : q.label;
}

export function isAnswered(q, value) {
  if (q.type === 'multi') return Array.isArray(value) && value.length > 0;
  return value != null && value !== '';
}

export const OPEN_SECTIONS = SECTIONS.filter((s) => !s.comingSoon);
export const TOTAL_QUESTIONS = OPEN_SECTIONS.reduce((n, s) => n + s.questions.length, 0);
