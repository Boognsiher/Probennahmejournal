#!/usr/bin/env bash
# backup-to-onedrive.sh — sichert die SQLite-Datenbank und alle hochgeladenen
# Fotos in einen Ordner, der vom lokal installierten OneDrive-Client
# synchronisiert wird. Kein Microsoft-API-Zugang nötig — der OneDrive-
# Desktop-Client (Windows/macOS/Linux via z.B. "OneDrive Free Client")
# erledigt den eigentlichen Upload automatisch im Hintergrund, sobald
# Dateien in seinem Sync-Ordner landen.
#
# Einrichtung:
#   1. OneDrive-Client auf dem Rechner installieren, auf dem der Server läuft,
#      und mit dem gewünschten Konto anmelden.
#   2. ONEDRIVE_BACKUP_DIR unten (oder per Umgebungsvariable) auf einen
#      Unterordner *innerhalb* des OneDrive-Sync-Ordners zeigen lassen,
#      z.B. "$HOME/OneDrive/Probennahmejournal-Backup".
#   3. Dieses Skript regelmässig ausführen (siehe Cron-Beispiel unten).
#
# Aufruf:  ONEDRIVE_BACKUP_DIR=/pfad/zu/OneDrive/Ordner ./backup-to-onedrive.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

: "${ONEDRIVE_BACKUP_DIR:?Bitte ONEDRIVE_BACKUP_DIR setzen (Pfad zu einem Ordner innerhalb des OneDrive-Sync-Verzeichnisses).}"

TIMESTAMP="$(date +%Y-%m-%d_%H-%M)"
DEST="$ONEDRIVE_BACKUP_DIR/$TIMESTAMP"
mkdir -p "$DEST"

echo "[backup] Sichere Datenbank …"
if [ -f "$SERVER_DIR/data/probennahmejournal.sqlite" ]; then
  # SQLite-Online-Backup (funktioniert auch bei laufendem Server dank WAL-Modus)
  sqlite3 "$SERVER_DIR/data/probennahmejournal.sqlite" ".backup '$DEST/probennahmejournal.sqlite'"
else
  echo "[backup] Warnung: keine Datenbank-Datei gefunden unter data/probennahmejournal.sqlite" >&2
fi

echo "[backup] Sichere Fotos (uploads/) …"
if [ -d "$SERVER_DIR/uploads" ]; then
  cp -r "$SERVER_DIR/uploads" "$DEST/uploads"
fi

echo "[backup] Sichere generierte PDF-Berichte (falls vorhanden) …"
if [ -d "$SERVER_DIR/pdf-reports" ]; then
  cp -r "$SERVER_DIR/pdf-reports" "$DEST/pdf-reports"
fi

# Alte Backups aufräumen: nur die letzten N Sicherungen behalten (Default 30),
# damit der OneDrive-Sync-Ordner nicht unbegrenzt wächst.
KEEP="${ONEDRIVE_BACKUP_KEEP:-30}"
cd "$ONEDRIVE_BACKUP_DIR"
ls -1d */ 2>/dev/null | sort | head -n -"$KEEP" | xargs -r rm -rf --

echo "[backup] Fertig: $DEST"
