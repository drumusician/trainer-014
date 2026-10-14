-- Bewijst het teamabonnement (../abonnement.sql): tot de winterstop staat elk
-- team aan, daarna alleen met een abonnement dat niet verlopen of ingetrokken is,
-- en dan zien ouders niets en gaan er geen meldingen uit.

\set ON_ERROR_STOP on

-- Het team uit test/taken.sql: JO12-2, met een teamlink.
set role service_role;
do $$
declare
  team uuid := 'dddddddd-0000-0000-0000-00000000000d';
begin
  if not public.team_aan(team, timestamptz '2026-12-01') then raise exception 'in de gratis periode staat een team uit'; end if;
  if public.team_aan(team, timestamptz '2027-03-01') then raise exception 'na de gratis periode staat een team zonder abonnement aan'; end if;

  perform public.abonnement_bij('1000000123', team, 'app.blaadje.ios.team', timestamptz '2027-10-01', 'Sandbox', false);
  if not public.team_aan(team, timestamptz '2027-03-01') then raise exception 'met een abonnement staat het team uit'; end if;
  if public.team_aan(team, timestamptz '2027-10-02') then raise exception 'een verlopen abonnement houdt het team aan'; end if;

  -- een oud bericht van Apple dat later binnenkomt zet de datum niet terug
  perform public.abonnement_bij('1000000123', team, 'app.blaadje.ios.team', timestamptz '2027-06-01', 'Sandbox', false);
  if not public.team_aan(team, timestamptz '2027-08-01') then raise exception 'een oud bericht zette de verloopdatum terug'; end if;

  -- terugbetaald: uit
  perform public.abonnement_bij('1000000123', team, 'app.blaadje.ios.team', timestamptz '2027-10-01', 'Sandbox', true);
  if public.team_aan(team, timestamptz '2027-03-01') then raise exception 'een ingetrokken abonnement houdt het team aan'; end if;
  perform public.abonnement_bij('1000000123', team, 'app.blaadje.ios.team', timestamptz '2027-10-01', 'Sandbox', false);
end $$;
reset role;

-- Niemand anders dan de serverfunctie schrijft een abonnement, en een ouder ziet het niet.
begin;
set local role anon;
do $$
begin
  begin
    perform public.abonnement_bij('nep', 'dddddddd-0000-0000-0000-00000000000d', 'x', timestamptz '2099-01-01', 'Sandbox', false);
    raise exception 'een ouder kon zelf een abonnement vastleggen';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.team_abonnementen;
    raise exception 'een ouder kan de abonnementen lezen';
  exception when insufficient_privilege then null;
  end;
end $$;
commit;

-- De trainer ziet de stand van zijn eigen team, een ander niet.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"77777777-7777-7777-7777-777777777777"}';
do $$
declare s jsonb := public.team_status('dddddddd-0000-0000-0000-00000000000d');
begin
  if s is null or (s->>'aan')::boolean is not true or s->>'abonnement_tot' is null then
    raise exception 'de trainer ziet de stand van zijn team niet goed: %', s;
  end if;
end $$;
commit;
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"78787878-7878-7878-7878-787878787878"}';
do $$
begin
  if public.team_status('dddddddd-0000-0000-0000-00000000000d') is not null then
    raise exception 'een ander ziet of het team betaald heeft';
  end if;
end $$;
commit;

-- Na de gratis periode en zonder abonnement: de pagina is dicht en er gaan geen meldingen uit.
delete from public.team_abonnementen;
set blaadje.gratis_tot = '2020-01-01';
begin;
set local role anon;
do $$
declare p jsonb := public.volgpagina('teamlink-jo12-0123456789', 'telefoon-noah-0123456789abcdef0123456789');
begin
  if (p->>'aan')::boolean is not false then raise exception 'de pagina zegt niet dat het team uit staat: %', p; end if;
  if jsonb_array_length(p->'wedstrijden') <> 0 or p::text like '%Noah%' then
    raise exception 'met het team uit staat er toch iets op de pagina: %', p;
  end if;
  if p->>'team' <> 'JO12-2' then raise exception 'de naam van het team ontbreekt'; end if;
end $$;
commit;

delete from public.meldingen;
update public.wedstrijden set status = 'gepland', datum = current_date + 1 where id = 'd2000000-0000-0000-0000-000000000001';
set role service_role;
do $$
declare
  avond timestamptz := (current_date + time '19:30') at time zone 'Europe/Amsterdam';
begin
  if jsonb_array_length(public.herinneringen(avond)) <> 0 then
    raise exception 'met het team uit gaan er toch herinneringen uit';
  end if;
end $$;
reset role;

-- En weer met een abonnement: dan gaat het gewoon.
set role service_role;
do $$
declare
  avond timestamptz := (current_date + time '19:30') at time zone 'Europe/Amsterdam';
begin
  perform public.abonnement_bij('1000000123', 'dddddddd-0000-0000-0000-00000000000d', 'app.blaadje.ios.team', now() + interval '1 year', 'Production', false);
  if jsonb_array_length(public.herinneringen(avond)) = 0 then
    raise exception 'met een abonnement gaan er geen herinneringen uit';
  end if;
end $$;
reset role;
reset blaadje.gratis_tot;

\echo 'Abonnement: gratis tot de winterstop, daarna alleen met een geldig abonnement'
