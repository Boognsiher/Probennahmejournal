# Baustellen-Probennahmejournal

App zur Führung eines Probennahmejournals auf der Baustelle:

- **Projekt zuerst auswählen** — Projektdaten werden einmal hinterlegt, der **Chargenname wird danach
  automatisch und fortlaufend pro Projekt vergeben** (z.B. `A123-001`, `A123-002`, …). Im Projekt lassen sich
  ausserdem **Beprobungsorte und Entsorgungswege vordefinieren**, die dann bei jeder Probe als Dropdown zur
  Verfügung stehen (Beprobungsort alternativ auch per GPS erfassbar).
- **Möglichst wenig Tippen**: Material, Probenehmer/in, Beprobungsort und Entsorgungsweg als Auswahllisten,
  grosse Bedienelemente — gedacht für die Bedienung mit Handschuhen/Schutzausrüstung
- Fotodokumentation des Materials
- **Zwei wählbare Einstufungsstandards pro Probe**: **VVEA** (Deponietyp A–E, Aushub-/Bauabfälle) oder
  **VBBo** (Bodenqualität, Richtwert/Prüfwert/Sanierungswert – abhängig von der gewählten **Nutzungsart**
  Kinderspielplatz / Haus-Familiengarten / Landwirtschaft-Gartenbau)
- Analyse-Import aus CSV/Excel-CSV oder PDF-Laborberichten, mit automatischer Farbcodierung nach dem
  gewählten Standard (Grenzwerte inkl. Einheiten, per CSV/Excel importierbar, eigene Parameter ergänzbar)
- **VeVA-Code wird automatisch zugeteilt** — aus Material (z.B. Aushub/Ober-/Unterboden), gewähltem Standard
  (VVEA/VBBo) und dem Einstufungsergebnis; bleibt manuell überschreibbar, falls kein passender Code gefunden
  wird oder eine andere Zuordnung gewünscht ist
- **Echter PDF-Export** je Probe, E-Mail-Versand mit PDF nach Möglichkeit direkt angehängt (native
  Teilen-Funktion des Geräts)
- **Journal mit Filtern** (Projekt, Material, Standard, Klasse) und Sortierung zum Aufräumen/Wiederfinden

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

## ⚠️ Wichtiger Hinweis zu Grenzwerten, VeVA-Codes und Nutzungsart-Zuordnung (gilt für alle drei Varianten)

Die App liefert unter **Einstellungen → Grenzwerte** vorbefüllte Zahlenwerte für **VVEA** (Deponietyp A–E,
Feststoff- und Eluatwerte) und **VBBo** (Richtwert/Prüfwert/Sanierungswert) sowie eine Liste mit **VeVA-Codes**
für Aushub-/Bodenaushubmaterial mit. Diese Werte stammen aus vom Auftraggeber bereitgestellten Unterlagen
(Auszüge/eigene Zusammenstellung, u.a. aus einer teils schräg eingescannten PDF-Tabelle für die VeVA-Codes).
**Vor dem produktiven Einsatz müssen** die Grenzwerte, die VeVA-Codes **und** die hinterlegte Zuordnung von
Nutzungsart → Prüfwert-/Sanierungswert-Spalte (Kinderspielplatz → Direktkontakt/Spielplatz, Haus-/
Familiengarten → Nahrungspflanzen/Garten, Landwirtschaft/Gartenbau → Futterpflanzen/Landwirtschaft — eine
vereinfachte Interpretation der VBBo-Anhang-2-Expositionspfade) **durch eine Fachperson
(Umweltbaubegleitung/Altlastenfachperson) anhand der aktuell gültigen VVEA/VBBo, kantonaler Vollzugshilfen und
der offiziellen VeVA-Codeliste geprüft und bei Bedarf angepasst werden** — insbesondere bevor ein VeVA-Code auf
einem offiziellen Begleitschein verwendet wird. Die App zeigt einen entsprechenden Hinweis auch beim ersten
Start an.

Der VeVA-Code wird automatisch aus Material (Ober-/Unterboden/Aushub — andere Materialien wie Mischabbruch
erhalten bewusst keinen Code, da die Liste nur Aushub-/Bodenaushubcodes enthält), gewähltem Standard und
Einstufungsergebnis vorgeschlagen. Bei einer **VBBo**-eingestuften Probe wird die VBBo-Klasse dafür auf die
entsprechende Kategorie abgebildet: unauffällig → Kat. I (unbelastet), über Richtwert → Kat. II (schwach
belastet, Typ A), über Prüfwert → Kat. IIIa (stark belastet, Typ B*), über Sanierungswert → Kat. IIIb (stark
belastet, VVEA „über Typ B", Typ C*). *Kat. IIIa und IIIb sind beide „stark belastet", aber unterschiedliche
Kategorien; die VeVA-Codeliste kennt jedoch nur die vier VVEA-Buckets unbelastet/Typ A/Typ B/Typ C, daher
werden beide auf den nächstliegenden Bucket abgebildet. „Sonderabfall" (VVEA „über Typ E") wird nur bei einer
VVEA-Einstufung automatisch erkannt, da die VBBo-Skala keine eigene Entsprechung dafür hat. Das ist eine
vereinfachende fachliche Einschätzung, keine normative Gleichsetzung. Der Vorschlag ist im Formular jederzeit
manuell überschreibbar.

**TOC (organischer Kohlenstoff)** fliesst bei der VVEA-Einstufung erst ab einer Einstufung schlechter als
Typ B in die Gesamtbewertung ein — bei Typ B oder besser wird ein hinterlegter TOC-Grenzwert nicht
berücksichtigt (der Wert wird in der Analysetabelle trotzdem angezeigt, nur eben nicht in die Gesamteinstufung
eingerechnet).

Wurde die App vor diesem Update bereits in Betrieb genommen (bestehende Server-Datenbank, bereits geöffnete
`shell/`- oder `lokal/`-Instanz), werden die neuen VBBo-Grenzwerte/-Parameter und VeVA-Codes automatisch als
Startwerte ergänzt, sobald noch keine eigenen gespeichert sind — die bestehende VVEA-Grenzwerttabelle bleibt
dabei unverändert erhalten.

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
