# Deployment auf einer Synology-NAS — Schritt für Schritt

Diese Anleitung führt einmal komplett durch: Code auf die NAS holen, Container starten, lokal
testen, danach HTTPS/eigene Domain einrichten, absichern, Backup + Updates einrichten. Für
Hintergründe zu einzelnen Punkten (Sicherheit, Rollen, API) siehe [`README.md`](README.md) — hier
geht's nur um die konkrete Reihenfolge zum Abarbeiten.

**Least-Surprise-Reihenfolge**: erst lokal im eigenen Netz testen (Schritt 1–4), danach erst nach
aussen öffnen (Schritt 5+). So merkt ihr Probleme, bevor sie über HTTPS/Internet erreichbar sind.

## Voraussetzungen (einmalig, im DSM-Paketzentrum)

- **Container Manager** (bei älteren DSM-Versionen heisst das Paket „Docker“)
- **Git Server** (fürs Klonen des Repos direkt auf der NAS)
- SSH-Zugriff aktiviert: Systemsteuerung → Terminal & SNMP → **SSH-Dienst aktivieren**

## 1. Code auf die NAS holen

Per SSH auf die NAS verbinden (z.B. `ssh admin@<NAS-IP>`), dann:

```bash
cd /volume1/docker   # oder ein anderer Ordner eurer Wahl
git clone https://github.com/Boognsiher/Probennahmejournal.git
cd Probennahmejournal
```

**Wichtig: per `git clone`, nicht als ZIP herunterladen** — nur so lassen sich später Updates per
`git pull` bzw. `server/scripts/update.sh` einspielen (siehe Schritt 10).

Falls das Repo auf GitHub **privat** ist, fragt `git clone` per HTTPS nach Zugangsdaten — dort kein
GitHub-Passwort eingeben (funktioniert nicht mehr), sondern einen **Personal Access Token** als
Passwort verwenden (GitHub → Settings → Developer settings → Personal access tokens), oder statt
der HTTPS-URL eine SSH-URL (`git@github.com:...`) mit einem auf der NAS hinterlegten SSH-Key nutzen.

## 2. `.env` anlegen

```bash
cp server/.env.example server/.env
nano server/.env    # oder per File Station bearbeiten
```

Folgenden Inhalt einsetzen (JWT_SECRET ist bereits ein frischer, zufälliger Wert — **nicht
wiederverwenden**, falls ihr die App später noch woanders zusätzlich betreibt; `ADMIN_EMAIL`/
`ADMIN_PASSWORD`/`ADMIN_NAME` durch eure echten Werte ersetzen):

```dotenv
PORT=3000
JWT_SECRET=2f8a9b3944b7a96aeee2e09e70eb593fad7df3a7786519dde6117ced1b4a6e5c3a40490aa171f7ada8a8dceaed47e1e2
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=bitte-aendern
ADMIN_NAME=Administrator
MAX_UPLOAD_MB=15
CORS_ORIGIN=
TRUST_PROXY=
```

`ADMIN_EMAIL` ist reiner Login-Name, keine echte E-Mail nötig (z.B. auch `admin` oder ein Kürzel
möglich) — muss nur eindeutig sein. `CORS_ORIGIN`/`TRUST_PROXY` erst mal leer lassen, die tragt ihr
in Schritt 6 nach, sobald HTTPS/Domain stehen.

## 3. Container starten

**Container Manager** öffnen → **Projekt** → **Erstellen** → als Pfad den geklonten Ordner
(`.../Probennahmejournal`, dort liegt `docker-compose.yml`) wählen → Container Manager baut und
startet automatisch (entspricht `docker compose up -d --build`).

Falls Port 3000 auf der NAS schon belegt ist: in der `docker-compose.yml` die Zeile
`- "3000:3000"` auf z.B. `- "3001:3000"` ändern (linke Zahl = Port auf der NAS, rechte Zahl bleibt
3000 — das ist der Port **im** Container) und das Projekt neu bauen.

## 4. Lokal testen (noch ohne HTTPS/Internet)

Im eigenen Netz (WLAN zuhause/Büro) im Browser: `http://<NAS-IP>:3000` (bzw. der Port aus Schritt 3)
öffnen. Mit `ADMIN_EMAIL`/`ADMIN_PASSWORD` aus Schritt 2 anmelden — das ist der automatisch beim
allerersten Start angelegte Admin-Account. Kurz durchklicken: Projekt anlegen, Probe erfassen, Foto
hochladen, PDF erzeugen. Läuft das lokal sauber, weiter zu Schritt 5.

## 5. HTTPS + eigene Domain (DSM-eigener Reverse Proxy, kein extra Caddy nötig)

**Zuerst die URL festlegen** — zwei Wege, je nachdem ob ihr schon eine eigene Domain habt:

- **Ohne eigene Domain (einfachster Weg)**: Systemsteuerung → Externer Zugriff → **DDNS** → Hinzufügen
  → Anbieter „Synology“ wählen, einen Hostnamen frei wählen (z.B. `firmenname`) → ihr bekommt
  kostenlos `firmenname.synology.me`. DSM hält das automatisch aktuell, auch wenn sich eure
  öffentliche IP zuhause/im Büro ändert (normal bei den meisten Internetanschlüssen ohne feste IP).
  Das ist dann eure „Domain“ für die Schritte unten.
