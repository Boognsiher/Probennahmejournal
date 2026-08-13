# Probennahmejournal – lokale Variante (ohne Server)

Reine Browser-App (PWA), **kein Server, kein Login, keine geteilten Daten**: alles bleibt ausschliesslich auf
dem Gerät, auf dem sie benutzt wird (Speicherung im Browser via IndexedDB). Ideal für den Einsatz durch
**eine Person** bzw. wenn keine gemeinsame, server-basierte Ablage benötigt wird.

Für die Team-Variante mit gemeinsamem Server, Login pro Person und zentraler Foto-/Datenablage siehe
[`../server/README.md`](../server/README.md) und die Projektübersicht in [`../README.md`](../README.md).

## Funktionsumfang

- 📷 Fotodokumentation des Materials über die Gerätekamera (im Browser gespeichert)
- 📥 Analyse-Import aus CSV/Excel-CSV oder PDF-Laborberichten
- 🎨 Automatische Farbcodierung der Werte nach Deponieklassen (VVEA-Struktur, Grenzwerte lokal editierbar)
- ✉️ **„Bericht exportieren“** erzeugt eine eigenständige HTML-Datei mit eingebetteten Fotos, Werten und
  Einstufung – lässt sich über die Browser-Druckfunktion direkt **als PDF speichern** und danach der
  vorbereiteten E-Mail (`mailto:`) manuell als Anhang beifügen
- 📶 Vollständig offline nutzbar (Service Worker + IndexedDB), installierbar als App

## ⚠️ Hinweis zu den Grenzwerten

Die hinterlegten VVEA-Grenzwerte sind **Platzhalter/Beispielwerte** – vor produktivem Einsatz durch eine
Fachperson prüfen und unter „Einstellungen“ anpassen. Details siehe Hinweis-Banner in der App.

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
js/db.js               IndexedDB-Speicherung der Journal-Einträge (inkl. Fotos als Blob)
js/vvea.js              Deponieklassen, Parameterliste, Grenzwert-Konfiguration & Klassifizierungs-Engine
js/parse-csv.js         CSV/Excel-CSV-Import
js/parse-pdf.js         PDF-Import (lädt pdf.js zur Laufzeit von einem CDN)
js/report.js            Erzeugt den herunterladbaren HTML-Bericht je Probe
js/email.js             Baut den mailto:-Link samt Textzusammenfassung
js/app.js               UI-Logik, Routing (Journal / Neue Probe / Einstellungen)
manifest.webmanifest    PWA-Manifest (installierbar)
service-worker.js       Offline-Cache der App-Shell
data/beispiel-analyse.csv  Beispieldatei für den CSV-Import
```

## Bekannte Grenzen

- Daten liegen nur im Browser des jeweiligen Geräts (IndexedDB) – kein Zugriff von einem anderen Gerät aus,
  kein Team-Sharing. Für mehrere Personen/Geräte mit gemeinsamer Ablage die Server-Variante verwenden.
- `mailto:` kann keine Dateianhänge automatisch setzen – der als PDF gedruckte/exportierte Bericht muss der
  E-Mail manuell angehängt werden.
- PDF-Erkennung beim Import ist heuristisch – Vorschau vor dem Übernehmen prüfen.
- Kein Geräteübergreifendes Backup/Sync (ausser durch manuellen Bericht-Export je Probe).
