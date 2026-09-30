// Texte für die Kachel „Für Ihn“ – in wenigen Sätzen, wie es ihr in der
// aktuellen Zyklusphase typischerweise geht. Allgemeine Orientierung, kein
// Gedankenlesen: jede Frau (und jeder Zyklus) ist anders.

// Stimmungsbild je physiologischer Phase (Schlüssel wie in fertilityForecast).
export const PHASE_MOOD = {
  menstruation:
    'Ihre Periode läuft. Die Energie ist oft niedrig, sie kann empfindlicher oder schneller gereizt sein und braucht vor allem Ruhe, Wärme und wenig Druck. Wärmflasche, Lieblingsessen oder einfach Couch-Zeit kommen jetzt gut an.',
  follicular:
    'Die Energie steigt von Tag zu Tag, die Stimmung wird offener und neugieriger. Gute Zeit für Pläne, Ausflüge und neue Ideen – sie hat meist Lust, etwas zu unternehmen.',
  ovulation:
    'Rund um den Eisprung fühlt sie sich oft am selbstbewusstesten, ist gesprächig und hat die meiste Lust auf Nähe. Ein schöner Moment für ein Date oder ein ehrliches Kompliment.',
  luteal:
    'Nach dem Eisprung wird es ruhiger. Gegen Ende des Zyklus können Anspannung, Stimmungsschwankungen oder PMS dazukommen – Geduld, Snacks und kleine Entlastungen im Alltag helfen jetzt am meisten.',
};

// Fruchtbarkeit je Auswertungsstatus (forecast.phase).
export const FERTILITY_TEXT = {
  infertile: 'Laut Auswertung ist sie gerade unfruchtbar.*',
  fertile: 'Sie ist gerade fruchtbar – wenn ihr verhütet, jetzt schützen.',
  peak: 'Hochfruchtbar: die fruchtbarsten Tage im Zyklus. Wenn ihr verhütet, unbedingt schützen.',
  incomplete:
    'Die Auswertung ist noch nicht abgeschlossen – sicherheitshalber gilt sie noch als fruchtbar.',
};
