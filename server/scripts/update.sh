#!/usr/bin/env bash
# update.sh — holt die neueste Version aus Git und baut/startet den
# Docker-Container neu. Für den Docker-Betrieb (siehe README > Deployment,
# z.B. Synology Container Manager per SSH oder als Aufgabenplaner-Skript).
#
# Proben, Fotos und Login-Daten bleiben dabei erhalten — server/data/ und
# server/uploads/ sind als Bind-Mounts eingebunden (siehe docker-compose.yml)
# und werden von einem Image-Rebuild nicht angerührt. Trotzdem: vor grösseren
# Updates ein aktuelles Backup nicht schaden lassen (backup-to-onedrive.sh).
#
# Voraussetzung: das Repo wurde ursprünglich per "git clone" auf die
# NAS/den Server gebracht (nicht als ZIP entpackt) — sonst gibt es hier
# nichts zum "git pull".
#
# Aufruf:  ./update.sh   (im Repo-Root oder von hier aus, Pfad wird erkannt)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT"

if [ ! -d .git ]; then
  echo "[update] Kein Git-Repo unter $REPO_ROOT gefunden — wurde das Repo per 'git clone' angelegt" >&2
  echo "[update] (nicht als ZIP heruntergeladen)? Ohne Git-Historie kann hier nichts aktualisiert werden." >&2
  exit 1
fi

CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
echo "[update] Aktueller Branch: $CURRENT_BRANCH"

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "[update] Achtung: es gibt lokale, nicht committete Änderungen im Repo-Checkout." >&2
  echo "[update] Das sollte auf einem Deployment-Checkout normalerweise nicht vorkommen — bitte prüfen." >&2
  exit 1
fi

echo "[update] Hole neueste Version …"
git fetch origin "$CURRENT_BRANCH"
git merge --ff-only "origin/$CURRENT_BRANCH"

echo "[update] Baue Docker-Image neu und starte Container neu …"
docker compose up -d --build

echo "[update] Fertig. Log der letzten Zeilen:"
docker compose logs --tail=20 probennahmejournal
