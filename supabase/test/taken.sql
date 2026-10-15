-- Bewijst het programma en de taken (../taken.sql): een ouder kiest zijn kind,
-- ziet de taken, kan alleen zijn eigen taak teruggeven en alleen een open taak
-- overnemen, en elke herinnering gaat hooguit één keer de deur uit.

\set ON_ERROR_STOP on

insert into auth.users (id, email) values ('77777777-7777-7777-7777-777777777777', 'dirk@voorbeeld.nl');

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"77777777-7777-7777-7777-777777777777","email":"dirk@voorbeeld.nl"}';

insert into public.teams (id, naam, eigenaar)
values ('dddddddd-0000-0000-0000-00000000000d', 'JO12-2', '77777777-7777-7777-7777-777777777777');
insert into public.spelers (id, team_id, naam) values
  ('d1000000-0000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-00000000000d', 'Sem'),
  ('d1000000-0000-0000-0000-000000000002', 'dddddddd-0000-0000-0000-00000000000d', 'Noah'),
  ('d1000000-0000-0000-0000-000000000003', 'dddddddd-0000-0000-0000-00000000000d', 'Luuk');

-- Morgen thuis tegen Ajax, uit het programma: geen klok. En een wedstrijd die
-- nu loopt, vijf minuten voor de rust.
insert into public.wedstrijden (id, team_id, datum, aanvang, tegenstander, thuis, status, delen, minuten_per_deel, klok) values
  ('d2000000-0000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-00000000000d', current_date + 1, '10:30', 'Ajax', true, 'gepland', 2, 35, null),
  ('d2000000-0000-0000-0000-000000000002', 'dddddddd-0000-0000-0000-00000000000d', current_date, '09:00', 'PSV', true, 'bezig', 2, 35,
   jsonb_build_object('elapsed', 1800, 'since', extract(epoch from now()) * 1000 - 0, 'running', true, 'part', 1, 'inBreak', false, 'finished', false));

insert into public.taken (id, team_id, wedstrijd_id, soort, speler_id) values
  ('d3000000-0000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-00000000000d', 'd2000000-0000-0000-0000-000000000001', 'limonade', 'd1000000-0000-0000-0000-000000000001'),
  ('d3000000-0000-0000-0000-000000000002', 'dddddddd-0000-0000-0000-00000000000d', 'd2000000-0000-0000-0000-000000000001', 'vlaggen', 'd1000000-0000-0000-0000-000000000002'),
  ('d3000000-0000-0000-0000-000000000003', 'dddddddd-0000-0000-0000-00000000000d', 'd2000000-0000-0000-0000-000000000001', 'rijden', null),
  ('d3000000-0000-0000-0000-000000000004', 'dddddddd-0000-0000-0000-00000000000d', 'd2000000-0000-0000-0000-000000000002', 'limonade', 'd1000000-0000-0000-0000-000000000003'),
  ('d3000000-0000-0000-0000-000000000006', 'dddddddd-0000-0000-0000-00000000000d', 'd2000000-0000-0000-0000-000000000001', 'velddienst', null);
-- Thuis fluit een scheidsrechter van de club.
insert into public.taken (id, team_id, wedstrijd_id, soort, vereniging) values
  ('d3000000-0000-0000-0000-000000000005', 'dddddddd-0000-0000-0000-00000000000d', 'd2000000-0000-0000-0000-000000000001', 'fluiten', true);

insert into public.deellinks (id, team_id, speler_id, code) values
  ('d4000000-0000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-00000000000d', null, 'teamlink-jo12-0123456789');
commit;

-- Het team heeft het seizoen gekocht (abonnement.sql); zonder dat ziet een ouder niets.
select public.abonnement_bij('seizoen-JO12-2', 'dddddddd-0000-0000-0000-00000000000d', 'app.blaadje.ios.seizoen', now() + interval '1 year', 'Sandbox', false);

