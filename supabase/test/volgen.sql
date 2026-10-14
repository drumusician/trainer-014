-- Bewijst wat een volger ziet en krijgt (../volgen.sql): alleen via de link van
-- een kind, nooit speeltijd of notities, en per gebeurtenis hooguit één melding.

\set ON_ERROR_STOP on

insert into auth.users (id, email) values ('66666666-6666-6666-6666-666666666666', 'carla@voorbeeld.nl');

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"66666666-6666-6666-6666-666666666666","email":"carla@voorbeeld.nl"}';

insert into public.teams (id, naam, eigenaar)
values ('cccccccc-0000-0000-0000-00000000000c', 'JO14-1', '66666666-6666-6666-6666-666666666666');
insert into public.spelers (id, team_id, naam) values
  ('e0000000-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-00000000000c', 'Sem'),
  ('e0000000-0000-0000-0000-000000000002', 'cccccccc-0000-0000-0000-00000000000c', 'Noah');

-- Een wedstrijd die loopt, uit; een van weken geleden die al klaar is; en een training.
insert into public.wedstrijden (id, team_id, datum, tegenstander, thuis, status, delen, notitie, doelpunten_voor, doelpunten_tegen) values
  ('f0000000-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-00000000000c', current_date, 'Sparta', false, 'bezig', 2, 'GEHEIM', 1, 0),
  ('f0000000-0000-0000-0000-000000000002', 'cccccccc-0000-0000-0000-00000000000c', current_date, 'Excelsior', true, 'afgelopen', 2, null, 3, 1),
  ('f0000000-0000-0000-0000-000000000003', 'cccccccc-0000-0000-0000-00000000000c', current_date, 'Feyenoord', true, 'gepland', 2, null, 0, 0);
