-- Het stukje Supabase dat schema.sql nodig heeft, nagebouwd voor een gewone
-- Postgres. Zo kan de echte schema.sql hieronder draaien zonder dat er een
-- Supabase-project of een geheim aan te pas komt.
--
-- Alleen wat de regels raken: de twee rollen, de tabel met gebruikers, en
-- auth.uid(). Die laatste leest het token precies zoals Supabase dat doet, dus
-- een test kan zich voordoen als een ingelogde trainer door de claims te zetten.

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end $$;

create schema if not exists auth;

create table if not exists auth.users (
  id    uuid primary key default gen_random_uuid(),
  email text unique
);

-- De nullif staat om de instelling heen en niet om het resultaat: zodra een
-- transactie met 'set local' afgelopen is, staat er een lege tekst in plaats van
-- niets, en dan struikelt het ontleden. Supabase vangt dat op dezelfde manier af.
create or replace function auth.uid() returns uuid
language sql stable
as $$
  select nullif(nullif(current_setting('request.jwt.claims', true), '')::json ->> 'sub', '')::uuid;
$$;

grant usage on schema public to anon, authenticated;
grant usage on schema auth   to anon, authenticated;
