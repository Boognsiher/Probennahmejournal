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

### Backup nach OneDrive

Ohne eigene Microsoft-Graph-API-Anbindung (Azure-App-Registrierung, OAuth) lässt sich ein Backup am
einfachsten über den **lokal installierten OneDrive-Desktop-Client** realisieren — der Client
synchronisiert automatisch alles, was in seinem Sync-Ordner landet, kein API-Zugang nötig:

1. OneDrive-Client auf dem Rechner installieren, auf dem der Server läuft, und anmelden.
2. [`scripts/backup-to-onedrive.sh`](scripts/backup-to-onedrive.sh) regelmässig ausführen — es kopiert
   Datenbank (per SQLite-Online-Backup, funktioniert auch im laufenden Betrieb) und Fotos in einen
   Unterordner **innerhalb** des OneDrive-Sync-Ordners:
   ```bash
   ONEDRIVE_BACKUP_DIR="$HOME/OneDrive/Probennahmejournal-Backup" ./scripts/backup-to-onedrive.sh
   ```
3. Per Cron automatisieren (z.B. stündlich):
   ```
   0 * * * * ONEDRIVE_BACKUP_DIR=/home/user/OneDrive/Probennahmejournal-Backup /pfad/zu/server/scripts/backup-to-onedrive.sh >> /var/log/pnj-backup.log 2>&1
   ```
   Alte Sicherungen werden automatisch aufgeräumt (`ONEDRIVE_BACKUP_KEEP`, Default: die letzten 30
   Durchläufe bleiben erhalten).

**Wichtig zu PDF-Berichten:** Die PDF-Datei je Probe wird aktuell ausschliesslich **im Browser**
erzeugt und direkt heruntergeladen — der Server speichert sie nicht. Für eine automatische
OneDrive-Sicherung der PDFs müsste die App zusätzlich so erweitert werden, dass generierte PDFs auch
serverseitig abgelegt werden (analog zu den Fotos) — das Backup-Skript legt dafür bereits vorsorglich
einen `pdf-reports/`-Ordner mit ab, sobald ein solcher existiert.

Eine direkte API-Anbindung (Microsoft Graph, `Files.ReadWrite` via Azure-App-Registrierung) wäre die
robustere Alternative, falls kein Desktop-Client auf dem Server laufen soll — dafür wird eine
App-Registrierung in Microsoft Entra ID (Client-ID/-Secret, Tenant-ID) benötigt.

## Deployment-Optionen

### Mit Docker (empfohlen)

```bash
cp server/.env.example server/.env   # anpassen!
docker compose up -d --build
```

Die Daten liegen dann in den Docker-Volumes `pnj-data` / `pnj-uploads` (siehe `docker-compose.yml`).

### Auf einer Synology-NAS (Container Manager)

1. Repo auf die NAS bringen (z.B. per Git-Paket aus dem Synology Paketzentrum, oder das Repo als
   ZIP herunterladen und über File Station hochladen/entpacken).
2. `server/.env.example` nach `server/.env` kopieren und anpassen (`JWT_SECRET`, `ADMIN_EMAIL`,
   `ADMIN_PASSWORD`, `CORS_ORIGIN`, `TRUST_PROXY=1` — siehe Schritt 5 unten).
3. **Container Manager** (DSM-Paket, bei älteren DSM-Versionen „Docker“ genannt) öffnen → **Projekt**
   → **Erstellen** → als Pfad den Ordner mit der `docker-compose.yml` im Repo-Root wählen. Container
   Manager liest die Datei ein und baut/startet den Container automatisch (entspricht `docker compose
   up -d --build`).
4. **Eigener Port/eigene Domain, nicht über den DSM-Login**: Die App läuft auf Port 3000 im
   Container — in Container Manager auf einen freien Host-Port mappen (z.B. 3001), damit sie
   unabhängig von der DSM-Weboberfläche (Port 5000/5001) erreichbar ist.
