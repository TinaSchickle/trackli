# Wenn der Name „Trackli" geändert wird

Checkliste für alle Schritte, die beim Umbenennen des Projekts/Repos nötig oder
sinnvoll sind. „Trackli" ist der **Projekt-/Repo-Name**. Der für Nutzer
**sichtbare** App-Name ist dagegen „Zykluskalender" (siehe Abschnitt 3).

Reihenfolge: Erst 1 und 2 (funktional wichtig), dann optional 3–5.

---

## 1. Supabase – Redirect-URLs anpassen  ⚠️ wichtig

Sonst funktioniert der „Passwort vergessen"-Link nicht mehr (er zeigt noch auf
die alte Adresse).

- Supabase Dashboard → **Authentication → URL Configuration → „Redirect URLs"**
  → die neue GitHub-Pages-URL hinzufügen
  (z. B. `https://tinaschickle.github.io/<neuer-name>/`).
- Im selben Bereich auch die **„Site URL"** auf die neue Adresse setzen.
- Für lokale Tests darf `http://localhost:5173/` in der Liste bleiben.
- Die alte URL kann drin bleiben (schadet nicht) oder entfernt werden.

## 2. GitHub-Repo umbenennen  ⚠️ wichtig

- GitHub → Repo **Settings → General → Repository name** → neuen Namen setzen.
  GitHub richtet automatisch eine Weiterleitung vom alten Namen ein.
- Die GitHub-Pages-URL ändert sich dadurch auf
  `https://tinaschickle.github.io/<neuer-name>/`.
- Lokales Git-Remote aktualisieren:
  ```bash
  git remote set-url origin https://github.com/tinaschickle/<neuer-name>.git
  ```
- **Nicht** nötig: `vite.config.js` (nutzt `base: './'`, also unabhängig vom
  Repo-Namen) und der Deploy-Workflow (erkennt das Repo automatisch).

## 3. (Optional) Sichtbaren App-Namen ändern

Nur nötig, wenn auch das ändern soll, was Nutzer sehen (Browser-Tab, PWA-Name
auf dem Homescreen). Aktuell heißt die App überall „Zykluskalender".

- `index.html` → `<title>…</title>`
- `public/manifest.json` → Felder `name` und `short_name`
- ggf. `index.html` → `<meta name="description">` und `public/manifest.json`
  → `description`

## 4. (Optional) Interne „trackli"-Erwähnungen im Code

Rein kosmetisch – die App läuft auch ohne diese Änderungen weiter.

- `vite.config.js` → `cacheDir: '…/trackli-vite-cache'` (nur ein lokaler
  Build-Cache-Ordnername).
- `src/db.js` → `LOCAL_OWNER_KEY = 'trackli:localDataOwner'`.
  **Besser nicht ändern:** Der Schlüssel merkt sich, welchem Konto die lokalen
  Daten gehören. Wird er umbenannt, gilt er beim nächsten Start als „leer" – die
  vorhandenen lokalen Daten werden dann einfach dem nächsten anmeldenden Konto
  zugeordnet. Kein Datenverlust, aber ohne Not nichts gewonnen.

## 5. (Optional) Doku aktualisieren

- `README.md`
- `.env.example`
- `supabase-setup.sql` (Kommentar-Kopf in Zeile 1)
- diese Datei

---

### Nicht betroffen (zur Sicherheit geprüft)

- `package.json` → `name` ist bereits `nfp-zyklustracking`, nicht „trackli".
- Deploy-Workflow (`.github/workflows/deploy.yml`) – enthält keinen Repo-Namen.
- Supabase-Tabellen/Policies – hängen nicht am Projektnamen.