- **Mit eigener Domain** (z.B. `probennahmejournal.eurefirma.ch`): entweder beim Domain-Registrar
  einen **CNAME** anlegen, der auf das eben erstellte `firmenname.synology.me` zeigt (kombiniert
  eigenen Namen + automatische IP-Aktualisierung von Synology), oder — nur bei fester/statischer
  IP sinnvoll — direkt einen **A-Eintrag** auf eure öffentliche IP.

Wichtig in beiden Fällen: der **Router** muss Port 443 (HTTPS, und kurzzeitig 80 für die
Let's-Encrypt-Prüfung) an die NAS weiterleiten (Port-Weiterleitung/Port-Forwarding in den
Router-Einstellungen, „NAS-lokale-IP:443“ als Ziel) — sonst kommt von aussen nichts an, egal welche
Domain davor steht.

1. Systemsteuerung → Sicherheit → Zertifikat → **Hinzufügen** → Let's-Encrypt-Zertifikat für eure
   Domain anfordern (kostenlos, erneuert sich automatisch).
2. Systemsteuerung → Anmeldeportal → Erweitert → **Reverse-Proxy** → neue Regel:
   Quelle = eure Domain (Port 443, HTTPS), Ziel = `localhost:<Port aus Schritt 3>` (HTTP).
3. Router/Firewall: Port 443 (und ggf. 80 für die Let's-Encrypt-Challenge) auf die NAS
   weiterleiten — **nicht** die DSM-eigenen Ports 5000/5001 nach aussen öffnen.

## 6. `.env` fertig konfigurieren

Zurück in `server/.env`:

```dotenv
CORS_ORIGIN=https://eure-domain.tld
TRUST_PROXY=1
```

Danach den Container neu starten, damit die Änderung greift (Container Manager → Projekt →
**Stopp** dann **Start**, oder per SSH im Repo-Ordner: `docker compose restart`).

## 7. Absichern, falls die NAS ohnehin schon exponiert ist

- DSM-Login selbst auf **2FA** stellen (Systemsteuerung → Benutzer & Gruppe → Erweitert →
  Zwei-Faktor-Authentifizierung erzwingen).
- DSM + installierte Pakete regelmässig aktualisieren.
- Idealerweise ist der DSM-Login selbst **nicht** öffentlich erreichbar, nur die neue
  Reverse-Proxy-Regel für die App-Domain (Firewall-Regel/Anwendungsregel in DSM, die den
  DSM-Login-Port auf „nur lokales Netz“ beschränkt).

## 8. Backup einrichten

Systemsteuerung → **Aufgabenplaner** → Erstellen → Geplante Aufgabe → Benutzerdefiniertes Skript:

```bash
ONEDRIVE_BACKUP_DIR="/volume1/homes/<user>/OneDrive/Probennahmejournal-Backup" \
  /volume1/docker/Probennahmejournal/server/scripts/backup-to-onedrive.sh
```

(Pfad anpassen; setzt einen laufenden OneDrive-Client auf der NAS voraus — siehe README > Daten &
Backups für Details/Alternativen.) Zeitplan z.B. stündlich oder täglich, je nach Nutzungsintensität.

## 9. Erste echte Benutzer anlegen

In der App als Admin: Einstellungen → Benutzer → Team-Mitglieder mit passender Rolle anlegen
(Admin/Projektleitung/Probenehmer/Extern — siehe README > Rollen & Sichtbarkeit). Danach das
Admin-Bootstrap-Passwort aus Schritt 2 im Kopf behalten oder ändern (Einstellungen → Benutzer →
🔑 Passwort beim eigenen Konto).

## 10. Künftige Updates

```bash
cd /volume1/docker/Probennahmejournal
server/scripts/update.sh
```

Holt die neuesten Commits und baut/startet den Container neu — `server/data/`/`server/uploads/`
(eure Proben/Fotos/Logins) bleiben dabei unverändert erhalten. Lässt sich genauso als
Aufgabenplaner-Skript hinterlegen und bei Bedarf manuell mit „Jetzt ausführen“ anstossen, statt per
SSH. Vor grösseren Updates schadet ein frisches Backup (Schritt 8) nicht.

## Kurzreferenz / Troubleshooting

- **Logs ansehen**: Container Manager → Container → Details → Log, oder per SSH:
  `docker compose logs -f` im Repo-Ordner.
- **Container neu starten**: `docker compose restart` (im Repo-Ordner) oder über Container Manager.
- **Admin-Passwort vergessen und kein anderer Admin verfügbar**: kein Self-Service-Reset möglich
  (siehe README > Sicherheit) — als letzter Ausweg per SSH direkt in der SQLite-Datenbank
  (`server/data/probennahmejournal.sqlite`) nachsehen/reparieren, oder Container stoppen, Datenbank-
  Datei löschen (⚠️ **löscht alle Daten**, nur wenn wirklich nötig) und neu starten, damit der
  Admin-Bootstrap aus der `.env` erneut greift.
