# Server – Probennahmejournal

Node.js/Express-Backend: Login mit individuellen Accounts, gemeinsame Datenbank (SQLite) und
Foto-Ablage im Dateisystem des Servers. Liefert zugleich das Frontend aus `../public` mit aus –
ein einzelner Prozess reicht für den Betrieb.

Jede Probe kann wahlweise nach **VVEA** (Deponietyp A–E) oder **VBBo** (Bodenqualität,
Nutzungsart-abhängig) eingestuft werden, dazu ein **VeVA-Code** und ein **Entsorgungsweg** zugeordnet
werden. Grenzwerte, Parameterlisten und VeVA-Codes werden je Server zentral in den `settings`
vorgehalten (siehe API-Tabelle unten) und beim ersten Start automatisch mit sinnvollen Startwerten
vorbefüllt.

## Einrichtung

```bash
cd server
npm install
cp .env.example .env
# .env öffnen und anpassen: JWT_SECRET (zufälliger Wert!), ADMIN_EMAIL, ADMIN_PASSWORD
npm start
```

Beim allerersten Start wird automatisch ein Admin-Konto aus `ADMIN_EMAIL`/`ADMIN_PASSWORD` angelegt
(nur falls noch keine Benutzer in der Datenbank existieren). Danach kann sich der Admin in der App
anmelden und unter „Einstellungen → Benutzer“ weitere Konten für das Team anlegen.

Die App ist danach unter `http://<server>:3000` erreichbar (Port über `PORT` in der `.env` änderbar).

### Zufälligen JWT_SECRET erzeugen

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

## Daten & Backups

- Datenbank: `server/data/probennahmejournal.sqlite` (SQLite-Datei)
- Fotos: `server/uploads/`

Beide Ordner sind in `.gitignore` ausgeschlossen und müssen **separat gesichert** werden (z.B.
regelmässiges Backup-Skript, das beide Ordner auf einen anderen Ort kopiert/synchronisiert). Ohne
Backup dieser zwei Ordner sind Journal-Daten und Fotos bei Datenverlust auf dem Server nicht
wiederherstellbar.

## Deployment-Optionen

### Mit Docker (empfohlen)

```bash
cp server/.env.example server/.env   # anpassen!
docker compose up -d --build
```

Die Daten liegen dann in den Docker-Volumes `pnj-data` / `pnj-uploads` (siehe `docker-compose.yml`).

### Direkt auf einem eigenen Server/NAS/Raspberry Pi

1. Node.js ≥ 18 installieren.
2. Repo auf den Server bringen, `cd server && npm install && cp .env.example .env` (anpassen).
3. Prozess dauerhaft am Laufen halten, z.B. mit `pm2`:
   ```bash
   npm install -g pm2
   pm2 start src/server.js --name probennahmejournal
   pm2 save
   pm2 startup
   ```