-- Een tijd die geen tijd is, gaat er niet in.
do $$
begin
  begin
    update public.wedstrijden set aanvang = '25:00' where id = 'd2000000-0000-0000-0000-000000000001';
    raise exception 'een aanvang van 25:00 werd aangenomen';
  exception when check_violation then null;
  end;
end $$;

-- Wie niet bij het team hoort, zet er geen taak bij.
insert into auth.users (id, email) values ('78787878-7878-7878-7878-787878787878', 'vreemd@voorbeeld.nl');
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"78787878-7878-7878-7878-787878787878"}';
do $$
begin
  begin
    insert into public.taken (id, team_id, wedstrijd_id, soort)
    values ('d3000000-0000-0000-0000-0000000000ff', 'dddddddd-0000-0000-0000-00000000000d', 'd2000000-0000-0000-0000-000000000001', 'fluiten');
    raise exception 'een vreemde kon een taak bij het team zetten';
  exception when insufficient_privilege then null;
  end;
  if exists (select 1 from public.taken) then raise exception 'een vreemde ziet de taken van het team'; end if;
end $$;
commit;

-- ---------- een ouder kiest zijn kind ----------
begin;
set local role anon;
do $$
declare p jsonb;
begin
  -- de ouder van Sem kiest bij het volgen, die van Noah daarna, die van Luuk ook, opa kiest niet
  if not public.volg('teamlink-jo12-0123456789', 'telefoon-sem-0123456789abcdef0123456789', 'echt', 'd1000000-0000-0000-0000-000000000001') then
    raise exception 'volgen met een kind lukte niet';
  end if;
  perform public.volg('teamlink-jo12-0123456789', 'telefoon-noah-0123456789abcdef0123456789');
  if not public.kies_kind('teamlink-jo12-0123456789', 'telefoon-noah-0123456789abcdef0123456789', 'd1000000-0000-0000-0000-000000000002') then
    raise exception 'later een kind kiezen lukte niet';
  end if;
  perform public.volg('teamlink-jo12-0123456789', 'telefoon-luuk-0123456789abcdef0123456789', 'echt', 'd1000000-0000-0000-0000-000000000003');
  perform public.volg('teamlink-jo12-0123456789', 'telefoon-opa-00123456789abcdef0123456789');
  -- een kind van een ander team kies je niet
  if public.kies_kind('teamlink-jo12-0123456789', 'telefoon-opa-00123456789abcdef0123456789', 'e0000000-0000-0000-0000-000000000001') then
    raise exception 'een kind van een ander team kon gekozen worden';
  end if;
  -- opnieuw volgen zonder kind laat het gekozen kind staan
  perform public.volg('teamlink-jo12-0123456789', 'telefoon-sem-0123456789abcdef0123456789');

  p := public.volgpagina('teamlink-jo12-0123456789', 'telefoon-sem-0123456789abcdef0123456789');
  if p->'mijn_kind'->>'naam' <> 'Sem' then raise exception 'het gekozen kind staat er niet: %', p->'mijn_kind'; end if;
  if jsonb_array_length(p->'spelers') <> 3 then raise exception 'om te kiezen staan niet alle kinderen erop'; end if;
  if not exists (
    select 1 from jsonb_array_elements(p->'wedstrijden') w, jsonb_array_elements(w->'taken') t
     where w->>'tegenstander' = 'Ajax' and w->>'aanvang' = '10:30' and t->>'soort' = 'limonade' and (t->>'van_mij')::boolean and t->>'wie' = 'Sem'
  ) then raise exception 'de limonade van Sem staat niet als zijn taak op de pagina: %', p->'wedstrijden'; end if;
  if exists (
    select 1 from jsonb_array_elements(p->'wedstrijden') w, jsonb_array_elements(w->'taken') t
     where t->>'soort' = 'vlaggen' and (t->>'van_mij')::boolean
  ) then raise exception 'de taak van Noah staat als die van Sem'; end if;

  p := public.volgpagina('teamlink-jo12-0123456789');
  if p->'mijn_kind' <> 'null'::jsonb then raise exception 'zonder telefoon toch een kind: %', p->'mijn_kind'; end if;
