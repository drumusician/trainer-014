#!/usr/bin/env bash
# Draait de RLS-proef op een verse database, en ruimt die daarna op.
#
# Geen Supabase-project en geen geheimen nodig: het staketsel levert de twee
# rollen, auth.users en auth.uid(), en daarna draait de echte schema.sql.
set -euo pipefail

hier="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
db="blaadje_rls_test"

# In de CI staat de database op een aparte host; lokaal is dat Postgres.app.
# psql pikt PGHOST, PGUSER en PGPASSWORD vanzelf op, dus hier hoeft niets.
# Postgres.app zet zijn gereedschap niet in het pad; als psql daar staat,
# staan dropdb en createdb er ook.
if ! command -v psql >/dev/null; then
  export PATH="/Applications/Postgres.app/Contents/Versions/latest/bin:$PATH"
fi
psql="${PSQL:-psql}"
dropdb="${DROPDB:-dropdb}"
createdb="${CREATEDB:-createdb}"

opruimen() { "$dropdb" --if-exists "$db" >/dev/null 2>&1 || true; }
trap opruimen EXIT

opruimen
"$createdb" "$db"

"$psql" -q -v ON_ERROR_STOP=1 -d "$db" -f "$hier/supabase-staketsel.sql"
"$psql" -q -v ON_ERROR_STOP=1 -c "set client_min_messages = warning" -d "$db" -f "$hier/../schema.sql"
"$psql" -q -t -A -v ON_ERROR_STOP=1 -d "$db" -f "$hier/rls.sql"