4. **HTTPS/Reverse Proxy**: Der App-Server selbst spricht nur HTTP. Für den Zugriff aus dem Feld
   (Handy auf der Baustelle, ggf. über Mobilfunk) sollte davor ein Reverse Proxy mit TLS-Zertifikat
   stehen, z.B. [Caddy](https://caddyserver.com/) (holt Zertifikate automatisch via Let's Encrypt):
   ```
   probennahmejournal.example.com {
     reverse_proxy localhost:3000
   }
   ```
   Alternativ nginx + certbot. Ohne HTTPS werden Login-Daten und Fotos unverschlüsselt übertragen –
   für den Einsatz ausserhalb eines vertrauenswürdigen lokalen Netzes daher **nicht empfohlen**.

## API-Überblick

Alle `/api/*`-Endpunkte ausser `/api/auth/login` erfordern den Header `Authorization: Bearer <token>`
(Token wird beim Login zurückgegeben).

| Methode | Pfad | Beschreibung |
|---|---|---|
| POST | `/api/auth/login` | Anmelden, liefert Token + Benutzer |
| GET | `/api/auth/me` | Eigene Benutzerdaten |
| GET | `/api/users` | Benutzerliste (nur Admin) |
| POST | `/api/users` | Benutzer anlegen (nur Admin) |
| DELETE | `/api/users/:id` | Benutzer löschen (nur Admin) |
| GET | `/api/users/roster` | Namensliste aller Benutzer (für „Probenehmer/in“-Dropdown, jede Rolle) |
| GET | `/api/projects` | Alle Projekte |
| POST | `/api/projects` | Projekt anlegen |
| PUT | `/api/projects/:id` | Projekt bearbeiten |
| DELETE | `/api/projects/:id` | Projekt löschen (nur wenn keine Proben mehr referenzieren) |
| GET | `/api/settings/thresholds` | Aktuelle VVEA-Grenzwerte |
| PUT | `/api/settings/thresholds` | Grenzwerte speichern (nur Admin) |
| POST | `/api/settings/thresholds/reset` | Auf Beispielwerte zurücksetzen (nur Admin) |
| GET | `/api/settings/parameters` | Aktuelle VVEA-Parameterliste (Grenzwert-Zeilen) |
| PUT | `/api/settings/parameters` | Parameterliste speichern, inkl. neue eigene Parameter (nur Admin) |
| POST | `/api/settings/parameters/reset` | Auf Standardliste zurücksetzen (nur Admin) |
| GET | `/api/settings/vbbo-thresholds` | Aktuelle VBBo-Grenzwerte (Richtwert/Prüfwert/Sanierungswert je Substanz) |
| PUT | `/api/settings/vbbo-thresholds` | VBBo-Grenzwerte speichern (nur Admin) |
| POST | `/api/settings/vbbo-thresholds/reset` | Auf Beispielwerte zurücksetzen (nur Admin) |
| GET | `/api/settings/vbbo-parameters` | Aktuelle VBBo-Parameterliste |
| PUT | `/api/settings/vbbo-parameters` | VBBo-Parameterliste speichern, inkl. neue eigene Parameter (nur Admin) |
| POST | `/api/settings/vbbo-parameters/reset` | Auf Standardliste zurücksetzen (nur Admin) |
| GET | `/api/settings/veva-codes` | Aktuelle VeVA-Codes (Aushub-/Bodenaushubcodes) |
| PUT | `/api/settings/veva-codes` | VeVA-Codes speichern (nur Admin) |
| POST | `/api/settings/veva-codes/reset` | Auf Beispielwerte zurücksetzen (nur Admin) |
| GET | `/api/entries` | Alle Proben |
| GET | `/api/entries/:id` | Einzelne Probe inkl. Foto-Metadaten |
| POST | `/api/entries` | Neue Probe anlegen — `projektId` erforderlich; Chargenname (`probeBezeichnung`) wird serverseitig aus Projekt-Kürzel + fortlaufender Nummer vergeben. Weitere Felder: `standard` (`vvea`/`vbbo`), `nutzungsart` (nur bei `vbbo`), `entsorgungsweg`, `vevaCode` |
| PUT | `/api/entries/:id` | Probe aktualisieren (Projekt/Chargenname bleiben nach dem Anlegen fix) |
| DELETE | `/api/entries/:id` | Probe löschen (inkl. zugehöriger Fotos) |
| POST | `/api/entries/:id/photos` | Fotos hochladen (multipart, Feld `photos`) |
| GET | `/api/entries/:id/photos/:photoId/file` | Fotodatei abrufen |
| DELETE | `/api/entries/:id/photos/:photoId` | Foto löschen |

PDF-Erzeugung und der Versand-Anhang (Web-Share-API) laufen komplett im Browser (siehe
[`../public/js/report-pdf.js`](../public/js/report-pdf.js)) — der Server ist daran nicht beteiligt und muss
dafür nichts bereitstellen.

## Bekannte Einschränkung: Offline-Erfassung

Im Gegensatz zur ursprünglichen rein lokalen Version (Daten im Browser) benötigt das Speichern von
Proben und das Hochladen von Fotos jetzt eine Verbindung zum Server. Bei schlechtem Empfang auf der
Baustelle empfiehlt es sich, Fotos/Werte notfalls kurz zwischenzunotieren und bei wiederhergestellter
Verbindung nachzutragen. Eine echte Offline-Warteschlange mit automatischer Synchronisation ist ein
möglicher nächster Ausbauschritt, aber (noch) nicht implementiert.