end $$;
commit;

-- ---------- de herinneringen ----------
set role service_role;
do $$
declare
  avond timestamptz := (current_date + time '19:30') at time zone 'Europe/Amsterdam';
  ochtend timestamptz := (current_date + time '08:00') at time zone 'Europe/Amsterdam';
  h jsonb;
begin
  h := public.herinneringen(ochtend);
  if exists (select 1 from jsonb_array_elements(h) m where m->>'titel' like 'Morgen%') then
    raise exception 's ochtends al een herinnering voor morgen';
  end if;

  h := public.herinneringen(avond);
  if not exists (select 1 from jsonb_array_elements(h) m
                  where m->>'titel' = 'Morgen tegen Ajax, 10:30' and m->>'tekst' = 'Jullie doen de limonade.'
                    and m->'tokens' @> '[{"token":"telefoon-sem-0123456789abcdef0123456789"}]'
                    and jsonb_array_length(m->'tokens') = 1) then
    raise exception 'Sem krijgt de avond ervoor geen herinnering, of iemand anders ook: %', h;
  end if;
  if not exists (select 1 from jsonb_array_elements(h) m
                  where m->>'tekst' = 'Jullie doen vlaggen.' and m->'tokens' @> '[{"token":"telefoon-noah-0123456789abcdef0123456789"}]') then
    raise exception 'Noah krijgt geen herinnering: %', h;
  end if;
  if h::text like '%telefoon-opa%' then raise exception 'opa krijgt een herinnering voor een taak die niet van hem is'; end if;
  if (select count(*) from jsonb_array_elements(public.herinneringen(avond)) m where m->>'titel' like 'Morgen%') <> 0 then
    raise exception 'de herinnering voor morgen komt twee keer';
  end if;
end $$;

-- limonade: de rust is over vijf minuten
do $$
declare h jsonb := public.herinneringen();
begin
  if not exists (select 1 from jsonb_array_elements(h) m
                  where m->>'titel' = 'Bijna rust' and m->'tokens' = '[{"token":"telefoon-luuk-0123456789abcdef0123456789","omgeving":"echt"}]'::jsonb) then
    raise exception 'de familie van Luuk krijgt geen melding voor de limonade: %', h;
  end if;
  if exists (select 1 from jsonb_array_elements(public.herinneringen()) m where m->>'titel' = 'Bijna rust') then
    raise exception 'de limonademelding komt twee keer';
  end if;
end $$;
-- en niet als de rust nog ver weg is
reset role;
update public.wedstrijden set klok = jsonb_set(klok, '{elapsed}', '60') where id = 'd2000000-0000-0000-0000-000000000002';
delete from public.meldingen where sleutel like 'limonade|%';
set role service_role;
do $$
begin
  if exists (select 1 from jsonb_array_elements(public.herinneringen()) m where m->>'titel' = 'Bijna rust') then
    raise exception 'de limonademelding komt al aan het begin van de wedstrijd';
  end if;
end $$;
reset role;

-- ---------- kan niet, doe ik ----------
begin;
set local role anon;
do $$
begin
  -- Sem kan de taak van Noah niet teruggeven
  if public.taak_kan_niet('teamlink-jo12-0123456789', 'telefoon-sem-0123456789abcdef0123456789', 'd3000000-0000-0000-0000-000000000002') then
    raise exception 'iemand gaf de taak van een ander terug';
  end if;
  -- opa heeft geen kind gekozen en kan niets
  if public.taak_doe_ik('teamlink-jo12-0123456789', 'telefoon-opa-00123456789abcdef0123456789', 'd3000000-0000-0000-0000-000000000003') then
    raise exception 'zonder kind een taak overgenomen';
  end if;
  -- Sem kan niet, en geeft de limonade terug
  if not public.taak_kan_niet('teamlink-jo12-0123456789', 'telefoon-sem-0123456789abcdef0123456789', 'd3000000-0000-0000-0000-000000000001') then
    raise exception 'je eigen taak teruggeven lukte niet';
  end if;
