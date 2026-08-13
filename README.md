# Baustellen-Probennahmejournal

App zur Führung eines Probennahmejournals auf der Baustelle: Fotodokumentation des Materials, Import von
Laboranalysen (CSV/PDF) mit automatischer Farbcodierung nach Deponieklassen, und E-Mail-Export.

Es gibt **zwei eigenständige Varianten** im selben Repository – je nach Bedarf wählbar:

| | [`lokal/`](lokal/README.md) | [`server/`](server/README.md) + [`public/`](public) |
|---|---|---|
| **Für wen** | Eine Person / ein Gerät | Ein Team mit mehreren Personen/Geräten |
| **Daten** | Nur lokal im Browser (IndexedDB) | Zentral auf dem Server (SQLite + Dateisystem) |
| **Login** | Kein Login nötig | Individuelle Benutzer-Accounts |
| **Fotos** | Bleiben auf dem Gerät | Werden auf den Server hochgeladen, für alle sichtbar |
| **Betrieb** | Rein statisch, z.B. GitHub Pages – kein eigener Server nötig | Braucht einen laufenden Node.js-Server (eigener VPS/NAS/Raspberry Pi oder Docker) |
| **E-Mail-Versand** | „Bericht exportieren“ (HTML/PDF-druckbar) + `mailto:` mit Anhang manuell | identisch (`mailto:`) |
| **Los geht's** | [`lokal/README.md`](lokal/README.md) | [`server/README.md`](server/README.md) |

Beide Varianten teilen dieselbe Kernlogik (Deponieklassen-Klassifizierung, CSV/PDF-Import, Berichts-Export),
sind aber unabhängig voneinander lauffähig – es lässt sich auch nur eine der beiden nutzen/deployen.

## ⚠️ Wichtiger Hinweis zu den Grenzwerten (gilt für beide Varianten)

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

**Mit Server (Team, gemeinsame Ablage):**
```bash
cd server && npm install && cp .env.example .env   # .env anpassen
npm start
```

Details, Deployment-Optionen (Docker, GitHub Pages, Reverse-Proxy/HTTPS) und Architekturübersicht jeweils in
den verlinkten READMEs oben.
