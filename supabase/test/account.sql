-- Bewijst ../account.sql: wie zijn account verwijdert, is weg, met de teams waar
-- hij de enige trainer was. Een team met nog een trainer blijft staan, met een
-- nieuwe eigenaar.

\set ON_ERROR_STOP on

insert into auth.users (id, email) values
  ('a0000000-0000-4000-8000-00000000000a', 'weg@voorbeeld.nl'),
  ('b0000000-0000-4000-8000-00000000000b', 'blijft@voorbeeld.nl'),
  ('c0000000-0000-4000-8000-00000000000c', 'ander@voorbeeld.nl');

-- Alleen: het team van de trainer die weggaat, met een speler erin.
insert into public.teams (id, naam, eigenaar) values
  ('a1000000-0000-4000-8000-000000000001', 'Alleen', 'a0000000-0000-4000-8000-00000000000a'),
  ('a2000000-0000-4000-8000-000000000002', 'Samen', 'a0000000-0000-4000-8000-00000000000a'),
  ('c3000000-0000-4000-8000-000000000003', 'Van een ander', 'c0000000-0000-4000-8000-00000000000c');
insert into public.spelers (id, team_id, naam) values
  ('a1000000-0000-4000-8000-0000000000f1', 'a1000000-0000-4000-8000-000000000001', 'Bram'),
  ('a2000000-0000-4000-8000-0000000000f2', 'a2000000-0000-4000-8000-000000000002', 'Sem');
insert into public.team_leden (team_id, gebruiker, rol, toegevoegd) values
  ('a2000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-00000000000b', 'trainer', now() + interval '1 minute'),
  ('a2000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-00000000000c', 'trainer', now() + interval '2 minutes'),
  ('c3000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-00000000000a', 'trainer', now());
insert into public.uitnodigingen (team_id, email, door) values
  ('a2000000-0000-4000-8000-000000000002', 'nog@voorbeeld.nl', 'a0000000-0000-4000-8000-00000000000a');

-- Zonder inloggen kan niemand een account verwijderen.
begin;
set local role anon;
do $$ begin
  begin
    perform public.verwijder_account();
    raise exception 'zonder inloggen kon er een account weg';
  exception when insufficient_privilege then null;
  end;
end $$;
rollback;

-- Ingelogd maar zonder gebruiker in het token: ook niet.
begin;
set local role authenticated;
do $$ begin
  begin
    perform public.verwijder_account();
    raise exception 'zonder gebruiker in het token kon er een account weg';
  exception when insufficient_privilege then null;
  end;
end $$;
rollback;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-00000000000a"}';
select public.verwijder_account();
commit;

do $$ begin
  if exists (select 1 from auth.users where id = 'a0000000-0000-4000-8000-00000000000a') then
    raise exception 'de gebruiker staat er nog';
  end if;
  if exists (select 1 from public.teams where id = 'a1000000-0000-4000-8000-000000000001') then
    raise exception 'het team waar hij de enige trainer was, staat er nog';
  end if;
  if exists (select 1 from public.spelers where id = 'a1000000-0000-4000-8000-0000000000f1') then
    raise exception 'de spelers van dat team staan er nog';
  end if;
  if (select eigenaar from public.teams where id = 'a2000000-0000-4000-8000-000000000002')
     is distinct from 'b0000000-0000-4000-8000-00000000000b' then
    raise exception 'het gedeelde team kreeg niet de langstzittende trainer als eigenaar';
  end if;
  if (select rol from public.team_leden where team_id = 'a2000000-0000-4000-8000-000000000002'
       and gebruiker = 'b0000000-0000-4000-8000-00000000000b') <> 'eigenaar' then
    raise exception 'de nieuwe eigenaar heeft de rol niet';
  end if;
  if not exists (select 1 from public.spelers where id = 'a2000000-0000-4000-8000-0000000000f2') then
    raise exception 'de spelers van het gedeelde team zijn weg';
  end if;
  if (select eigenaar from public.teams where id = 'c3000000-0000-4000-8000-000000000003')
     is distinct from 'c0000000-0000-4000-8000-00000000000c' then
    raise exception 'het team van een ander veranderde van eigenaar';
  end if;
  if exists (select 1 from public.team_leden where gebruiker = 'a0000000-0000-4000-8000-00000000000a') then
    raise exception 'hij is nog lid van een team';
  end if;
  if exists (select 1 from public.uitnodigingen where email = 'nog@voorbeeld.nl') then
    raise exception 'zijn uitnodigingen staan er nog';
  end if;
end $$;
