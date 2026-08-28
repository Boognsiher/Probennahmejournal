# CLAUDE.md

## Projektkontext

Probennahmejournal: Web-App für ein Probennahmejournal auf Baustellen (Schweiz, Altlasten/Aushub-
Entsorgung nach VVEA/VBBo) — Proben mit Foto, Analysewerten, automatischer Einstufung (Deponietyp
A–E bzw. Bodenqualität) und VeVA-Code, PDF-Export, Analysenauftrag per E-Mail ans Labor.

Drei Varianten, identischer App-Code: `lokal/` (Einzelbenutzer, statisch, IndexedDB, kein Server),
`shell/` (Team-UI zum Vorführen, statisch, `js/api.js` durch `localStorage`-Mock ersetzt), `server/`
+ `public/` (Produktiv: Node/Express-Backend + SQLite, liefert `public/` aus).

Stack: Frontend reines HTML/CSS/Vanilla-JS (ES-Module, kein Build/Bundler/Framework); `server/` ist
Node ≥18 (ESM) mit Express, better-sqlite3, bcryptjs, jsonwebtoken, multer. pdf.js/jsPDF werden zur
Laufzeit von einem CDN geladen. Deployment via Docker (`docker-compose.yml`) oder pm2.

## Code-Stil

- Durchgehend Deutsch: Kommentare, Variablen-/Funktionsnamen (`baustelle`, `entsorgungsweg`), UI-Texte.
- camelCase für Variablen/Funktionen/DB-Spalten, `SCREAMING_SNAKE_CASE` für exportierte Konstanten.
- ES-Module, 2 Leerzeichen Einrückung, Single Quotes, Semikolons.
- Kommentare erklären den fachlichen Hintergrund (VVEA/VBBo/VeVA-Regeln), nicht das Offensichtliche —
  oft mehrzeilige Blöcke vor komplexeren Funktionen; JSDoc `/** */` vor öffentlich genutzten Funktionen.
- SQL-Spalten mit `-- `-Kommentar, wenn Wertebereich/Zweck nicht selbsterklärend ist.
- `shell/js/*.js` ist bewusst 1:1 identisch mit `public/js/*.js` (ausser `api.js`) — Änderungen an
  gemeinsamer Logik in beiden Ordnern nachziehen.
- Kein Linter/Formatter konfiguriert — am Stil der umgebenden Datei orientieren.

## Testen/Verifizieren

Keine automatisierten Tests, kein Build-Schritt. Aktuell manuell: Frontend mit
`python3 -m http.server 8080` im jeweiligen Ordner durchklicken (`shell/` mit Demo-Logins/
Demo-Datengenerator eignet sich am besten für Rollen-/Workflow-Tests); Server mit
`cd server && npm install && npm run dev`. Bei Änderungen an Klassifizierung/VeVA-Code
(`vvea.js`/`vvea-defaults.js`) Grenzfälle (knapp unter/über einem Grenzwert) manuell durchspielen.
Sinnvoller nächster Ausbauschritt: Unit-Tests für `classify()`/`classifyVBBO()` in
`public/js/vvea.js` (reine Funktionen) mit `node:test`.

## Nicht anfassen

- Grenzwerte, VeVA-Codes und Nutzungsart-Zuordnung in `server/src/vvea-defaults.js` (identisch in
  `public/`, `shell/`, `lokal/` je `js/vvea.js`): laut README vor produktivem Einsatz durch eine
  Fachperson zu verifizieren — nicht ohne Rücksprache inhaltlich ändern.
- Der automatisch ermittelte VeVA-Code ist im Formular absichtlich nicht überschreibbar
  (Nachvollziehbarkeit) — diese Sperre nicht ohne ausdrücklichen Wunsch aufheben.
- `server/.env`, `server/data/*.sqlite*`, `server/uploads/` — nie committen (siehe
  `server/README.md` > „Was niemals ins Repo/auf GitHub darf“).

## Notizen