5. **HTTPS über DSM selbst** (kein eigener Caddy/nginx-Container nötig): Systemsteuerung →
   Anmeldeportal → Erweitert → **Reverse-Proxy** → neue Regel anlegen, die eure Domain/Subdomain auf
   `localhost:<Host-Port aus Schritt 4>` weiterleitet. Zertifikat unter Systemsteuerung →
   Sicherheit → Zertifikat → **Let's-Encrypt-Zertifikat hinzufügen** (kostenlos, automatische
   Erneuerung). Da der Zugriff dann über diesen Reverse-Proxy läuft: `TRUST_PROXY=1` in der `.env`
   setzen (siehe Schritt 2), sonst sieht der Login-Rate-Limiter nur die DSM-interne IP statt der
   echten Client-IP.
6. Falls die NAS ohnehin schon ans Internet exponiert ist (z.B. für private Dateiablage): DSM-Login
   selbst auf 2FA stellen und DSM/Pakete aktuell halten — die App ist nur so sicher wie das
   darunterliegende System. Idealerweise ist der DSM-Login selbst nicht öffentlich erreichbar (nur
   die neue Reverse-Proxy-Regel für die App-Domain), sondern nur über lokales Netz/VPN.
7. Backup: `server/data/`/`server/uploads/` liegen als Docker-Volumes vor — das Backup-Skript
   (`scripts/backup-to-onedrive.sh`) lässt sich per Synology **Aufgabenplaner** (Systemsteuerung →
   Aufgabenplaner → geplante Aufgabe → Benutzerdefiniertes Skript) statt Cron einrichten.

### Direkt auf einem eigenen Server/NAS/Raspberry Pi (ohne Docker)

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
5. Läuft der Server hinter dem Reverse Proxy aus Schritt 4: `TRUST_PROXY=1` in der `.env` setzen (siehe
   .env.example) — sonst sieht z.B. der Login-Rate-Limiter unten nur die IP des Proxys statt der
   echten Client-IP. **Nicht** setzen, wenn der Server ohne eigenen Proxy direkt erreichbar ist.

## Sicherheit

- **HTTPS ist Pflicht** für den Einsatz ausserhalb eines vertrauenswürdigen lokalen Netzes — siehe
  „HTTPS/Reverse Proxy“ oben. Der Node-Prozess selbst verschlüsselt nichts.
- **Verschlüsselung "at rest"**: Passwörter sind korrekt gehasht (bcrypt), alle übrigen Daten
  (Proben, Materialien, GPS-Koordinaten, Fotos) liegen unverschlüsselt in der SQLite-Datei bzw. als
  Bilddateien auf der Server-Platte — kein Verschlüsselung auf Anwendungsebene. Für den Basisschutz
  reicht meist eine verschlüsselte Server-/Volume-Platte (bei den meisten Cloud-Anbietern
  Standard, bei eigener Hardware z.B. LUKS); echte Verschlüsselung auf DB-Ebene (z.B. SQLCipher)
  wäre ein grösserer Umbau und für eine Alpha mit kleinem, bekanntem Nutzerkreis meist nicht nötig.
- **`JWT_SECRET`** muss vor dem produktiven Start durch einen eigenen, zufälligen Wert ersetzt werden
  (siehe oben) — mit dem Platzhalter aus `.env.example` liessen sich gültige Login-Token fälschen.
- **Login-Rate-Limiting**: `/api/auth/login` ist pro IP-Adresse auf 10 fehlgeschlagene Versuche
  innerhalb von 10 Minuten begrenzt (danach `429 Too Many Requests`, siehe `src/rate-limit.js`) —
  schützt vor Passwort-Brute-Force. Ein erfolgreicher Login setzt den Zähler zurück.
