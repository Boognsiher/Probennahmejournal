# Baustellen-Probennahmejournal

Web-App (PWA) zur Führung eines Probennahmejournals auf der Baustelle:

- 📷 **Fotodokumentation** des Materials direkt über die Gerätekamera
- 📥 **Analyse-Import** aus **CSV/Excel-CSV** oder **PDF-Laborberichten**
- 🎨 **Automatische Farbcodierung** der Werte nach Deponieklassen (VVEA-Struktur)
- ✉️ **E-Mail-Export** einer Zusammenfassung (mailto), inkl. herunterladbarem HTML-Bericht mit eingebetteten Fotos zum Anhängen
- 📶 **Offline-fähig** (Service Worker) und **installierbar** (PWA) – alle Daten bleiben lokal im Browser (IndexedDB), es gibt keinen Server/Backend

## ⚠️ Wichtiger Hinweis zu den Grenzwerten

Die App liefert unter **Einstellungen → Grenzwerte** eine Beispiel-Tabelle mit Zahlenwerten pro Deponieklasse
(Typ A–E) mit. **Diese Zahlen sind Platzhalter zur Illustration der Funktion** – sie wurden nicht anhand der
aktuell rechtsgültigen VVEA (Anhang 5) bzw. kantonaler Vollzugshilfen verifiziert (der Zugriff auf die
offiziellen Quellen war beim Erstellen dieser App technisch nicht möglich). **Vor dem produktiven Einsatz
müssen die Grenzwerte durch eine Fachperson (Umweltbaubegleitung/Altlastenfachperson) anhand der aktuell
gültigen VVEA und ggf. kantonaler Vorgaben geprüft und angepasst werden.** Die App zeigt diesen Hinweis auch
beim ersten Start an.

Die Grenzwerte lassen sich unter „Einstellungen“ frei bearbeiten, als JSON exportieren/importieren (z.B. um
sie zwischen Geräten oder im Team zu teilen) und jederzeit zurücksetzen.

## Nutzung

1. `index.html` per Webserver ausliefern (siehe unten) und im Browser öffnen – kann auf dem Homescreen als
   App installiert werden ("Zum Startbildschirm hinzufügen").
2. **Neue Probe**: Baustelle, Probenbezeichnung, Entnahmeort, Material erfassen, Fotos aufnehmen, GPS optional.
3. **Analysewerte**: manuell erfassen oder per CSV- bzw. PDF-Import einlesen. Importierte Werte werden vor der
   Übernahme in einer Vorschau angezeigt und können korrigiert werden (Parameterzuordnung ist ein
   Erkennungsvorschlag, keine Garantie – bitte prüfen).
4. Die Probe wird automatisch nach der strengsten Deponieklasse eingestuft, deren Grenzwerte **alle** erfassten
   Parameter einhalten (worst-case über alle Parameter).
5. **Speichern**, danach optional **„Bericht exportieren“** (eigenständige HTML-Datei mit Fotos, Werten und
   Einstufung – lässt sich auch über die Browser-Druckfunktion als PDF sichern) und **„E-Mail vorbereiten“**
   (öffnet das Mailprogramm mit vorausgefülltem Betreff/Text; der Bericht bzw. die Fotos müssen manuell als
   Anhang hinzugefügt werden – `mailto:`-Links können aus Sicherheitsgründen von Browsern aus keine
   Dateianhänge setzen).

Eine Beispiel-CSV zum Testen des Imports liegt unter [`data/beispiel-analyse.csv`](data/beispiel-analyse.csv).

## Lokal starten

Kein Build-Schritt nötig (reines HTML/JS, ES-Module). Aus dem Projektordner z.B.:

```bash
python3 -m http.server 8080
# oder: npx serve .
```

Dann `http://localhost:8080` öffnen. (Direktes Öffnen der `index.html` per `file://` funktioniert wegen der
ES-Module/Service-Worker-Sicherheitsregeln der Browser nicht zuverlässig – ein einfacher lokaler Webserver
reicht aus.)

## Deployment (z.B. GitHub Pages)

1. Repo-Einstellungen → Pages → Branch `main`, Ordner `/ (root)`.
2. Danach ist die App unter `https://<user>.github.io/<repo>/` erreichbar und auf dem Smartphone installierbar.

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

Alle Proben- und Fotodaten verbleiben ausschliesslich lokal im Browser (IndexedDB) des jeweiligen Geräts – es
gibt keine Server-Komponente und keine automatische Datenübertragung. Für den Wechsel des Geräts können
Berichte einzeln exportiert werden; ein Gesamt-Export/Import aller Einträge ist ein möglicher nächster
Ausbauschritt.

## Bekannte Grenzen / mögliche nächste Schritte

- PDF-Erkennung ist heuristisch (Text- und Zahlenmuster) – Format variiert stark zwischen Labors, daher immer
  die Vorschau vor dem Übernehmen prüfen.
- `mailto:` kann keine Dateianhänge setzen (Browser-Beschränkung) – der Bericht/die Fotos müssen manuell
  angehängt werden. Für echten automatischen Mail-Versand ohne Klick wäre ein kleiner Backend-Dienst
  (SMTP oder E-Mail-API wie SendGrid/Mailgun/Resend) nötig.
- Kein Gesamt-Backup/Sync aller Einträge zwischen Geräten (aktuell nur Einzel-Export je Probe).
- Grenzwerte: siehe Hinweis oben.
