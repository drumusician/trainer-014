#!/usr/bin/env bash
# Draait schema.sql, model.sql en powersync.sql op een verse database en gaat na
# dat de rol voor PowerSync leest wat hij moet lezen, en niets daarbuiten.
set -euo pipefail
hier="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
db="blaadje_powersync_test"
command -v psql >/dev/null || export PATH="/Applications/Postgres.app/Contents/Versions/latest/bin:$PATH"
opruimen() { dropdb --if-exists "$db" >/dev/null 2>&1 || true; psql -q -d postgres -c "drop role if exists powersync_role" >/dev/null 2>&1 || true; }
trap opruimen EXIT
opruimen
createdb "$db"
q() { psql -q -t -A -v ON_ERROR_STOP=1 -d "$db" "$@"; }
q -f "$hier/supabase-staketsel.sql"
q -c "set client_min_messages = warning" -f "$hier/../schema.sql"
q -c "set client_min_messages = warning" -f "$hier/../model.sql"

# Zonder wachtwoord hoort het script te weigeren.
if q -f "$hier/../powersync.sql" >/dev/null 2>&1; then echo "FOUT: draaide zonder wachtwoord"; exit 1; fi
echo "ok  weigert zonder wachtwoord"

sed "s/v_wachtwoord text := 'VERVANG-DIT'/v_wachtwoord text := 'een-proefwachtwoord-van-genoeg-tekens'/" "$hier/../powersync.sql" > "$hier/.powersync-proef.sql"
trap 'rm -f "$hier/.powersync-proef.sql"; opruimen' EXIT
q -f "$hier/.powersync-proef.sql"
q -f "$hier/.powersync-proef.sql"
echo "ok  draait, en is te herhalen"

[ "$(q -c "select count(*) from pg_publication_tables where pubname = 'powersync'")" = "9" ] || { echo "FOUT: niet negen tabellen in de lijst"; exit 1; }
echo "ok  negen tabellen in de lijst"

for t in teams team_leden team_instellingen spelers wedstrijden wedstrijd_spelers gebeurtenissen trainingen training_spelers; do
  q -c "set role powersync_role; select count(*) from public.$t" >/dev/null || { echo "FOUT: kan $t niet lezen"; exit 1; }
done
echo "ok  leest de negen tabellen"

for t in team_toestand uitnodigingen deellinks bijdragen; do
  if q -c "set role powersync_role; select count(*) from public.$t" >/dev/null 2>&1; then echo "FOUT: kan $t lezen"; exit 1; fi
done
echo "ok  kan niet bij team_toestand, uitnodigingen, deellinks en bijdragen"

if q -c "set role powersync_role; insert into public.teams (id, naam) values (gen_random_uuid(), 'x')" >/dev/null 2>&1; then echo "FOUT: kan schrijven"; exit 1; fi
echo "ok  kan niets schrijven"