- **`CORS_ORIGIN`**: ohne gesetzten Wert akzeptiert die API Cross-Origin-Aufrufe von jeder Herkunft
  (offenes CORS, praktisch für lokale Entwicklung). Für den produktiven Einsatz die eigene Domain in
  der `.env` eintragen (siehe `.env.example`) — betrifft nur browserseitige Aufrufe von einer
  ANDEREN Domain aus, das Frontend selbst (vom selben Server ausgeliefert) ist davon nicht betroffen.
- **Kein „Passwort vergessen“ per E-Mail** (die App verschickt keine E-Mails, siehe oben) — der Admin
  setzt stattdessen unter Einstellungen &gt; Benutzer direkt ein neues Passwort für das betroffene
  Konto (`PUT /api/users/:id/password`, mind. 8 Zeichen), auch fürs eigene Konto. Das Konto bleibt
  dabei erhalten (gleiche ID) — anders als Löschen+Neuanlegen, wodurch Zugriffslisten wie
  `probenehmerZugriff`/`externZugriff` sonst auf eine nicht mehr existierende ID zeigen würden.
- **Login-Feld ist reiner Login-Name**, keine echte E-Mail nötig (z.B. auch ein Kürzel wie `hm`
  möglich) — die App verschickt ohnehin keine E-Mails, das Feld muss nur unter den Benutzer:innen
  eindeutig sein.

### Was niemals ins Repo/auf GitHub darf

Betrifft dieses Repo unabhängig davon, ob es öffentlich oder privat auf GitHub liegt — bei einem
**privaten** Repo ist das Risiko bei einem Leak zwar kleiner (nicht die ganze Welt sieht es sofort),
schützt aber nicht vor kompromittierten GitHub-Accounts/Zugriffsrechten, und einmal committete
Geheimnisse bleiben für immer in der Git-Historie, auch wenn die Datei später gelöscht wird — also
von Anfang an draussen halten, nicht erst nachträglich:

- **`server/.env`** (echter `JWT_SECRET`, `ADMIN_PASSWORD`, etc.) — nur `.env.example` mit
  Platzhaltern gehört ins Repo. Ist bereits über `server/.gitignore` ausgeschlossen.
- **`server/data/*.sqlite*`** (die Datenbank — Passwort-Hashes, alle Proben-/Personendaten) und
  **`server/uploads/`** (Fotos) — ebenfalls bereits ausgeschlossen (`server/.gitignore`).
- Jeder **echte Zugangsdaten-Wert** direkt im Code oder in Doku-Beispielen (echte Domain, echte
  Admin-Adresse, echtes Passwort) — Beispiele in README/`.env.example` bewusst mit Platzhaltern
  halten, nicht mit echten Werten überschreiben, bevor man sie committet.

Der aktuelle Stand ist geprüft sauber (kein `.env`, keine `.sqlite`-Datei, keine Zugangsdaten im
Commit-Verlauf) — das bleibt so, solange oben genannte Dateien nie mit `git add -f` erzwungen werden.

## Rollen & Sichtbarkeit

Vier Rollen (`role`-Feld je Benutzer), von umfassend zu eingeschränkt:

| Rolle | Projekte | Proben | Einstellungen |
|---|---|---|---|
| **admin** | alle sehen/anlegen/bearbeiten/löschen | alle sehen/anlegen/bearbeiten/sofort löschen | alles (inkl. Benutzerverwaltung) |
| **projektleiter** | nur SELBST ERSTELLTE Projekte — anlegen/bearbeiten/löschen, dort Zugriffsliste für Probenehmer/innen (`probenehmerZugriff`, Array Benutzer-IDs) und externe Sichtbarkeit je Probe (`externZugriff`) verwalten | alle Proben in eigenen Projekten sehen/anlegen/bearbeiten/sofort löschen, Löschanträge von Probenehmer/innen freigeben/ablehnen | **Analytik-Programme** direkt bearbeiten; bei **VVEA-Grenzwerten** nur einen Änderungsantrag stellen (`POST /api/settings/thresholds/requests`) — Admin übernimmt/lehnt ab. Alles andere (Parameterliste, VBBo, VeVA-Codes, Materialien, Labore, Benutzer) keine |
| **probenehmer** | nur sehen, wo Zugriff gewährt wurde (kein Anlegen/Bearbeiten/Löschen von Projekten) | in freigegebenen Projekten anlegen/bearbeiten; Löschen nur als **Antrag** (`DELETE /api/entries/:id` setzt `deletionRequestedAt/By` statt zu löschen — braucht Freigabe der zuständigen Projektleitung/Admin) | keine |
| **extern** | kein Projekt-Zugriff (kein eigener Scope) | NUR einzeln freigegebene Proben (`externZugriff`), rein lesend — keine Schreib-Endpunkte erreichbar | keine |

