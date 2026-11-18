# Urlaubsplaner

Eine Web-App zur Urlaubsplanung für eine oder zwei Personen – mit Brückentag-Finder, Feiertagen und Schulferien für alle 16 Bundesländer. Die App läuft komplett im Browser, lässt sich wie eine App aufs Handy installieren und funktioniert auch ohne Internet.

**Alle Daten bleiben auf dem eigenen Gerät.** Es gibt kein Konto, keinen Server, kein Tracking und keine Werbung.

---

## Was die App kann

- **Startassistent:** Plan-Name, Bundesland, Planungsjahr, eine oder zwei Personen, Urlaubsanspruch, Resturlaub, Arbeitstage (auch Teilzeit, z. B. Mo–Do), Wert für 24.12. und 31.12., besondere Tage (Geburtstage usw.). Zum Schluss schlägt der Brückentag-Finder passende Urlaubsblöcke vor.
- **Feiertage** für jedes Bundesland, berechnet per Osterformel – inklusive Buß- und Bettag, Weltkindertag, Frauentag, Reformationstag und einmaliger Feiertage. Regionale Feiertage (Mariä Himmelfahrt in Teilen Bayerns, Augsburger Friedensfest, Fronleichnam in Teilen Sachsens und Thüringens) lassen sich in den Einstellungen an- und abwählen.
- **Schulferien** aller Länder sind eingebaut und bleiben editierbar.
- **Jahreskalender** mit Farben je Person, Feiertagen, Ferien und besonderen Tagen. Urlaub per Antippen von Start- und Endtag anlegen.
- **Brückentag-Finder** und **Urlaubstipps:** die besten Gelegenheiten, sortiert nach Effizienz (freie Tage pro Urlaubstag), mit Schulferien-Check.
- **Tracker** je Person: verfügbar, verplant, beantragt, genehmigt, Tage in den Schulferien, Effizienz. Dazu Countdown und Monatsübersicht.
- **Varianten (optional):** Unter *Einstellungen → Varianten vergleichen* lassen sich Ideen vergleichen („Immer“, eigene Varianten mit freiem Namen, „Aus“). Eine Variante kann als „eigene Planung“ leer starten. Neue Pläne starten ohne Varianten – dann zählen alle Blöcke, einzelne Ideen lassen sich „parken“.
- **Mehrere Pläne** pro Browser (z. B. „Urlaub 2027“ und „Urlaub 2028“) mit Umschalter, Duplizieren und Löschen.
- **Export:** Backup als JSON, Kalenderdatei (.ics) für Outlook/Google/Handy, CSV für Excel, Druckansicht (A4 quer).
- **Installierbar (PWA)** und offline nutzbar. Bei neuen Versionen erscheint „Neue Version verfügbar – jetzt aktualisieren“.
- Bedienung auf Deutsch, für Handy optimiert, große Schrift und Klickflächen.
- Freundliches Design „Sommer & Sonne“: warme Farben (auch im Dunkelmodus), Begrüßung mit Countdown bis zum nächsten Urlaub, Fortschrittsringe für die Urlaubstage, jahreszeitliche Monatsfarben und kleine Illustrationen.

## Wie die Daten geschützt sind

- Die Planung wird nur im Browser gespeichert (IndexedDB). Die App schickt keine Daten ins Internet und lädt zur Laufzeit nichts nach – Feiertage und Ferien sind eingebaut.
- Strikte Content-Security-Policy: nur eigene Dateien, keine externen Skripte, Schriften oder CDNs, keine Analytics.
- Beim ersten Start bittet die App den Browser, die Daten dauerhaft aufzubewahren (`navigator.storage.persist()`). Der Status steht unter *Datenschutz & Daten*.
- **Wichtig:** Wer die Browserdaten löscht, löscht auch die Planung. Deshalb gibt es eine **Backup-Erinnerung** (wenn noch kein Backup gemacht wurde oder das letzte älter als 30 Tage ist).
- Importierte Dateien werden streng geprüft (Schema-Validierung mit zod). Unbekannte oder beschädigte Daten werden mit einer verständlichen Meldung abgelehnt. Vor dem Überschreiben fragt die App nach.
- *Datenschutz & Daten → Alle Daten auf diesem Gerät löschen* entfernt alles (mit Rückfrage).

