# Baustellen-Probennahmejournal

App zur Führung eines Probennahmejournals auf der Baustelle:

- **Startbildschirm mit Projektauswahl** — nach dem Anmelden zuerst wählen, an welchem Projekt/welcher
  Baustelle man gerade arbeitet; neue Proben und der Journal-Filter beziehen sich danach automatisch darauf.
  Über „Projekt wechseln“ in der Kopfzeile jederzeit änderbar (rein geräte-/browserlokale Auswahl, nicht mit
  dem Server/anderen Benutzer:innen geteilt).
- **Projekt zuerst auswählen** — Projektdaten werden einmal hinterlegt, der **Chargenname wird danach
  automatisch und fortlaufend pro Projekt vergeben** (z.B. `A123-001`, `A123-002`, …). Im Projekt lassen sich
  ausserdem **Beprobungsorte und Entsorgungswege vordefinieren**, die dann bei jeder Probe als Dropdown zur
  Verfügung stehen (Beprobungsort alternativ auch per GPS erfassbar).
- **Möglichst wenig Tippen**: Material, Probenehmer/in, Beprobungsort und Entsorgungsweg als Auswahllisten,
  grosse Bedienelemente — gedacht für die Bedienung mit Handschuhen/Schutzausrüstung
- **Probenahmeprotokoll (nur `shell/` und `server/`+`public/`)**: vereinzelte Proben ganz ohne Projekt
  erfassen — z.B. Spontanproben unterwegs — als eigenes „Scratchbook“ neben der normalen Projektauswahl auf
  dem Startbildschirm. Chargenname wird automatisch als `PP-0001`, `PP-0002`, … vergeben, PDF/E-Mail/Analysen
  auslösen funktioniert genau wie bei Projekt-Proben. Sichtbar nur für die erstellende Person selbst (und den
  Admin) — keine Projektleitung, keine externe Freigabe.
- Fotodokumentation des Materials
- **Menge je Probe erfassbar** (geschätzt, in t oder m³) — optional, wird im Journal, im PDF-Bericht und in der
  E-Mail-Zusammenfassung mit ausgewiesen
- **Materialien-Datenbank**: Material wird bei der Probe aus einer unter Einstellungen zentral gepflegten Liste
  gewählt (nicht mehr frei getippt) — dort legt eine Administrationsperson je Material fest, welcher
  Einstufungsstandard (VVEA oder VBBo) und welcher VeVA-Aushubcode-„Eimer" dafür gilt. Der
  **Einstufungsstandard steht damit für jede Probe automatisch fest**, sobald das Material gewählt ist (z.B.
  Humus/Ober-/Unterboden → **VBBo**, Bodenqualität mit Richtwert/Prüfwert/Sanierungswert – abhängig von der
  gewählten **Nutzungsart** Kinderspielplatz / Haus-Familiengarten / Landwirtschaft-Gartenbau; alle anderen
  Materialien wie Aushub, Kies/Sand, Bauschutt, … → **VVEA**, Deponietyp A–E). Keine manuelle Auswahl nötig.
- Analyse-Import aus CSV/Excel-CSV oder PDF-Laborberichten, mit automatischer Farbcodierung nach dem
  ermittelten Standard (Grenzwerte inkl. Einheiten, per CSV/Excel importierbar, eigene Parameter ergänzbar) —
  **jeder einzelne Wert in der Analysewerte-Tabelle zeigt seine eigene Einstufung als farbiges Badge** (nicht
  nur die Gesamteinstufung der Probe), damit auf einen Blick erkennbar ist, welche Werte zu hoch sind und
  welche unauffällig
- **Analytik-Programme**: benannte Zusammenstellungen von Analyseparametern (z.B. „VVEA Basis (Feststoff)“,
  „VVEA Eluat (Nachweis Typ C nach Behandlung)“) unter Einstellungen verwaltbar — mehrere Standardprogramme
  sind bereits hinterlegt, eigene lassen sich jederzeit ergänzen. Bei einer Probe mehrere Programme gleichzeitig
  auswählbar.
- **Analysenauftrag per E-Mail ans Labor**: „Analysen auslösen“ bei der Probe schickt eine E-Mail mit den
  gewünschten Parametern der gewählten Analytik-Programme sowie einem Analysenauftrag als PDF ans ausgewählte
  **Labor** (unter Einstellungen verwaltbar — Startauswahl Bachema AG/Schlieren, Nuitec/Winterthur,
  Eurofins/Deutschland; **E-Mail-Adressen müssen vor der ersten Nutzung ergänzt werden**, die App erfindet
  keine Kontaktdaten). Der generierte PDF ist ein von der App erstelltes Begleitdokument, **kein offizielles
  Formular des Labors**. Die Analysewerte selbst werden erst separat erfasst (manuell oder per CSV/PDF-Import),
  sobald die Laborresultate vorliegen — „Analysen auslösen“ trägt selbst keine leeren Zeilen mehr in die
  Analysewerte-Tabelle ein.
