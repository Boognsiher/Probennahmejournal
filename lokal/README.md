# Probennahmejournal – lokale Variante (ohne Server)

Reine Browser-App (PWA), **kein Server, kein Login, keine geteilten Daten**: alles bleibt ausschliesslich auf
dem Gerät, auf dem sie benutzt wird (Speicherung im Browser via IndexedDB). Ideal für den Einsatz durch
**eine Person** bzw. wenn keine gemeinsame, server-basierte Ablage benötigt wird.

Für die Team-Variante mit gemeinsamem Server, Login pro Person und zentraler Foto-/Datenablage siehe
[`../server/README.md`](../server/README.md) und die Projektübersicht in [`../README.md`](../README.md).

## Funktionsumfang

- 🗂️ **Projekte anlegen** — Chargenname wird danach automatisch und fortlaufend pro Projekt vergeben
  (z.B. `A123-001`, `A123-002`, …), kein manuelles Eintippen mehr nötig. Im Projekt lassen sich ausserdem
  **Beprobungsorte und Entsorgungswege vordefinieren**, die dann bei jeder Probe als Dropdown zur Verfügung
  stehen (Beprobungsort alternativ auch per GPS erfassbar).
- ⌨️ Material, Probenehmer/in, Beprobungsort und Entsorgungsweg als Auswahllisten (Probenehmer/in merkt sich
  zuletzt verwendete Namen) — wenig Tippen, grosse Bedienelemente für Handschuhe/Schutzausrüstung
- 📷 Fotodokumentation des Materials über die Gerätekamera (im Browser gespeichert)
- 📥 Analyse-Import aus CSV/Excel-CSV oder PDF-Laborberichten
- 🎯 **Einstufungsstandard wird automatisch aus dem Material bestimmt**: Humus/Ober-/Unterboden -> **VBBo**
  (Bodenqualität, abhängig von der gewählten Nutzungsart Kinderspielplatz / Haus-Familiengarten /
  Landwirtschaft-Gartenbau), alle anderen Materialien -> **VVEA** (Deponietyp A–E). Keine manuelle Auswahl nötig.
- 🎨 Automatische Farbcodierung der Werte nach dem ermittelten Standard (Grenzwerte inkl. Einheiten, per
  CSV/Excel importierbar, eigene Parameter ergänzbar) — siehe „Einstellungen“
- 🚚 **VeVA-Code wird automatisch zugeteilt** (Aushub-/Bodenaushubcodes, aus Material/Standard/Einstufung —
  manuell überschreibbar) sowie ein projektbasiertes **Entsorgungsweg**-Dropdown je Probe
- 📄 **Echter PDF-Export** je Probe (Fotos, Werte, Einstufung)
- ✉️ **„E-Mail mit PDF senden“** versucht zuerst die native Teilen-Funktion des Geräts (PDF direkt als
  Anhang), sonst PDF-Download + `mailto:` mit vorausgefülltem Text zum manuellen Anhängen
- 🔎 Journal mit Filtern (Projekt, Material, Standard, Klasse) und Sortierung
- 📶 Vollständig offline nutzbar (Service Worker + IndexedDB), installierbar als App

## ⚠️ Hinweis zu Grenzwerten, VeVA-Codes und Nutzungsart-Zuordnung

Die hinterlegten VVEA-/VBBo-Grenzwerte und VeVA-Codes stammen aus vom Auftraggeber bereitgestellten
Unterlagen und sind **vor produktivem Einsatz durch eine Fachperson zu prüfen** (inkl. der vereinfachten
Zuordnung Nutzungsart → Prüfwert-/Sanierungswert-Spalte) — insbesondere bevor ein VeVA-Code auf einem
offiziellen Begleitschein verwendet wird. Details siehe Hinweis-Banner in der App und der entsprechende
Abschnitt in [`../README.md`](../README.md).

## Lokal starten

Kein Build-Schritt nötig (reines HTML/JS, ES-Module). Aus diesem Ordner z.B.:

```bash
python3 -m http.server 8080
# oder: npx serve .
```

Dann `http://localhost:8080` öffnen. (Direktes Öffnen der `index.html` per `file://` funktioniert wegen der
ES-Module/Service-Worker-Sicherheitsregeln der Browser nicht zuverlässig – ein einfacher lokaler Webserver
reicht aus.)

## Deployment (z.B. GitHub Pages)

Dieser Ordner ist komplett eigenständig (keine Abhängigkeit zu `../server`). Für GitHub Pages:

1. Repo-Einstellungen → Pages → Branch `main`, Ordner `/lokal` (oder diesen Ordner separat veröffentlichen).
2. Danach ist die App unter der entsprechenden `github.io`-URL erreichbar und auf dem Smartphone installierbar.

## Architektur

```
index.html            App-Shell, Navigation, Disclaimer-Banner
css/style.css          Styling (hell/dunkel automatisch)
js/db.js               IndexedDB-Speicherung der Journal-Einträge (inkl. Fotos als Blob) und Projekte
js/vvea.js              VVEA-Deponieklassen + VBBo-Bodenqualität, Parameterlisten, VeVA-Codes, Grenzwert-Konfiguration, CSV-Import & Klassifizierungs-Engine
js/parse-csv.js         CSV/Excel-CSV-Import (Analysewerte)
js/parse-pdf.js         PDF-Import (lädt pdf.js zur Laufzeit von einem CDN)
js/report.js            Erzeugt den herunterladbaren HTML-Bericht je Probe
js/report-pdf.js        Erzeugt die echte PDF-Datei je Probe (lädt jsPDF zur Laufzeit von einem CDN), Teilen/Download
js/email.js             Baut die mailto:-Textzusammenfassung
js/app.js               UI-Logik, Routing (Journal / Neue Probe / Projekte / Einstellungen)
manifest.webmanifest    PWA-Manifest (installierbar)
service-worker.js       Offline-Cache der App-Shell
data/beispiel-analyse.csv  Beispieldatei für den CSV-Import
```

## Bekannte Grenzen

- Daten liegen nur im Browser des jeweiligen Geräts (IndexedDB) – kein Zugriff von einem anderen Gerät aus,
  kein Team-Sharing. Für mehrere Personen/Geräte mit gemeinsamer Ablage die Server-Variante verwenden.
- `mailto:` kann keine Dateianhänge automatisch setzen. Wo die native Teilen-Funktion (Web-Share-API) nicht
  verfügbar ist (v.a. Desktop-Browser), muss die heruntergeladene PDF der E-Mail manuell angehängt werden.
- PDF-Erkennung beim Import ist heuristisch – Vorschau vor dem Übernehmen prüfen.
- Kein Geräteübergreifendes Backup/Sync (ausser durch manuellen Bericht-Export je Probe).
