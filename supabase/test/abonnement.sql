-- Bewijst het teamseizoen (../abonnement.sql): een team staat alleen aan met
-- een seizoen dat niet verlopen of ingetrokken is, en anders zien ouders niets
-- en gaan er geen meldingen uit.

\set ON_ERROR_STOP on

-- Het team uit test/taken.sql: JO12-2, met een teamlink. Daar staat al een seizoen bij.
delete from public.team_abonnementen where team_id = 'dddddddd-0000-0000-0000-00000000000d';

set role service_role;
do $$
declare
  team uuid := 'dddddddd-0000-0000-0000-00000000000d';
begin
  if public.team_aan(team) then raise exception 'zonder seizoen staat een team aan'; end if;

  perform public.abonnement_bij('1000000123', team, 'app.blaadje.ios.seizoen', timestamptz '2027-08-01 00:00+02', 'Sandbox', false);
  if not public.team_aan(team, timestamptz '2027-03-01') then raise exception 'met een seizoen staat het team uit'; end if;
  if public.team_aan(team, timestamptz '2027-08-02') then raise exception 'na het seizoen staat het team nog aan'; end if;

  -- een oud bericht van Apple dat later binnenkomt zet de datum niet terug
  perform public.abonnement_bij('1000000123', team, 'app.blaadje.ios.seizoen', timestamptz '2027-06-01', 'Sandbox', false);
  if not public.team_aan(team, timestamptz '2027-07-01') then raise exception 'een oud bericht zette de verloopdatum terug'; end if;

  -- terugbetaald: uit
  perform public.abonnement_bij('1000000123', team, 'app.blaadje.ios.seizoen', timestamptz '2027-08-01 00:00+02', 'Sandbox', true);
  if public.team_aan(team, timestamptz '2027-03-01') then raise exception 'een terugbetaald seizoen houdt het team aan'; end if;
  perform public.abonnement_bij('1000000123', team, 'app.blaadje.ios.seizoen', timestamptz '2027-08-01 00:00+02', 'Sandbox', false);
end $$;
reset role;

-- Niemand anders dan de serverfunctie schrijft een seizoen, en een ouder ziet het niet.
begin;
set local role anon;
do $$
begin
  begin
    perform public.abonnement_bij('nep', 'dddddddd-0000-0000-0000-00000000000d', 'x', timestamptz '2099-01-01', 'Sandbox', false);
    raise exception 'een ouder kon zelf een seizoen vastleggen';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.team_abonnementen;
    raise exception 'een ouder kan de seizoenen lezen';
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
  if s is null or s->>'abonnement_tot' is null or s ? 'gratis_tot' then
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

-- Zonder seizoen: de pagina is dicht en er gaan geen meldingen uit.
delete from public.team_abonnementen;
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
  -- En weer met een seizoen: dan gaat het gewoon.
  perform public.abonnement_bij('1000000123', 'dddddddd-0000-0000-0000-00000000000d', 'app.blaadje.ios.seizoen', now() + interval '1 year', 'Production', false);
  if jsonb_array_length(public.herinneringen(avond)) = 0 then
    raise exception 'met een seizoen gaan er geen herinneringen uit';
  end if;
end $$;
reset role;

\echo 'Seizoen: een team staat alleen aan met een geldig, niet terugbetaald seizoen'