- **Etikette drucken**: Chargenname + QR-Code (mit Projekt/Material/Entnahmeort/Datum/Menge/Labor/Analysen als
  Klartext fürs Labor) direkt aus der Website über den normalen Systemdruckdialog druckbar — geeignet für
  Etikettendrucker wie die Brother-QL-/PT-Serie, die über ihren Treiber als normaler Drucker erscheinen.
  Etikettengrösse (Breite/Höhe in mm) einstellbar, wird geräte-/browserlokal gemerkt. Der QR-Code wird lokal im
  Browser gerendert, keine Probendaten verlassen dabei das Gerät.
- **VeVA-Code wird automatisch und fix zugeteilt** — aus Material (z.B. Aushub/Ober-/Unterboden), dem daraus
  abgeleiteten Standard (VVEA/VBBo) und dem Einstufungsergebnis. Anders als Standard/Material ist der Code bei
  der Probe **nicht manuell überschreibbar** — passt der automatisch ermittelte Code nicht, muss die
  Materialien- bzw. VeVA-Codes-Zuordnung unter Einstellungen angepasst werden, statt ihn pro Probe von Hand zu
  ändern (Nachvollziehbarkeit: derselbe Materialzustand ergibt immer denselben Code)
- **Echter PDF-Export** je Probe (Analysewerte-Tabelle inkl. Einstufung **und** dem dafür massgeblichen
  Grenzwert je Wert), E-Mail-Versand mit PDF nach Möglichkeit direkt angehängt (native Teilen-Funktion des
  Geräts)
