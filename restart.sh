#!/usr/bin/env bash
#
# Redémarre l'application PDF to TXT (serveur web + worker).
#
# Usage : ./restart.sh
set -euo pipefail
cd "$(dirname "$0")"

./stop.sh
./start.sh
