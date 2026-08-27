# Probennahmejournal – Test-Schale (ohne Server)

Exakt dieselbe Oberfläche/Logik wie die Server-Variante (Login, mehrere Benutzerrollen, Journal, Foto-Upload,
CSV/PDF-Import, Grenzwerte-Verwaltung), aber **ohne echten Server**: `js/api.js` ist hier durch eine
Simulation ersetzt, die alles in `localStorage` dieses Browsers ablegt. Damit lässt sich die komplette UI/UX
durchklicken und testen, bevor der echte Server (siehe [`../server`](../server/README.md)) aufgesetzt wird.

**`js/app.js`, `js/vvea.js`, `js/parse-csv.js`, `js/parse-pdf.js`, `js/report.js`, `js/report-pdf.js`,
`js/email.js` sind 1:1 identisch mit [`../public`](../public)** — nur `js/api.js` unterscheidet sich (Mock
statt echter HTTP-Aufrufe). Sobald die UI/Logik so passt, wird einfach `../server` + `../public` deployt statt
dieser Schale — am Anwendungscode ändert sich nichts.

## Demo-Zugänge

Beim ersten Aufruf automatisch angelegt (steht auch im blauen Banner oben in der App), inkl. einem
Beispielprojekt „Demo Baustelle Zürich“ (Kürzel `DEMO`) zum sofortigen Ausprobieren der Probenerfassung:

| E-Mail | Passwort | Rolle |
|---|---|---|
| `admin@demo.ch` | `demo1234` | Admin (alles, inkl. Benutzerverwaltung, Grenzwerte/Parameter) |
| `leitung@demo.ch` | `demo1234` | Projektleitung (eigene Projekte anlegen/freigeben, Analytik-Programme bearbeiten, VVEA-Grenzwertänderung beantragen) |
| `team@demo.ch` | `demo1234` | Probenehmer/in (in freigegebenen Projekten Proben erfassen, Löschen nur als Antrag) |
| `extern@demo.ch` | `demo1234` | Extern (nur lesend, nur einzeln freigegebene Proben) |

Das Demo-Projekt „Demo Baustelle Zürich“ gehört `leitung@demo.ch` — für `team@demo.ch` und `extern@demo.ch`
muss der Zugriff darauf (bzw. auf einzelne Proben) zuerst über die Projektleitung/den Admin gewährt werden
(Projekt bearbeiten bzw. „Sichtbarkeit für externe Nutzer“ bei der Probe).

Über „Testdaten zurücksetzen“ im Banner lassen sich alle simulierten Daten (Proben, Fotos, Projekte,
zusätzlich angelegte Benutzer, Grenzwerte/Parameter) jederzeit löschen und die Schale mit den Demo-Zugängen
neu starten.

Über „🧪 Probebaustelle mit 150 Demo-Proben anlegen“ lässt sich zusätzlich ein Demo-Projekt mit 150
automatisch generierten Proben erstellen, deren Einstufung bewusst den ganzen VVEA-Bereich von Typ A bis
Sonderabfall abdeckt — praktisch, um Journal-Filter, Farbcodierung und Sortierung mit realistisch vielen
Proben auszuprobieren (Details/Implementierung: [`js/demo-seed.js`](js/demo-seed.js)).

## Lokal starten

```bash
cd shell
python3 -m http.server 8080
```

Dann `http://localhost:8080` öffnen.

## Wichtig zu wissen

- **Keine echte Sicherheit**: Passwörter liegen im Klartext im `localStorage` dieses Browsers. Nur zum lokalen
  Testen/Vorführen gedacht, nicht im Internet öffentlich zugänglich machen.
- **Nichts wird geteilt**: Jeder Browser/jedes Gerät hat seine eigenen, unabhängigen Testdaten.
- **Fotos** werden als Base64 im `localStorage` gehalten — für ein paar Testfotos unproblematisch, aber
  `localStorage` hat pro Browser ein begrenztes Kontingent (üblicherweise 5–10 MB); für grössere Mengen an
  Testfotos ggf. zwischendurch „Testdaten zurücksetzen“ verwenden.
- Grenzwerte, VBBo-Werte und VeVA-Codes sind dieselben Startwerte wie in den anderen Varianten (siehe Hinweis
  in [`../README.md`](../README.md)) — inkl. automatisch aus dem Material ermitteltem VVEA-/VBBo-Standard,
  automatisch zugeteiltem VeVA-Code und projektbasiertem Entsorgungsweg-Dropdown je Probe.
