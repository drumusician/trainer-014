#!/usr/bin/env bash
# Draait de webapp tegen een verse lokale database met het echte model en
# PostgREST (uit proef/powersync), en ruimt daarna op. Zie
# src/lib/supabase/proef.test.ts. Nodig: een draaiende Docker (bijvoorbeeld
# `colima start`).
set -euo pipefail
hier="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$hier/../proef/powersync"
opruimen() { docker compose down -v >/dev/null 2>&1 || true; }
trap opruimen EXIT
opruimen
docker compose up -d --wait pg-db
docker compose up -d rest
for _ in $(seq 1 60); do curl -sf http://localhost:3055/ >/dev/null && break; sleep 1; done
cd "$hier"
PROEF_REST=http://localhost:3055 npx vitest run src/lib/supabase/proef.test.ts "$@"