Andere Rolle als die eigene setzen kann nur ein Admin, über `PUT /api/users/:id/role` (nicht die eigene Rolle).
Bestehende `'user'`-Konten aus einer Installation vor diesem Update werden beim ersten Start automatisch auf
`'probenehmer'` migriert — bei Bedarf danach unter Einstellungen > Benutzer auf `'projektleiter'` hochstufen.

### Probenahmeprotokoll (Einzelproben ohne Projekt)

Jede Rolle ausser `extern` kann Proben auch **ohne Projekt** anlegen (`POST /api/entries` ohne `projektId`) —
gedacht für vereinzelte Spontanproben, die keiner Baustelle zugeteilt werden sollen ("Scratchbook"). Der
Chargenname wird dann global fortlaufend als `PP-0001`, `PP-0002`, … vergeben (statt Projekt-Kürzel +
Nummer). Sichtbarkeit ist bewusst eng: **nur die erstellende Person + Admin** sehen eine solche Probe — keine
Projektleitung, keine externe Freigabe (`externZugriff` ist bei Einzelproben immer leer). Löschen geht dort
immer sofort (kein Antrag nötig, da keine Projektleitung zuständig wäre): Ersteller/in oder Admin. Im Client
erreichbar über „Nur Probenahmeprotokoll (ohne Projekt)“ auf dem Startbildschirm bzw. unter `#/protokoll`;
die Proben erscheinen zusätzlich ganz normal im Journal (für die berechtigten Personen).

## API-Überblick

Alle `/api/*`-Endpunkte ausser `/api/auth/login` erfordern den Header `Authorization: Bearer <token>`
(Token wird beim Login zurückgegeben). Listen-/Detail-Endpunkte (`GET /api/projects`, `GET /api/entries`, …)
filtern automatisch nach dem oben beschriebenen Sichtbarkeits-Scope der anfragenden Person — es gibt keinen
separaten "meine Projekte"-Parameter, die normale Liste zeigt bereits nur, was sichtbar ist.

