#!/usr/bin/env bash
#
# Point d'entrée de l'image Docker PDF to TXT.
# Lance le serveur web (Next.js) et le worker de conversion, et relance le
# worker s'il s'arrête (le serveur restant au premier plan).
set -euo pipefail
cd /app

# Worker : boucle de relance en arrière-plan.
(
  while true; do
    node_modules/.bin/tsx worker/worker.ts
    echo "[entrypoint] worker arrêté (code $?), relance dans 2 s…" >&2
    sleep 2
  done
) &
WORKER_PID=$!

# Serveur web au premier plan.
node_modules/.bin/next start -p "${PORT:-3000}" &
SERVER_PID=$!

# Transmission des signaux (docker stop → SIGTERM).
trap 'echo "[entrypoint] arrêt…"; kill "$WORKER_PID" "$SERVER_PID" 2>/dev/null || true' TERM INT

wait "$SERVER_PID"
