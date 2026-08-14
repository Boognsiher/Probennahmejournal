# Baustellen-Probennahmejournal

App zur Führung eines Probennahmejournals auf der Baustelle:

- **Projekt zuerst auswählen** — Projektdaten werden einmal hinterlegt, der **Chargenname wird danach
  automatisch und fortlaufend pro Projekt vergeben** (z.B. `A123-001`, `A123-002`, …)
- **Möglichst wenig Tippen**: Material, Probenehmer/in als Auswahllisten, Entnahmeort mit Vorschlägen,
  grosse Bedienelemente — gedacht für die Bedienung mit Handschuhen/Schutzausrüstung
- Fotodokumentation des Materials
- Analyse-Import aus CSV/Excel-CSV oder PDF-Laborberichten, mit automatischer Farbcodierung nach
  Deponieklassen (Grenzwerte inkl. Einheiten, per CSV/Excel importierbar, eigene Parameter ergänzbar)
- **Echter PDF-Export** je Probe, E-Mail-Versand mit PDF nach Möglichkeit direkt angehängt (native
  Teilen-Funktion des Geräts)
- **Journal mit Filtern** (Projekt, Material, Deponieklasse) und Sortierung zum Aufräumen/Wiederfinden

Es gibt **drei eigenständige Varianten** im selben Repository – je nach Bedarf wählbar:

| | [`lokal/`](lokal/README.md) | [`shell/`](shell/README.md) | [`server/`](server/README.md) + [`public/`](public) |
|---|---|---|---|
| **Für wen** | Eine Person / ein Gerät | Team-Variante **testen/vorführen**, ohne einen Server aufzusetzen | Ein Team mit mehreren Personen/Geräten, produktiv |
| **Daten** | Nur lokal im Browser (IndexedDB) | Simuliert im Browser (`localStorage`), nicht echt geteilt | Zentral auf dem Server (SQLite + Dateisystem) |
| **Login** | Kein Login nötig | Simuliertes Login mit Demo-Zugängen | Echte individuelle Benutzer-Accounts |
| **Betrieb** | Rein statisch, z.B. GitHub Pages | Rein statisch, z.B. GitHub Pages | Braucht einen laufenden Node.js-Server (VPS/NAS/Raspberry Pi oder Docker) |
| **Los geht's** | [`lokal/README.md`](lokal/README.md) | [`shell/README.md`](shell/README.md) | [`server/README.md`](server/README.md) |

`shell/` verwendet exakt denselben App-Code (UI + Logik) wie `public/` — nur die Anbindung an den Server
(`js/api.js`) ist dort durch eine Simulation ersetzt. Sie eignet sich, um die Team-Variante (Login, Rollen,
Foto-Upload etc.) durchzuklicken/vorzuführen, bevor der echte Server aufgesetzt wird. Sobald das passt, wird
einfach `server/` + `public/` deployt statt `shell/` — am Anwendungscode ändert sich nichts.

## ⚠️ Wichtiger Hinweis zu den Grenzwerten (gilt für alle drei Varianten)

Die App liefert unter **Einstellungen → Grenzwerte** eine Beispiel-Tabelle mit Zahlenwerten pro Deponieklasse
(Typ A–E) mit. **Diese Zahlen sind Platzhalter zur Illustration der Funktion** – sie wurden nicht anhand der
aktuell rechtsgültigen VVEA (Anhang 5) bzw. kantonaler Vollzugshilfen verifiziert (der Zugriff auf die
offiziellen Quellen war beim Erstellen dieser App technisch nicht möglich). **Vor dem produktiven Einsatz
müssen die Grenzwerte durch eine Fachperson (Umweltbaubegleitung/Altlastenfachperson) anhand der aktuell
gültigen VVEA und ggf. kantonaler Vorgaben geprüft und angepasst werden.** Die App zeigt diesen Hinweis auch
beim ersten Start an.

## Schnellstart

**Lokal (kein Server):**
```bash
cd lokal && python3 -m http.server 8080
```

**Test-Schale (Team-UI ohne Server testen, Demo-Login `admin@demo.ch` / `demo1234`):**
```bash
cd shell && python3 -m http.server 8080
```

**Mit Server (Team, gemeinsame Ablage, produktiv):**
```bash
cd server && npm install && cp .env.example .env   # .env anpassen
npm start
```

Details, Deployment-Optionen (Docker, GitHub Pages, Reverse-Proxy/HTTPS) und Architekturübersicht jeweils in
den verlinkten READMEs oben.

## PDF & E-Mail-Versand

„Als PDF generieren“ erzeugt eine echte PDF-Datei (Fotos, Analysewerte, Klassifizierung) direkt im Browser.
„E-Mail mit PDF senden“ versucht zuerst, die PDF über die **native Teilen-Funktion** des Geräts (Web-Share-API,
v.a. Handys) direkt als Anhang bereitzustellen — der PDF-Anhang ist dann bereits gesetzt, es muss nur noch die
Mail-App gewählt werden. Wo das nicht unterstützt wird (v.a. Desktop-Browser), wird die PDF stattdessen
heruntergeladen und ein `mailto:` mit vorausgefülltem Text geöffnet — die Datei muss dort manuell angehängt
werden. Das ist eine Browser-/Betriebssystem-Einschränkung: `mailto:`-Links können aus keinem Browser heraus
automatisch Dateianhänge setzen, das lässt sich ohne eigenen Mailversand-Server (SMTP/E-Mail-API) nicht
umgehen.
