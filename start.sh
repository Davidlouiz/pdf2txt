#!/usr/bin/env bash
#
# Démarre l'application PDF to TXT : build Next.js, puis lance le serveur web
# et le worker de conversion en arrière-plan.
#
# Usage : ./start.sh
set -euo pipefail
cd "$(dirname "$0")"

RUN_DIR=".run"
mkdir -p "$RUN_DIR"
SERVER_PID="$RUN_DIR/server.pid"
WORKER_PID="$RUN_DIR/worker.pid"
PORT="${PORT:-3000}"

is_running() {
  [ -f "$1" ] && kill -0 "$(cat "$1" 2>/dev/null)" 2>/dev/null
}

if ! command -v pdftotext >/dev/null 2>&1; then
  echo "✖ pdftotext introuvable. Installez poppler-utils (ex. : sudo apt install poppler-utils)."
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "✖ Dépendances absentes. Lancez d'abord : npm install"
  exit 1
fi

if is_running "$SERVER_PID"; then
  echo "✖ Le serveur tourne déjà (PID $(cat "$SERVER_PID")). Utilisez ./restart.sh ou ./stop.sh."
  exit 1
fi

echo "▶ Build du projet Next.js…"
if ! npm run build > "$RUN_DIR/build.log" 2>&1; then
  echo "✖ Build échoué. Voir $RUN_DIR/build.log"
  exit 1
fi

echo "▶ Démarrage du serveur web (port $PORT)…"
setsid ./node_modules/.bin/next start > "$RUN_DIR/server.log" 2>&1 < /dev/null &
echo $! > "$SERVER_PID"

echo "▶ Démarrage du worker de conversion…"
setsid ./node_modules/.bin/tsx worker/worker.ts > "$RUN_DIR/worker.log" 2>&1 < /dev/null &
echo $! > "$WORKER_PID"

sleep 1
echo "✔ Application démarrée : http://localhost:$PORT"
echo "  Logs  : $RUN_DIR/server.log , $RUN_DIR/worker.log"
echo "  Arrêt : ./stop.sh   ·   Redémarrage : ./restart.sh"
