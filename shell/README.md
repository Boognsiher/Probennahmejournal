# Probennahmejournal – Test-Schale (ohne Server)

Exakt dieselbe Oberfläche/Logik wie die Server-Variante (Login, mehrere Benutzerrollen, Journal, Foto-Upload,
CSV/PDF-Import, Grenzwerte-Verwaltung), aber **ohne echten Server**: `js/api.js` ist hier durch eine
Simulation ersetzt, die alles in `localStorage` dieses Browsers ablegt. Damit lässt sich die komplette UI/UX
durchklicken und testen, bevor der echte Server (siehe [`../server`](../server/README.md)) aufgesetzt wird.

**`js/app.js`, `js/vvea.js`, `js/parse-csv.js`, `js/parse-pdf.js`, `js/report.js`, `js/email.js` sind 1:1
identisch mit [`../public`](../public)** — nur `js/api.js` unterscheidet sich (Mock statt echter HTTP-Aufrufe).
Sobald die UI/Logik so passt, wird einfach `../server` + `../public` deployt statt dieser Schale — am
Anwendungscode ändert sich nichts.

## Demo-Zugänge

Beim ersten Aufruf automatisch angelegt (steht auch im blauen Banner oben in der App):

| E-Mail | Passwort | Rolle |
|---|---|---|
| `admin@demo.ch` | `demo1234` | Administrator (Benutzerverwaltung, Grenzwerte bearbeiten) |
| `team@demo.ch` | `demo1234` | Team-Mitglied (eingeschränkte Rechte) |

Über „Testdaten zurücksetzen“ im Banner lassen sich alle simulierten Daten (Proben, Fotos, zusätzlich
angelegte Benutzer, Grenzwerte) jederzeit löschen und die Schale mit den zwei Demo-Zugängen neu starten.

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
- Grenzwerte sind dieselben Platzhalter/Beispielwerte wie in den anderen Varianten (siehe Hinweis in
  [`../README.md`](../README.md)).
