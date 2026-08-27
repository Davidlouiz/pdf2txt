#!/usr/bin/env bash
#
# Arrête proprement le serveur web et le worker de conversion.
#
# Usage : ./stop.sh
set -euo pipefail
cd "$(dirname "$0")"

RUN_DIR=".run"
SERVER_PID="$RUN_DIR/server.pid"
WORKER_PID="$RUN_DIR/worker.pid"

stop_group() {
  local file="$1" name="$2"
  if [ -f "$file" ]; then
    local pid
    pid=$(cat "$file" 2>/dev/null || true)
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
      echo "Arrêt de $name (groupe $pid)…"
      # SIGTERM à tout le groupe de processus (setsid) pour arrêt propre.
      kill -TERM -- "-$pid" 2>/dev/null || kill -TERM "$pid" 2>/dev/null || true
      for _ in $(seq 1 20); do
        kill -0 "$pid" 2>/dev/null || break
        sleep 0.3
      done
      if kill -0 "$pid" 2>/dev/null; then
        echo "  Arrêt forcé…"
        kill -KILL -- "-$pid" 2>/dev/null || kill -KILL "$pid" 2>/dev/null || true
      fi
    fi
    rm -f "$file"
  fi
}

stop_group "$WORKER_PID" "worker"
stop_group "$SERVER_PID" "serveur"
echo "✔ Application arrêtée."