| Methode | Pfad | Beschreibung |
|---|---|---|
| POST | `/api/auth/login` | Anmelden, liefert Token + Benutzer |
| GET | `/api/auth/me` | Eigene Benutzerdaten |
| GET | `/api/users` | Benutzerliste (nur Admin) |
| POST | `/api/users` | Benutzer anlegen — `role` optional (nur Admin) |
| PUT | `/api/users/:id/role` | Rolle ändern, nicht die eigene (nur Admin) |
| PUT | `/api/users/:id/password` | Neues Passwort setzen (auch fürs eigene Konto, nur Admin) |
| DELETE | `/api/users/:id` | Benutzer löschen (nur Admin) |
| GET | `/api/users/roster` | Namensliste aller Benutzer (für „Probenehmer/in“-Dropdown, jede Rolle) |
| GET | `/api/projects` | Sichtbare Projekte (inkl. `entnahmeorte`/`entsorgungswege`/`probenehmerZugriff`) |
| POST | `/api/projects` | Projekt anlegen (nur admin/projektleiter) — optional `entnahmeorte`/`entsorgungswege`/`probenehmerZugriff` (Arrays) |
| PUT | `/api/projects/:id` | Projekt bearbeiten, inkl. `probenehmerZugriff` (nur admin oder zuständige Projektleitung) |
| DELETE | `/api/projects/:id` | Projekt löschen (nur wenn keine Proben mehr referenzieren; nur admin/zuständige Projektleitung) |
| GET | `/api/settings/thresholds` | Aktuelle VVEA-Grenzwerte |
| PUT | `/api/settings/thresholds` | Grenzwerte speichern (nur Admin) |
| POST | `/api/settings/thresholds/reset` | Auf Beispielwerte zurücksetzen (nur Admin) |
| GET | `/api/settings/thresholds/requests` | Offene Änderungsanträge für VVEA-Grenzwerte (Admin: alle; Projektleitung: nur eigene) |
| POST | `/api/settings/thresholds/requests` | Änderung vorschlagen — Body `{thresholds, note}` (admin/projektleiter) |
| POST | `/api/settings/thresholds/requests/:id/cancel` | Eigenen Antrag zurückziehen (admin, oder die antragstellende Projektleitung) |
| POST | `/api/settings/thresholds/requests/:id/apply` | Antrag übernehmen (schreibt in die aktiven Grenzwerte, nur Admin) |
| POST | `/api/settings/thresholds/requests/:id/reject` | Antrag ablehnen, verwirft ihn (nur Admin) |
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
| GET | `/api/settings/analytik-programme` | Aktuelle Analytik-Programme |
| PUT | `/api/settings/analytik-programme` | Analytik-Programme speichern (admin oder projektleiter) |
| POST | `/api/settings/analytik-programme/reset` | Auf Beispielwerte zurücksetzen (admin oder projektleiter) |
| GET | `/api/settings/materialien` | Aktuelle Materialien-Liste (Name, Standard, VeVA-Eimer je Material) |
| PUT | `/api/settings/materialien` | Materialien-Liste speichern (nur Admin) |
| POST | `/api/settings/materialien/reset` | Auf Beispielwerte zurücksetzen (nur Admin) |
| GET | `/api/settings/labore` | Aktuelle Labor-Liste (Name, Ort, E-Mail, Adresse, Telefon je Labor) |
| PUT | `/api/settings/labore` | Labor-Liste speichern (nur Admin) |
| POST | `/api/settings/labore/reset` | Auf Beispielwerte zurücksetzen (nur Admin) |
| GET | `/api/entries` | Sichtbare Proben (siehe Rollentabelle oben) |
| GET | `/api/entries/:id` | Einzelne Probe inkl. Foto-Metadaten |
| POST | `/api/entries` | Neue Probe anlegen — mit `projektId` (Schreibzugriff auf das Projekt nötig) oder ohne (Einzelprobe/Probenahmeprotokoll, nicht für `extern`); Chargenname (`probeBezeichnung`) wird serverseitig vergeben (Projekt-Kürzel+Nummer bzw. `PP-####`). Weitere Felder: `standard` (`vvea`/`vbbo`), `nutzungsart` (nur bei `vbbo`), `entsorgungsweg`, `vevaCode`, `labor`, `externZugriff` (nur admin/Projektleitung, nicht bei Einzelproben) |
| PUT | `/api/entries/:id` | Probe aktualisieren (Projekt/Chargenname bleiben nach dem Anlegen fix) |
| DELETE | `/api/entries/:id` | admin/zuständige Projektleitung/(bei Einzelproben) Ersteller/in: löscht sofort (inkl. Fotos). Probenehmer/in mit Projekt-Zugriff sonst: beantragt nur die Löschung (Status 202, Probe bleibt bestehen) |
| POST | `/api/entries/:id/cancel-delete-request` | Löschantrag zurückziehen (antragstellende Person oder wer die Probe verwaltet) |
| POST | `/api/entries/:id/approve-delete` | Löschantrag freigeben → endgültig löschen (nur wer die Probe verwaltet) |
| POST | `/api/entries/:id/reject-delete` | Löschantrag ablehnen, Probe bleibt (nur wer die Probe verwaltet) |
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