- **Journal mit Filtern** (Projekt, Material, Standard, Klasse) und Sortierung zum Aufräumen/Wiederfinden
- **Vier Benutzerrollen** (nur `shell/`- und `server/`+`public/`-Variante, siehe Tabelle unten — `lokal/` ist
  Einzelbenutzer-/Offline und kennt keine Rollen): **Admin** (alles), **Projektleitung** (eigene Projekte
  anlegen und für Probenehmer/innen freigeben, Analytik-Programme bearbeiten, VVEA-Grenzwertänderungen beim
  Admin beantragen), **Probenehmer/in** (in freigegebenen Projekten Proben erfassen/bearbeiten; Löschen braucht
  eine Freigabe der Projektleitung), **Extern** (rein lesend, nur einzelne von der Projektleitung/dem Admin
  freigegebene Proben — kein eigener Projekt-Zugriff). Details: [`server/README.md`](server/README.md#rollen--sichtbarkeit).

Es gibt **drei eigenständige Varianten** im selben Repository – je nach Bedarf wählbar:

| | [`lokal/`](lokal/README.md) | [`shell/`](shell/README.md) | [`server/`](server/README.md) + [`public/`](public) |
|---|---|---|---|
| **Für wen** | Eine Person / ein Gerät | Team-Variante **testen/vorführen**, ohne einen Server aufzusetzen | Ein Team mit mehreren Personen/Geräten, produktiv |
| **Daten** | Nur lokal im Browser (IndexedDB) | Simuliert im Browser (`localStorage`), nicht echt geteilt | Zentral auf dem Server (SQLite + Dateisystem) |
| **Login** | Kein Login nötig | Simuliertes Login mit Demo-Zugängen (alle 4 Rollen) | Echte individuelle Benutzer-Accounts (alle 4 Rollen) |
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

Der VeVA-Code wird automatisch aus Material (über den in der Materialien-Liste hinterlegten VeVA-Aushubcode-
„Eimer" Ober-/Unterboden/Aushub — andere Materialien wie Mischabbruch erhalten bewusst keinen Code, da die
Liste nur Aushub-/Bodenaushubcodes enthält), gewähltem Standard und Einstufungsergebnis bestimmt. Bei einer
**VBBo**-eingestuften Probe wird die VBBo-Klasse dafür auf die
entsprechende Kategorie abgebildet: unauffällig → Kat. I (unbelastet), über Richtwert → Kat. II (schwach
belastet, Typ A), über Prüfwert → Kat. IIIa (stark belastet, Typ B*), über Sanierungswert → Kat. IIIb (stark
belastet, VVEA „über Typ B", Typ C*). *Kat. IIIa und IIIb sind beide „stark belastet", aber unterschiedliche
Kategorien; die VeVA-Codeliste kennt jedoch nur die vier VVEA-Buckets unbelastet/Typ A/Typ B/Typ C, daher
werden beide auf den nächstliegenden Bucket abgebildet. „Sonderabfall" (VVEA „über Typ E") wird nur bei einer
VVEA-Einstufung automatisch erkannt, da die VBBo-Skala keine eigene Entsprechung dafür hat. Das ist eine
vereinfachende fachliche Einschätzung, keine normative Gleichsetzung. Der ermittelte Code ist im
Proben-Formular bewusst **nicht manuell überschreibbar** — passt er nicht, ist die Materialien- bzw.
VeVA-Codes-Zuordnung unter Einstellungen anzupassen (siehe oben).

**Sonderabfall-Code:** Anhand der offiziellen Abfallliste (Kapitel 17 05, veva-online.admin.ch) gilt: Typ C, D
und E teilen sich weiterhin den Code 17 05 90/91 „[akb]" („andere kontrollpflichtige Abfälle mit
Begleitscheinpflicht", stark belastet/verschmutzt) — die Liste schliesst darin ausdrücklich „denjenigen [Boden],
der/das unter 17 05 03/05 fällt" aus, [akb] und Sonderabfall sind also zwei unterschiedliche, sich gegenseitig
ausschliessende Kategorien. Der echte Sonderabfall-Code („[S]", durch gefährliche Stoffe verunreinigt) ist
17 05 03 für Ober-/Unterboden bzw. 17 05 05 für Aushub- und Ausbruchmaterial und wird der Klasse „Sonderfall"
(nicht deponierbar, jenseits Typ E) zugeordnet. Auch diese Zuordnung ist vor produktivem Einsatz durch eine
Fachperson zu verifizieren.

**TOC (organischer Kohlenstoff)** fliesst bei der VVEA-Einstufung erst ab einer Einstufung schlechter als
Typ B in die Gesamtbewertung ein — bei Typ B oder besser wird ein hinterlegter TOC-Grenzwert nicht
berücksichtigt (der Wert wird in der Analysetabelle trotzdem angezeigt, nur eben nicht in die Gesamteinstufung
eingerechnet).

**Deponietyp C/D/E bei Schwermetallen:** Für den Feststoffgehalt (Gesamtgehalt) von Schwermetallen ist bewusst
kein eigener Typ-D-Grenzwert hinterlegt — bei erhöhten Feststoffgehalten wird grundsätzlich auf Typ E
eingestuft. Übersteigt der Feststoffgehalt auch den Typ-E-Grenzwert, gilt die Probe zunächst als Sonderfall
(„nicht deponierbar / Sonderabfall"), kann aber auf Typ C heruntergestuft werden — der typische Praxisfall:
Aushub mit hohem Schwermetall-Feststoffgehalt, aber tiefen organischen Schadstoffen, wird durch eine
Immobilisierung/Behandlung so aufbereitet, dass die Eluatwerte Typ-C-tauglich sind, statt teuer als
Sonderabfall (z.B. im Ausland) entsorgt zu werden müssen. Die Rückstufung greift nur, wenn **alle** folgenden
Bedingungen erfüllt sind: keiner der erfassten organischen Feststoffwerte (inkl. TOC/TOC400) liegt selbst im
Sonderfall-Bereich, UND zusätzlich Eluatwerte (i.d.R. aus einer Prüfung nach der Behandlung) für die
Schwermetalle sind erfasst und **alle** erfassten Eluat-Schwermetallwerte halten den Typ-C-Grenzwert ein —
fehlt eine solche Eluatprüfung, überschreitet auch nur ein erfasster Eluatwert den Typ-C-Grenzwert, oder sind
zusätzlich die organischen Schadstoffe zu hoch, bleibt es beim Sonderfall. Bei organischen
Schadstoffen (TOC400, Kohlenwasserstoffe, PAK, PCB, BTEX, Benzol) gilt weiterhin ein eigener Typ-D-Grenzwert
(= Wert von Typ B, siehe oben) — in den hier hinterlegten Quelldaten sind die Typ-B/C/D-Grenzwerte für die
meisten organischen Parameter jedoch identisch, wodurch Typ D über diese Parameter in der Praxis kaum je
erreicht wird. Auch das ist eine Näherung, keine normative Aussage — bitte durch eine Fachperson anhand der
aktuellen VVEA-Vollzugshilfen (insb. Anhang 5) prüfen.

Wurde die App vor diesem Update bereits in Betrieb genommen (bestehende Server-Datenbank, bereits geöffnete
`shell/`- oder `lokal/`-Instanz), werden die neuen VBBo-Grenzwerte/-Parameter, VeVA-Codes und die
Materialien-Liste automatisch als Startwerte ergänzt, sobald noch keine eigenen gespeichert sind — die
bestehende VVEA-Grenzwerttabelle bleibt dabei unverändert erhalten. Bereits erfasste Proben mit einem frei
eingetippten Material, das nicht in der neuen Startliste vorkommt, bleiben unverändert gespeichert und werden
im Formular weiterhin angezeigt — Standard/VeVA-Code werden für sie aber nicht mehr automatisch bestimmt, bis
entweder ein passendes Material aus der Liste gewählt oder das Material unter Einstellungen ergänzt wird.

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