end $$;
commit;

do $$
declare t public.taken%rowtype;
begin
  select * into t from public.taken where id = 'd3000000-0000-0000-0000-000000000001';
  if t.speler_id is not null or t.afgemeld_door <> 'd1000000-0000-0000-0000-000000000001' then
    raise exception 'na kan niet staat de taak niet open met wie niet kon: %', t;
  end if;
end $$;

-- de rest van het team hoort dat de limonade open staat, Sem niet
set role service_role;
do $$
declare h jsonb := public.herinneringen();
begin
  if not exists (select 1 from jsonb_array_elements(h) m
                  where m->>'titel' = 'Kan iemand de limonade doen?'
                    and m->'tokens' @> '[{"token":"telefoon-noah-0123456789abcdef0123456789"}]'
                    and not m->'tokens' @> '[{"token":"telefoon-sem-0123456789abcdef0123456789"}]') then
    raise exception 'het team hoort niet dat de limonade open staat, of Sem hoort het ook: %', h;
  end if;
  if exists (select 1 from jsonb_array_elements(public.herinneringen()) m where m->>'titel' like 'Kan iemand%') then
    raise exception 'de vraag om de limonade komt twee keer';
  end if;
end $$;
reset role;

begin;
set local role anon;
do $$
begin
  if not public.taak_doe_ik('teamlink-jo12-0123456789', 'telefoon-noah-0123456789abcdef0123456789', 'd3000000-0000-0000-0000-000000000001') then
    raise exception 'een open taak overnemen lukte niet';
  end if;
  -- en nu is hij niet meer open
  if public.taak_doe_ik('teamlink-jo12-0123456789', 'telefoon-luuk-0123456789abcdef0123456789', 'd3000000-0000-0000-0000-000000000001') then
    raise exception 'een taak die al vergeven was werd nog eens overgenomen';
  end if;
end $$;
commit;

do $$
begin
  if (select speler_id from public.taken where id = 'd3000000-0000-0000-0000-000000000001') <> 'd1000000-0000-0000-0000-000000000002' then
    raise exception 'de limonade staat niet bij Noah';
  end if;
  if (select afgemeld_door from public.taken where id = 'd3000000-0000-0000-0000-000000000001') is not null then
    raise exception 'na overnemen staat er nog dat iemand niet kon';
  end if;
end $$;

-- de vereniging fluit: dat ziet een ouder, en niemand kan het overnemen
begin;
set local role anon;
do $$
declare p jsonb := public.volgpagina('teamlink-jo12-0123456789', 'telefoon-luuk-0123456789abcdef0123456789');
begin
  if not exists (
    select 1 from jsonb_array_elements(p->'wedstrijden') w, jsonb_array_elements(w->'taken') t
     where t->>'soort' = 'fluiten' and t->>'wie' = 'Vereniging'
  ) then
    raise exception 'een ouder ziet niet dat de vereniging fluit: %', p;
  end if;
  if public.taak_doe_ik('teamlink-jo12-0123456789', 'telefoon-luuk-0123456789abcdef0123456789', 'd3000000-0000-0000-0000-000000000005') then
    raise exception 'een ouder nam het fluiten van de vereniging over';
  end if;
end $$;
commit;

-- een afgelopen wedstrijd: daar verandert niemand meer iets aan
update public.wedstrijden set status = 'afgelopen' where id = 'd2000000-0000-0000-0000-000000000002';
begin;
set local role anon;
do $$
begin
  if public.taak_kan_niet('teamlink-jo12-0123456789', 'telefoon-luuk-0123456789abcdef0123456789', 'd3000000-0000-0000-0000-000000000004') then
    raise exception 'een taak bij een afgelopen wedstrijd teruggegeven';
  end if;
end $$;
commit;

\echo 'Taken: kind kiezen, alleen je eigen taak terug, open taken overnemen, herinneringen één keer'
