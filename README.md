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

## Cloud-Sync einrichten (mehrere Geräte)

Standardmäßig läuft Trackli rein lokal. Mit einem kostenlosen **Supabase**-Projekt
(EU-Region) können die Daten stattdessen zwischen mehreren Geräten synchronisiert
werden – Anmeldung per E-Mail + Passwort. Ohne die folgenden Schritte bleibt alles
lokal wie bisher.

1. **Supabase-Projekt anlegen** auf [supabase.com](https://supabase.com) – als
   Region **Frankfurt (EU Central)** wählen.
2. **Schema anlegen:** im Dashboard unter *SQL Editor* den Inhalt von
   [`supabase-setup.sql`](./supabase-setup.sql) einfügen und ausführen.
3. **E-Mail-Bestätigung (optional abschalten):** *Authentication → Providers →
   Email* → „Confirm email" ausschalten, wenn du dich ohne Bestätigungslink
   direkt anmelden willst (bei einem privaten Ein-Personen-Konto praktisch).
4. **Zugangsdaten holen:** *Project Settings → API* → `Project URL` und den
   **Publishable key** kopieren (früher „anon public"-Key genannt – nicht den
   „Secret key" nehmen, der gehört niemals in die App).
5. **Lokal (Dev):** `.env.example` nach `.env.local` kopieren und die beiden
   Werte eintragen (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).
6. **GitHub Pages (Prod):** im Repo unter *Settings → Secrets and variables →
   Actions* zwei Secrets anlegen: `VITE_SUPABASE_URL` und `VITE_SUPABASE_ANON_KEY`.
   Der Deploy-Workflow reicht sie beim Build ein. Danach einmal neu deployen.
7. **Wachhalter:** Der Workflow [`keepalive.yml`](./.github/workflows/keepalive.yml)
   tippt die Datenbank alle 3 Tage an, damit das Gratis-Projekt nach 7 Tagen
   Inaktivität nicht pausiert. Nutzt dieselben Secrets, läuft automatisch.

In der App öffnet das **👤-Symbol oben rechts** die Anmeldung. Beim ersten Login
werden die bereits lokal vorhandenen Einträge in die Cloud übernommen; danach
gleicht die App bei Start, Login und Rückkehr zur App automatisch ab (Regel:
neueste Änderung pro Tag gewinnt). Offline eingegebene Werte werden beim nächsten
Online-Abgleich nachgezogen.

## Architektur

- **React + Vite**, Charts mit **Recharts**
- Daten liegen lokal in **IndexedDB**; optional zusätzlich in **Supabase**
  (Postgres) für Sync über mehrere Geräte – siehe „Cloud-Sync einrichten".
  Die Sync-/Auth-Schicht liegt in `src/cloud/`, der Abgleich in `src/db.js`
  (`syncNow`).
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