insert into public.wedstrijd_spelers (id, team_id, wedstrijd_id, speler_id, naam, seconden) values
  ('f1000000-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-00000000000c', 'f0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'Sem', 1234);
insert into public.trainingen (id, team_id, datum) values ('f2000000-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-00000000000c', current_date);
insert into public.training_spelers (id, team_id, training_id, speler_id, status) values
  ('f3000000-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-00000000000c', 'f2000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'afgemeld'),
  ('f3000000-0000-0000-0000-000000000002', 'cccccccc-0000-0000-0000-00000000000c', 'f2000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000002', 'aanwezig');

insert into public.deellinks (id, team_id, speler_id, code) values
  ('f4000000-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-00000000000c', 'e0000000-0000-0000-0000-000000000001', 'code-van-sem-0123456789'),
  ('f4000000-0000-0000-0000-000000000002', 'cccccccc-0000-0000-0000-00000000000c', 'e0000000-0000-0000-0000-000000000002', 'code-van-noah-0123456789');

insert into public.gebeurtenissen (id, team_id, wedstrijd_id, soort, t, deel, speler, assist, erin, eruit) values
  ('f5000000-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-00000000000c', 'f0000000-0000-0000-0000-000000000001', 'aftrap', 0, null, null, null, null, null),
  ('f5000000-0000-0000-0000-000000000002', 'cccccccc-0000-0000-0000-00000000000c', 'f0000000-0000-0000-0000-000000000001', 'doelpunt', 600, null, 'e0000000-0000-0000-0000-000000000001', null, null, null),
  ('f5000000-0000-0000-0000-000000000003', 'cccccccc-0000-0000-0000-00000000000c', 'f0000000-0000-0000-0000-000000000001', 'wissel', 700, null, null, null, 'e0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001'),
  ('f5000000-0000-0000-0000-000000000004', 'cccccccc-0000-0000-0000-00000000000c', 'f0000000-0000-0000-0000-000000000002', 'doelpunt', 300, null, 'e0000000-0000-0000-0000-000000000001', null, null, null);
commit;

-- Het team heeft het seizoen gekocht (abonnement.sql); zonder dat ziet een ouder niets.
select public.abonnement_bij('seizoen-JO14-1', 'cccccccc-0000-0000-0000-00000000000c', 'app.blaadje.ios.seizoen', now() + interval '1 year', 'Sandbox', false);

-- ---------- wat een volger ziet ----------
begin;
set local role anon;
do $$
declare
  p jsonb := public.volgpagina('code-van-sem-0123456789');
begin
  if p is null then raise exception 'de link van Sem geeft niets'; end if;
  if p->>'team' <> 'JO14-1' or p->>'kind' <> 'Sem' then raise exception 'team of kind klopt niet: %', p; end if;
  if jsonb_array_length(p->'wedstrijden') <> 3 then raise exception 'niet alle drie de wedstrijden staan erop'; end if;
  if p::text like '%GEHEIM%' then raise exception 'de notitie van de trainer staat op de pagina'; end if;
  if p::text like '%1234%' or p::text like '%seconden%' then raise exception 'er staat speeltijd op de pagina'; end if;
  if p::text like '%Noah%' then raise exception 'er staat een ander kind op de pagina'; end if;
  if (p->'trainingen'->0->>'status') <> 'afgemeld' then raise exception 'de training van het eigen kind klopt niet'; end if;
  -- de stand van de wedstrijd die loopt staat erop, die van de geplande niet
  if not exists (select 1 from jsonb_array_elements(p->'wedstrijden') w where w->>'status' = 'bezig' and (w->>'voor')::int = 1) then
    raise exception 'de stand van de lopende wedstrijd ontbreekt';
  end if;
  if exists (select 1 from jsonb_array_elements(p->'wedstrijden') w where w->>'status' = 'gepland' and w->>'voor' is not null) then
    raise exception 'een geplande wedstrijd heeft al een stand';
  end if;
  if public.volgpagina('bestaat-niet-0123456789') is not null then raise exception 'een verzonnen code geeft iets terug'; end if;
end $$;

-- Rechtstreeks bij de tabellen komt een volger niet.
do $$ begin
  begin
    perform count(*) from public.volgers;
    raise exception 'een volger kan de lijst met volgers lezen';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.melding_voor('f5000000-0000-0000-0000-000000000002');
    raise exception 'een volger kan zelf meldingen opvragen';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Volgen: met de goede code wel, met een verzonnen code niet.
do $$ begin
  if not public.volg('code-van-sem-0123456789', 'telefoon-van-oma-0123456789abcdef0123456789', 'echt') then raise exception 'volgen met een goede code lukt niet'; end if;
  if not public.volg('code-van-sem-0123456789', 'telefoon-van-oma-0123456789abcdef0123456789', 'echt') then raise exception 'twee keer volgen hoort gewoon te lukken'; end if;
  if not public.volg('code-van-sem-0123456789', 'telefoon-van-papa-0123456789abcdef0123456789', 'proef') then raise exception 'een tweede volger lukt niet'; end if;
  -- papa volgt allebei zijn kinderen
  if not public.volg('code-van-noah-0123456789', 'telefoon-van-papa-0123456789abcdef0123456789', 'proef') then raise exception 'een tweede kind volgen lukt niet'; end if;
  if public.volg('bestaat-niet-0123456789', 'telefoon-van-oma-0123456789abcdef0123456789', 'echt') then raise exception 'volgen met een verzonnen code lukt'; end if;
end $$;
commit;

do $$ begin
  if (select count(*) from public.volgers) <> 3 then raise exception 'er horen drie volgers te zijn, het zijn er %', (select count(*) from public.volgers); end if;
end $$;
\echo 'Volgen: een volger ziet alleen het eigen kind, zonder speeltijd of notities'

-- ---------- de meldingen ----------
set role service_role;
do $$
declare
  m jsonb;
begin
  -- de aftrap
  m := public.melding_voor('f5000000-0000-0000-0000-000000000001');
  if m is null or m->>'tekst' <> 'De wedstrijd is begonnen' then raise exception 'de aftrap geeft geen melding: %', m; end if;

  -- een doelpunt, uit: de thuisploeg staat eerst
  m := public.melding_voor('f5000000-0000-0000-0000-000000000002');
  if m->>'tekst' <> 'Doelpunt van Sem!' then raise exception 'de tekst bij het doelpunt klopt niet: %', m; end if;
  if m->>'titel' <> 'Sparta – JO14-1  0–1' then raise exception 'de stand klopt niet: %', m->>'titel'; end if;
  -- papa volgt twee kinderen in dit team en krijgt er toch maar één
  if jsonb_array_length(m->'tokens') <> 2 then raise exception 'er horen twee telefoons te zijn, het zijn er %', jsonb_array_length(m->'tokens'); end if;
  if not (m->'tokens') @> '[{"token":"telefoon-van-papa-0123456789abcdef0123456789","omgeving":"proef"}]' then raise exception 'de omgeving van papa klopt niet'; end if;

  -- nooit twee keer hetzelfde
  if public.melding_voor('f5000000-0000-0000-0000-000000000002') is not null then raise exception 'hetzelfde doelpunt wordt twee keer gemeld'; end if;

  -- een wissel is geen nieuws, en een oude wedstrijd ook niet
  if public.melding_voor('f5000000-0000-0000-0000-000000000003') is not null then raise exception 'een wissel geeft een melding'; end if;
  if public.melding_voor('f5000000-0000-0000-0000-000000000004') is not null then raise exception 'een wedstrijd die al klaar is geeft een melding'; end if;
  if public.melding_voor('00000000-0000-0000-0000-000000000000') is not null then raise exception 'een gebeurtenis die niet bestaat geeft een melding'; end if;
end $$;
reset role;

-- Een assist erbij is voor de database een nieuwe rij, maar hetzelfde doelpunt.
delete from public.gebeurtenissen where id = 'f5000000-0000-0000-0000-000000000002';
insert into public.gebeurtenissen (id, team_id, wedstrijd_id, soort, t, speler, assist)
values ('f5000000-0000-0000-0000-000000000012', 'cccccccc-0000-0000-0000-00000000000c', 'f0000000-0000-0000-0000-000000000001', 'doelpunt', 600,
        'e0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000002');
-- Een doelpunt dat pas na een kwartier bij de server aankomt, een tegendoelpunt, de rust, en het einde van een uur geleden.
insert into public.gebeurtenissen (id, team_id, wedstrijd_id, soort, t, deel, gemaakt) values
  ('f5000000-0000-0000-0000-000000000020', 'cccccccc-0000-0000-0000-00000000000c', 'f0000000-0000-0000-0000-000000000001', 'doelpunt', 900, null, now() - interval '15 minutes'),
  ('f5000000-0000-0000-0000-000000000021', 'cccccccc-0000-0000-0000-00000000000c', 'f0000000-0000-0000-0000-000000000001', 'tegendoelpunt', 1000, null, now()),
  ('f5000000-0000-0000-0000-000000000022', 'cccccccc-0000-0000-0000-00000000000c', 'f0000000-0000-0000-0000-000000000001', 'pauze', 2100, 1, now()),
  ('f5000000-0000-0000-0000-000000000023', 'cccccccc-0000-0000-0000-00000000000c', 'f0000000-0000-0000-0000-000000000001', 'einde', 4200, null, now() - interval '1 hour');

set role service_role;
do $$
declare
  m jsonb;
begin
  if public.melding_voor('f5000000-0000-0000-0000-000000000012') is not null then raise exception 'een assist erbij geeft een tweede melding van hetzelfde doelpunt'; end if;
  -- Een doelpunt van een kwartier geleden: geen losse melding, maar straks een samenvatting.
  m := public.melding_voor('f5000000-0000-0000-0000-000000000020');
  if m is null or (m->>'inhalen')::boolean is not true or m ? 'tokens' then raise exception 'een doelpunt van een kwartier geleden hoort om inhalen te vragen: %', m; end if;
  m := public.melding_voor('f5000000-0000-0000-0000-000000000021');
  if m->>'tekst' <> 'Tegendoelpunt' or m->>'titel' <> 'Sparta – JO14-1  1–2' then raise exception 'het tegendoelpunt klopt niet: %', m; end if;
  m := public.melding_voor('f5000000-0000-0000-0000-000000000022');
  if m->>'tekst' <> 'Rust' then raise exception 'de rust geeft geen melding: %', m; end if;
  m := public.melding_voor('f5000000-0000-0000-0000-000000000023');
  if (m->>'inhalen')::boolean is not true then raise exception 'het einde van een uur geleden hoort in de samenvatting te komen: %', m; end if;

  -- De samenvatting: wat nog niet gemeld was, in één bericht, met de stand van nu.
  m := public.inhaalmelding('f0000000-0000-0000-0000-000000000001');
  if m->>'titel' <> 'Sparta – JO14-1  1–2' then raise exception 'de stand in de samenvatting klopt niet: %', m->>'titel'; end if;
  if m->>'tekst' <> 'Afgelopen: 1 doelpunt' then raise exception 'de samenvatting klopt niet: %', m->>'tekst'; end if;
  if jsonb_array_length(m->'tokens') <> 2 then raise exception 'de samenvatting gaat niet naar beide telefoons'; end if;
  -- Wie daarna nog om een samenvatting vraagt (de rest van de stapel) krijgt niets.
  if public.inhaalmelding('f0000000-0000-0000-0000-000000000001') is not null then raise exception 'de samenvatting komt twee keer'; end if;
  if public.inhaalmelding('00000000-0000-0000-0000-000000000000') is not null then raise exception 'een wedstrijd die niet bestaat geeft een samenvatting'; end if;

  -- Een telefoon die Apple niet meer kent, verdwijnt overal.
  perform public.vergeet_token('telefoon-van-papa-0123456789abcdef0123456789');
end $$;
reset role;
do $$ begin
  if (select count(*) from public.volgers) <> 1 then raise exception 'het adres van papa staat er nog'; end if;
end $$;
\echo 'Volgen: de aftrap, een doelpunt, de rust en het einde geven elk één melding, en verder niets'

-- Een ingetrokken link krijgt niets meer, en ontvolgen haalt je weg.
update public.deellinks set ingetrokken = now() where id = 'f4000000-0000-0000-0000-000000000001';
insert into public.gebeurtenissen (id, team_id, wedstrijd_id, soort, t)
values ('f5000000-0000-0000-0000-000000000030', 'cccccccc-0000-0000-0000-00000000000c', 'f0000000-0000-0000-0000-000000000001', 'tegendoelpunt', 1500);
set role service_role;
do $$ begin
  if public.melding_voor('f5000000-0000-0000-0000-000000000030') is not null then raise exception 'een ingetrokken link krijgt nog meldingen'; end if;
end $$;
reset role;
set role anon;
do $$ begin
  if public.volgpagina('code-van-sem-0123456789') is not null then raise exception 'een ingetrokken link laat nog iets zien'; end if;
  if not public.volg('code-van-noah-0123456789', 'telefoon-van-oma-0123456789abcdef0123456789') then raise exception 'volgen lukt niet'; end if;
  perform public.ontvolg('code-van-noah-0123456789', 'telefoon-van-oma-0123456789abcdef0123456789');
end $$;
reset role;
do $$ begin
  if exists (select 1 from public.volgers v join public.deellinks d on d.id = v.deellink_id where d.code = 'code-van-noah-0123456789') then
    raise exception 'na ontvolgen sta je er nog';
  end if;
end $$;
\echo 'Volgen: een ingetrokken link is dicht, en ontvolgen haalt je weg'

-- ---------- de link van het team ----------
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"66666666-6666-6666-6666-666666666666","email":"carla@voorbeeld.nl"}';
insert into public.deellinks (id, team_id, speler_id, code)
values ('f4000000-0000-0000-0000-000000000009', 'cccccccc-0000-0000-0000-00000000000c', null, 'code-van-het-team-0123456789');
do $$ begin
  begin
    insert into public.deellinks (team_id, speler_id) values ('cccccccc-0000-0000-0000-00000000000c', null);
    raise exception 'een team kan twee links tegelijk hebben';
  exception when unique_violation then null;
  end;
  begin
    insert into public.deellinks (team_id, speler_id) values ('aaaaaaaa-1111-0000-0000-00000000000a', null);
    raise exception 'je kunt een link maken voor een team dat niet van jou is';
  exception when insufficient_privilege or foreign_key_violation then null;
  end;
end $$;
commit;

set role anon;
do $$
declare
  p jsonb := public.volgpagina('code-van-het-team-0123456789');
begin
  if p is null or p->>'team' <> 'JO14-1' then raise exception 'de link van het team geeft niets: %', p; end if;
  if p->>'kind' is not null then raise exception 'de link van het team noemt een kind'; end if;
  if jsonb_array_length(p->'wedstrijden') <> 3 then raise exception 'de wedstrijden staan niet op de teampagina'; end if;
  if jsonb_array_length(p->'trainingen') <> 0 then raise exception 'op de teampagina staan trainingen, en die zijn per kind'; end if;
  -- De voornamen staan er wel, om je eigen kind uit te kiezen (taken.sql), maar
  -- verder nergens: geen trainingen, geen kind dat deze telefoon niet koos.
  if (p - 'spelers')::text like '%Sem%' or (p - 'spelers')::text like '%Noah%' then
    raise exception 'op de teampagina staat een kind bij naam, buiten de lijst om te kiezen';
  end if;
  if p->'mijn_kind' <> 'null'::jsonb then raise exception 'zonder telefoon toch een eigen kind'; end if;
  if not public.volg('code-van-het-team-0123456789', 'telefoon-van-opa-0123456789abcdef0123456789') then raise exception 'het team volgen lukt niet'; end if;
end $$;
reset role;

insert into public.gebeurtenissen (id, team_id, wedstrijd_id, soort, t)
values ('f5000000-0000-0000-0000-000000000040', 'cccccccc-0000-0000-0000-00000000000c', 'f0000000-0000-0000-0000-000000000001', 'tegendoelpunt', 1800);
set role service_role;
do $$
declare m jsonb := public.melding_voor('f5000000-0000-0000-0000-000000000040');
begin
  if m is null or not (m->'tokens') @> '[{"token":"telefoon-van-opa-0123456789abcdef0123456789"}]' then
    raise exception 'wie het team volgt krijgt geen melding: %', m;
  end if;
end $$;
reset role;
\echo 'Volgen: één link voor het hele team, zonder iets over een los kind'