---

## Zwei Betriebsmodi

Eine Codebasis, zwei Speicher – gewählt beim Build über `VITE_STORAGE_MODE`:

| Modus | Speicher | Wofür |
|---|---|---|
| `browser` (Standard) | IndexedDB im Browser, mehrere Pläne | GitHub Pages, jede statische Webseite |
| `server` | Express-Server, Datei `data/urlaubsplan.json`, ein Plan | lokal im Heimnetz: mehrere Geräte im WLAN sehen dieselben Daten |

Beide Speicher erfüllen dieselbe Schnittstelle (`src/speicher/speicher.ts`: `load` / `save`).

### Browser-Modus lokal

```bash
npm install
npm run dev:browser     # Entwicklungsserver: http://localhost:5173
npm run build:pages     # Build wie für GitHub Pages (Base /urlaubsplaner/)
npm run preview:pages   # Vorschau: http://localhost:4173/urlaubsplaner/
```

### Server-Modus lokal (im WLAN teilen)

Voraussetzung: [Node.js](https://nodejs.org) (LTS, ab Version 22).

```bash
npm install
npm run start           # baut im Server-Modus und startet auf Port 3027
```

Unter Windows geht es auch per Doppelklick auf **`start.bat`**. Das Konsolenfenster zeigt zwei Adressen: eine für diesen PC und eine fürs Handy im gleichen WLAN. Beim ersten Zugriff fragt die Windows-Firewall – dort „Private Netzwerke“ erlauben.

- Die Daten liegen in `data/urlaubsplan.json`. Gibt es die Datei nicht, übernimmt der Server – falls vorhanden – Startdaten aus `data/seed.local.json`; sonst startet im Browser der Startassistent.
- Ältere Dateien werden beim Start automatisch auf das neue Format umgestellt. Vorher wird das Original nach `backup/` kopiert.
- Änderungen von einem Gerät erscheinen auf dem anderen nach spätestens etwa 8 Sekunden. Ist der Server kurz nicht erreichbar, speichert der Browser zwischen und lädt später hoch.
- Anderer Port: `set PORT=4000` (Windows) bzw. `PORT=4000 npm run start`. Testinstanz mit eigener Datei: `DATA_DIR` und `BACKUP_DIR` setzen.

`data/`, `backup/` sowie alle Dateien `*.local.*` und `.env*` sind git-ignoriert und landen nie im Repository.

### Weitere Befehle

```bash
npm run dev          # Server-Modus mit Hot Reload (Vite + API-Server)
npm test             # Unit-Tests (Vitest): Rechenregeln, Feiertage, Ferien, Speicher, Server-Datei
npm run test:e2e     # End-to-End-Tests (Playwright) gegen den Pages-Build, Desktop + Handy
npm run typecheck    # TypeScript-Prüfung
```

Die End-to-End-Tests nutzen standardmäßig den installierten Microsoft Edge. Mit `PW_CHANNEL=chrome` läuft Google Chrome, mit leerem `PW_CHANNEL` das Playwright-Chromium (vorher `npx playwright install chromium`). Vorher `npm run build:pages` ausführen.

---

## Veröffentlichen auf GitHub Pages

1. Repository mit dem Namen **`urlaubsplaner`** auf GitHub anlegen und den Code auf den Branch `main` pushen.
2. Auf GitHub: *Settings → Pages → Build and deployment → Source:* **GitHub Actions** wählen.
3. Fertig: Jeder Push auf `main` startet `.github/workflows/deploy.yml` – `npm ci`, Sicherheitsprüfung (`npm audit`), Tests, `build:pages`, Veröffentlichung. Die App ist danach unter `https://<github-benutzer>.github.io/urlaubsplaner/` erreichbar.

Der Pfad (`base`) folgt automatisch dem Repository-Namen. Lokal lässt er sich mit `BASE_PATH=/anderer-name/` überschreiben. Das Routing läuft über Hash-Adressen (`#/kalender`), daher funktioniert Neuladen auf jeder Unterseite. Dependabot (`.github/dependabot.yml`) prüft wöchentlich npm-Pakete und GitHub Actions.

---

## Ferien- und Feiertagsdaten aktualisieren

Die Schulferien stammen von der [OpenHolidays API](https://openholidaysapi.org) (Daten unter [ODbL-1.0](https://opendatacommons.org/licenses/odbl/1-0/)) und werden **beim Entwickeln** geladen, nicht zur Laufzeit:

```bash
npm run fetch-holidays              # aktuelles Jahr −1 bis +2
npm run fetch-holidays -- 2027 2030 # eigener Bereich
npm test                            # prüft u. a. die eigenen Feiertagsregeln gegen die API-Daten
```

Das Skript `scripts/fetch-holidays.mjs` schreibt `src/data/schulferien.json` (wird in die App eingebaut) und `src/data/feiertage-openholidays.json` (nur für den Abgleich-Test). Beide Dateien werden committed. Am besten einmal im Jahr ausführen, wenn die Länder neue Ferien veröffentlichen.

---

## Rechenregeln

- **Ohne Variantenvergleich** zählt jeder Block außer geparkten („Aus“).
- **Mit Variantenvergleich** ist ein Block aktiv, wenn er „Immer“ oder der gewählten Variante zugeordnet ist. „Aus“ ist nie aktiv. Eine Variante mit „startet leer“ zählt nur ihre eigenen Blöcke.
- **Tageswert je Person:** 0 an Feiertagen und an Tagen, an denen die Person nicht arbeitet. Am 24.12./31.12. gilt der eingestellte Wert (1 / 0,5 / 0). Sonst 1. Nur Tage im Planungsjahr zählen.
- **Urlaubstage eines Blocks** = Summe der Tageswerte, falls die Person betroffen ist.
- **Tage frei** = bis − von + 1. **Effizienz** = Tage frei / größte Zahl an Urlaubstagen einer Person.
- **Schulferien-Check:** Überschneidung, wenn von ≤ Ferienende und bis ≥ Ferienbeginn.
- **Tracker und Monate** rechnen pro Tag: Ein Tag zählt einmal, auch wenn er in mehreren aktiven Blöcken liegt. Bei Überschneidungen erscheint ein Hinweis.
- **Gemeinsame Urlaubstage** (nur bei zwei Personen) = Tage mit Urlaubswert > 0, an denen beide Urlaub haben.
- **Brückentag-Finder:** um jeden Feiertag an einem Arbeitstag (und um 24./31.12.) die beste Brücke mit höchstens 2 Urlaubstagen und mindestens 4 freien Tagen sowie die ganze Woche rund um den Feiertag. Vorschläge mit Arbeitstagen aus einem anderen Jahr werden weggelassen (anderes Urlaubskonto).

## Getroffene Entscheidungen

- **Eigenes Hash-Routing** statt React Router: weniger Abhängigkeiten, funktioniert auf GitHub Pages ohne Umwege.
- **Personen-IDs `p1`/`p2`:** Farben und Klassen hängen an der Position. Wird Person 1 entfernt, rückt Person 2 nach.
- **Datenformat versioniert:** Pläne tragen `schema: 3`. Ältere Dateien und Backups (Version 1 und 2) werden beim Laden oder Import automatisch umgewandelt.
- **Varianten optional:** Beim Umstellen von Version 2 wird der Vergleich nur eingeschaltet, wenn mindestens ein Block einer Variante zugeordnet ist. Geparkte Blöcke („Aus“) zählen dabei nicht als Variante. Beim Ausschalten fragt die App, ob solche Blöcke zu „Immer“ werden oder geparkt werden sollen. Die Varianten selbst bleiben gespeichert.
- **Server-Modus ohne Service Worker:** Dort gleicht die App ständig mit dem Server ab. Offline-Fähigkeit und Update-Hinweis gibt es im Browser-Modus.
- **Regionale Feiertage:** In Bayern ist Mariä Himmelfahrt standardmäßig angehakt (gilt in den meisten Gemeinden), die anderen regionalen Tage nicht.
- **24.12. und 31.12.** sind im Startassistenten als ganzer Urlaubstag vorbelegt (gesetzlich normale Arbeitstage) – lieber nicht zu knapp rechnen.
- **CSV statt Excel-Datei:** keine zusätzliche Bibliothek, öffnet direkt in Excel. Inhalte, die Excel als Formel deuten würde, werden entschärft.
- **zod ohne Code-Erzeugung** (`jitless`), damit die strikte Content-Security-Policy ohne `unsafe-eval` auskommt.
- **Gestaltung „Sommer & Sonne“:** Alle Farben sind Design-Tokens in `src/styles.css` (hell und dunkel). `src/test/kontrast.test.ts` liest sie aus und prüft die wichtigen Kombinationen nach WCAG AA (Text ≥ 4,5:1, Rahmen/Flächen ≥ 3:1). Text auf Personenfarben wird automatisch weiß oder dunkel gewählt (≥ 4,5:1). Animationen sind dezent und bei „Bewegung reduzieren“ abgeschaltet.
- **Schrift:** Nunito, selbst gehostet als variable woff2-Datei mit lateinischem Subset (`src/assets/fonts/`, SIL Open Font License, Lizenztext liegt bei). Sie wird vorgeladen und offline zwischengespeichert.
- **`npm audit`:** Die Laufzeit-Abhängigkeiten sind ohne Befund. Gemeldete Funde betreffen nur Build-Werkzeuge (Glob-Matching); der Workflow bricht bei kritischen Funden ab.

## Projektstruktur

```
src/lib/                 reine, getestete Logik (keine Logik in Komponenten)
  datum.ts               Datumsrechnung über UTC-Tageszahlen (keine Zeitzonenfehler)
  feiertage.ts           Osterformel, Feiertage aller Länder, regionale Feiertage
  schulferien.ts         Zugriff auf die eingebauten Ferien
  berechnung.ts          Tageswerte, Kennzahlen, Tracker, Monate, Varianten, Countdown
  brueckentage.ts        Brückentag-Finder
  tipps.ts               Urlaubstipps (inkl. besondere Tage)
  export.ts              .ics und CSV
  schema.ts              zod-Schema, Prüfung, Migration alter Formate
  plan.ts                Änderungs-Helfer, neuer Plan, Personen, Varianten
src/speicher/            Speicher-Abstraktion: Browser (IndexedDB) und Server
src/hooks/usePlan.ts     Laden/Speichern je Modus, Abgleich, Offline-Fallback
src/components/          Oberfläche (Startassistent, Kalender, Übersicht …)
  Illustrationen.tsx     selbst gezeichnete SVG-Illustrationen (Sonne, Koffer, Palme)
src/assets/fonts/        Schrift Nunito (woff2) + Lizenz
src/data/                Ferien- und Feiertagsdaten (aus fetch-holidays)
src/test/testplan.ts     neutrale Testdaten
server/                  Express-Server für den lokalen Modus
scripts/fetch-holidays.mjs
e2e/                     Playwright-Tests
public/                  Icons (aus public/favicon.svg erzeugt: npx pwa-assets-generator)
```

## Quellen

- Schulferien: [OpenHolidays API](https://openholidaysapi.org), Lizenz ODbL-1.0. Angaben ohne Gewähr.
- Feiertage: eigene Berechnung nach den Feiertagsgesetzen der Länder, abgeglichen mit der OpenHolidays API.
