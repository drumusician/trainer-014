#!/usr/bin/env bash
# Draait de proef op een verse opstelling en ruimt daarna op.
# Nodig: een draaiende Docker (bijvoorbeeld `colima start`) en Xcode.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

opruimen() { docker compose down -v >/dev/null 2>&1 || true; }
trap opruimen EXIT

opruimen
docker compose up -d --wait pg-db
docker compose up -d
# De PowerSync-dienst heeft even nodig om de tabellen in te lezen.
for _ in $(seq 1 60); do
  curl -sf http://localhost:8089/probes/liveness >/dev/null && break
  sleep 1
done
sleep 5

cd Proef
swift run Proef
