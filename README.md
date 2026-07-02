# Zykluskalender – NFP-Zyklustracking (Sensiplan)

## Setup

```bash
npm install
npm run dev
```

Öffnet unter `http://localhost:5173`.

## Deploy auf GitHub Pages

1. Repo auf GitHub anlegen, diesen Code pushen (Branch `main`).
2. In den Repo-**Settings → Pages**: Source auf **GitHub Actions** stellen.
3. Der mitgelieferte Workflow (`.github/workflows/deploy.yml`) baut und deployed
   automatisch bei jedem Push auf `main`.
4. Danach ist die App unter `https://<user>.github.io/<repo>/` erreichbar –
   dort auf dem Handy öffnen und über „Zum Startbildschirm hinzufügen"
   installieren (PWA).

## Architektur

- **React + Vite**, Charts mit **Recharts**
- Daten liegen ausschließlich lokal in **IndexedDB** (kein Server, kein Login)
- Zyklen werden **nicht** separat gespeichert, sondern aus den Einträgen +
  `isPeriodStart`-Flag zur Laufzeit segmentiert (`src/utils/cycles.js`)
- Ovulationsschätzung: 3-über-6-Regel + Schleim-Höhepunkt (`src/utils/ovulation.js`)
- Zyklus-Chart-Archivierung: bei neuem Periodenbeginn wird das SVG des
  gerade beendeten Zyklus-Charts serialisiert und in IndexedDB abgelegt
  (`src/utils/chartExport.js`)
- Backup: JSON-Export-Aufforderung erscheint als Modal nach jedem
  Periodenbeginn-Eintrag

## ⚠️ Offene Punkte / bewusste Vereinfachungen

1. **Ovulationsberechnung ist eine Annäherung.** Die 3-über-6-Regel ist
   implementiert, aber Ausnahmefälle (Ausreißer, Krankheit, Störungen laut
   Sensiplan-Regelwerk) sind **nicht** abgebildet. Vor Vertrauen in die
   Berechnung: gegen echte, bereits von Hand ausgewertete Zyklen testen.
2. **Icons sind ein einfacher Platzhalter-Mark** (generiert), keine finale
   Bildmarke.
3. **Mehrsprachigkeit/Validierung der Temperatur-Eingabe** (34–42 °C) ist nur
   grob als HTML-`min`/`max` gesetzt, keine weitergehende Plausibilitätsprüfung.

## Nächste sinnvolle Schritte

- Repo auf GitHub pushen, Pages-Deploy testen
- Auf echtem Gerät als PWA installieren und Formular-Flow prüfen
