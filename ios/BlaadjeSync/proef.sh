#!/usr/bin/env bash
# Draait de tests van de koppeling tegen een verse lokale opstelling (Postgres,
# PostgREST en de PowerSync-dienst uit proef/powersync) en ruimt daarna op.
# Nodig: een draaiende Docker (bijvoorbeeld `colima start`).
set -euo pipefail
hier="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$hier/../../proef/powersync"
opruimen() { docker compose down -v >/dev/null 2>&1 || true; }
trap opruimen EXIT
opruimen
docker compose up -d --wait pg-db
docker compose up -d
for _ in $(seq 1 60); do curl -sf http://localhost:8089/probes/liveness >/dev/null && break; sleep 1; done
sleep 5
cd "$hier"
swift test "$@"
