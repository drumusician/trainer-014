-- Bewijst dat het model in tabellen (../model.sql) net zo dicht zit als het
-- blok: een trainer komt alleen bij zijn eigen team, en wie de link voor ouders
-- heeft ziet precies wat op die pagina hoort en geen letter meer. Speeltijd
-- hoort daar niet bij.
--
-- Draait na rls.sql in dezelfde database, met eigen mensen en eigen teams, zodat
-- de twee proeven elkaar niet in de weg zitten.

\set ON_ERROR_STOP on

insert into auth.users (id, email) values
  ('44444444-4444-4444-4444-444444444444', 'anna@voorbeeld.nl'),
  ('55555555-5555-5555-5555-555555555555', 'bas@voorbeeld.nl');

-- ---------- het seizoen ----------
do $$ begin
  if public.seizoen_van('2026-07-01') <> '2026/27' then raise exception 'op 1 juli begint het nieuwe seizoen niet'; end if;
  if public.seizoen_van('2027-06-30') <> '2026/27' then raise exception '30 juni hoort nog bij het lopende seizoen'; end if;
  if public.seizoen_van('2099-08-01') <> '2099/00' then raise exception 'de eeuwwisseling gaat mis: %', public.seizoen_van('2099-08-01'); end if;
end $$;

-- ---------- Anna zet een team op en speelt een wedstrijd ----------
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"44444444-4444-4444-4444-444444444444","email":"anna@voorbeeld.nl"}';

insert into public.teams (id, naam, eigenaar)
values ('aaaaaaaa-0000-0000-0000-00000000000a', 'JO14-2', '44444444-4444-4444-4444-444444444444');

insert into public.team_instellingen (id, formatie, delen, minuten_per_deel)
values ('aaaaaaaa-0000-0000-0000-00000000000a', '4-3-3', 2, 35);

insert into public.spelers (id, team_id, naam, linie, keept) values
  ('a0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-00000000000a', 'Bram',  'V', true),
  ('a0000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-00000000000a', 'Finn',  'A', false),
  ('a0000000-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-00000000000a', 'Gijs',  'M', false);

-- Een gespeelde wedstrijd van dit seizoen, met een notitie die niemand mag zien.
insert into public.wedstrijden (id, team_id, datum, tegenstander, thuis, status, doelpunten_voor, doelpunten_tegen, duur, notitie, opstelling)
values ('b0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-00000000000a',
        current_date, 'VV Overkant', true, 'afgelopen', 2, 1, 4200,
        'GEHEIM: Gijs was er met zijn hoofd niet bij', '{"K":"a0000000-0000-0000-0000-000000000001"}');

insert into public.wedstrijd_spelers (id, team_id, wedstrijd_id, speler_id, naam, aanwezig, seconden, keeper_seconden) values
  ('c0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-00000000000a', 'b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Bram', true, 4200, 2100),
  ('c0000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-00000000000a', 'b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'Finn', true, 3000, 0),
  ('c0000000-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-00000000000a', 'b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003', 'Gijs', false, 0, 0);

insert into public.gebeurtenissen (id, team_id, wedstrijd_id, soort, t, speler, assist) values
  ('d0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-00000000000a', 'b0000000-0000-0000-0000-000000000001', 'aftrap', 0, null, null),
  ('d0000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-00000000000a', 'b0000000-0000-0000-0000-000000000001', 'doelpunt', 600,  'a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001'),
  ('d0000000-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-00000000000a', 'b0000000-0000-0000-0000-000000000001', 'doelpunt', 1900, 'a0000000-0000-0000-0000-000000000002', null),
  ('d0000000-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-00000000000a', 'b0000000-0000-0000-0000-000000000001', 'tegendoelpunt', 2500, null, null);

-- Een wedstrijd die nog loopt: die hoort niet op de pagina voor ouders.
insert into public.wedstrijden (id, team_id, datum, tegenstander, status, doelpunten_voor)
values ('b0000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-00000000000a', current_date, 'SV Bezig', 'bezig', 5);
insert into public.wedstrijd_spelers (id, team_id, wedstrijd_id, speler_id, naam, seconden)
values ('c0000000-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-00000000000a', 'b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000003', 'Gijs', 999);
insert into public.gebeurtenissen (id, team_id, wedstrijd_id, soort, t, speler)
values ('d0000000-0000-0000-0000-000000000005', 'aaaaaaaa-0000-0000-0000-00000000000a', 'b0000000-0000-0000-0000-000000000002', 'doelpunt', 60, 'a0000000-0000-0000-0000-000000000003');

-- En een van twee seizoenen terug: ook niet.
insert into public.wedstrijden (id, team_id, datum, tegenstander, status, doelpunten_voor)
values ('b0000000-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-00000000000a', current_date - 800, 'FC Vroeger', 'afgelopen', 9);

insert into public.trainingen (id, team_id, datum)
values ('e0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-00000000000a', current_date);
insert into public.training_spelers (id, team_id, training_id, speler_id, status)
values ('f0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-00000000000a', 'e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003', 'afwezig');

-- Elk kind zijn eigen link, voor zijn eigen ouder.
insert into public.deellinks (id, team_id, speler_id, code) values
  ('99999999-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-000000000002', 'de-link-voor-de-ouder-van-finn'),
  ('99999999-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-000000000003', 'de-link-voor-de-ouder-van-gijs');

do $$
declare n int;
begin
  select count(*) into n from public.spelers;
  if n <> 3 then raise exception 'de trainer ziet zijn eigen spelers niet'; end if;
  select count(*) into n from public.gebeurtenissen;
  if n <> 5 then raise exception 'de trainer ziet zijn eigen wedstrijd niet terug'; end if;

  -- Een gebeurtenis verander je niet: je haalt hem weg en zet een nieuwe neer.
  begin
    update public.gebeurtenissen set t = 1;
    raise exception 'een gebeurtenis was te wijzigen';
  exception when insufficient_privilege then null;
  end;

  -- Een link verhuist niet naar een ander team en krijgt geen andere code.
  begin
    update public.deellinks set code = 'een-zelfgekozen-code-van-twintig';
    raise exception 'de code van een link was te wijzigen';
  exception when insufficient_privilege then null;
  end;

  -- Een kind heeft één link die werkt. Een tweede ernaast zou betekenen dat je
  -- er een intrekt en de andere blijft rondgaan.
  begin
    insert into public.deellinks (team_id, speler_id)
    values ('aaaaaaaa-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-000000000002');
    raise exception 'een kind kreeg een tweede werkende link';
  exception when unique_violation then null;
  end;

  -- Wie nog in een wedstrijd voorkomt, gooi je niet weg.
  -- De verwijzing wordt pas aan het eind nagekeken; hier vragen we het meteen.
  begin
    delete from public.spelers where id = 'a0000000-0000-0000-0000-000000000001';
    set constraints all immediate;
    raise exception 'een speler met wedstrijden was te verwijderen';
  exception when foreign_key_violation then null;
  end;
end $$;
commit;

-- ---------- Bas heeft zijn eigen team en mag bij Anna nergens bij ----------
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"55555555-5555-5555-5555-555555555555","email":"bas@voorbeeld.nl"}';
-- Verwijzingen naar spelers worden normaal pas bij het vastleggen nagekeken.
-- Hier meteen, zodat elke poging hieronder zijn eigen fout geeft.
set constraints all immediate;

-- Zonder te zeggen van wie: de database vult in wie er is ingelogd.
insert into public.teams (id, naam)
values ('bbbbbbbb-0000-0000-0000-00000000000b', 'JO11-4');
do $$ begin
  if (select eigenaar from public.teams where id = 'bbbbbbbb-0000-0000-0000-00000000000b') <> '55555555-5555-5555-5555-555555555555' then
    raise exception 'een team zonder eigenaar aangemaakt is niet van wie inlogde';
  end if;
end $$;
insert into public.spelers (id, team_id, naam)
values ('a0000000-0000-0000-0000-0000000000b1', 'bbbbbbbb-0000-0000-0000-00000000000b', 'Daan');
insert into public.wedstrijden (id, team_id, datum, status)
values ('b0000000-0000-0000-0000-0000000000b1', 'bbbbbbbb-0000-0000-0000-00000000000b', current_date, 'afgelopen');

do $$
declare
  t text;
  n int;
begin
  -- Lezen: in elke tabel alleen het eigen team. Bij Bas staat in de meeste niets.
  foreach t in array array['team_instellingen', 'wedstrijd_spelers', 'gebeurtenissen', 'trainingen', 'training_spelers', 'deellinks']
  loop
    execute format('select count(*) from public.%I', t) into n;
    if n <> 0 then raise exception 'een ander leest % rij(en) uit % van een team dat niet van hem is', n, t; end if;
  end loop;
  select count(*) into n from public.spelers;
  if n <> 1 then raise exception 'een ander ziet % spelers, en er is er maar een van hem', n; end if;
  select count(*) into n from public.wedstrijden;
  if n <> 1 then raise exception 'een ander ziet % wedstrijden, en er is er maar een van hem', n; end if;

  -- Bijwerken en weghalen zónder where: dan filtert de leesregel niets weg en
  -- valt een te ruime regel door de mand. Alleen zijn eigen rij mag meedoen.
  update public.spelers set naam = 'gekaapt';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'bijwerken zonder where raakte % spelers', n; end if;
  update public.wedstrijden set notitie = 'gekaapt';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'bijwerken zonder where raakte % wedstrijden', n; end if;
  update public.team_instellingen set formatie = 'gekaapt';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'een ander kon de instellingen van een team wijzigen'; end if;
  update public.wedstrijd_spelers set seconden = 0;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'een ander kon de speeltijd van een team wijzigen'; end if;
  update public.deellinks set ingetrokken = now();
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'een ander kon de link van een team intrekken'; end if;
  delete from public.gebeurtenissen;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'een ander kon % gebeurtenis(sen) van een team weghalen', n; end if;
  delete from public.training_spelers;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'een ander kon de trainingsopkomst van een team weghalen'; end if;

  -- Erbij zetten in het team van een ander.
  begin
    insert into public.spelers (id, team_id, naam)
    values ('a0000000-0000-0000-0000-0000000000ff', 'aaaaaaaa-0000-0000-0000-00000000000a', 'Indringer');
    raise exception 'een ander kon een speler in een team zetten dat niet van hem is';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.deellinks (team_id, speler_id)
    values ('aaaaaaaa-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-000000000001');
    raise exception 'een ander kon een link maken naar een kind van een team dat niet van hem is';
  exception when insufficient_privilege then null;
  end;
  -- En via zijn eigen team naar een kind van een ander: de link zou dan de
  -- trainingen van dat kind laten zien.
  begin
    insert into public.deellinks (team_id, speler_id)
    values ('bbbbbbbb-0000-0000-0000-00000000000b', 'a0000000-0000-0000-0000-000000000001');
    raise exception 'een link in een eigen team kon naar een kind van een ander team wijzen';
  exception when foreign_key_violation then null;
  end;
  begin
    insert into public.team_instellingen (id) values ('aaaaaaaa-0000-0000-0000-00000000000a');
    raise exception 'een ander kon instellingen zetten voor een team dat niet van hem is';
  exception when insufficient_privilege or unique_violation then null;
  end;

  -- Het gemeenste: in je éígen wedstrijd wijzen naar een kind van een ander
  -- team. De regels laten het toe, want het is je eigen rij; de verwijzing op
  -- (speler, team) houdt het tegen. Anders zet je eigen pagina voor ouders er
  -- de naam van dat kind bij.
  begin
    insert into public.wedstrijd_spelers (id, team_id, wedstrijd_id, speler_id, naam)
    values ('c0000000-0000-0000-0000-0000000000b1', 'bbbbbbbb-0000-0000-0000-00000000000b',
            'b0000000-0000-0000-0000-0000000000b1', 'a0000000-0000-0000-0000-000000000001', 'x');
    raise exception 'een speler van een ander team kon in een eigen wedstrijd worden gezet';
  exception when foreign_key_violation then null;
  end;
  begin
    insert into public.gebeurtenissen (id, team_id, wedstrijd_id, soort, t, speler)
    values ('d0000000-0000-0000-0000-0000000000b1', 'bbbbbbbb-0000-0000-0000-00000000000b',
            'b0000000-0000-0000-0000-0000000000b1', 'doelpunt', 1, 'a0000000-0000-0000-0000-000000000001');
    raise exception 'een doelpunt kon op naam van een speler van een ander team';
  exception when foreign_key_violation then null;
  end;
  -- En andersom: een eigen gebeurtenis aan de wedstrijd van een ander hangen.
  begin
    insert into public.gebeurtenissen (id, team_id, wedstrijd_id, soort, t)
    values ('d0000000-0000-0000-0000-0000000000b2', 'bbbbbbbb-0000-0000-0000-00000000000b',
            'b0000000-0000-0000-0000-000000000001', 'doelpunt', 1);
    raise exception 'een gebeurtenis kon aan de wedstrijd van een ander team worden gehangen';
  exception when foreign_key_violation then null;
  end;

  -- Bijdragen: daar komt geen trainer bij.
  begin
    select count(*) into n from public.bijdragen;
    raise exception 'een trainer kan de bijdragen rechtstreeks lezen';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.bijdragen (team_id, seizoen, bedrag_cent, betaling, status)
    values ('bbbbbbbb-0000-0000-0000-00000000000b', '2026/27', 100, 'zelf-verzonnen', 'betaald');
    raise exception 'een trainer kan zichzelf een bijdrage toeschrijven';
  exception when insufficient_privilege then null;
  end;
end $$;
commit;

\echo 'Model: een trainer komt alleen bij zijn eigen team, in elke tabel'

-- ---------- de betaalprovider meldt bijdragen ----------
-- Als beheerder, zoals de server dat doet. Eén euro voor Finn, één los voor het
-- team, één die nog openstaat. Dezelfde melding twee keer telt één keer.
-- Bij elkaar twee euro: het team is nog niet rond.
insert into public.trainingen (id, team_id, datum) values
  ('e0000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-00000000000a', current_date - 800);
insert into public.training_spelers (id, team_id, training_id, speler_id, status) values
  ('f0000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-00000000000a', 'e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'aanwezig'),
  ('f0000000-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-00000000000a', 'e0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000003', 'afgemeld');

insert into public.bijdragen (team_id, speler_id, seizoen, bedrag_cent, betaling, status, betaald_op) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-000000000002', public.seizoen_van(current_date), 100, 'tr_finn', 'betaald', now()),
  ('aaaaaaaa-0000-0000-0000-00000000000a', null, public.seizoen_van(current_date), 100, 'tr_los', 'betaald', now()),
  ('aaaaaaaa-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-000000000003', public.seizoen_van(current_date), 100, 'tr_open', 'open', null),
  ('aaaaaaaa-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-000000000003', '2001/02', 5000, 'tr_oud', 'betaald', now());
insert into public.bijdragen (team_id, seizoen, bedrag_cent, betaling, status)
values ('aaaaaaaa-0000-0000-0000-00000000000a', public.seizoen_van(current_date), 100, 'tr_finn', 'betaald')
on conflict (betaling) do nothing;

-- Betalen voor een kind van een ander team bij dit team: dat bestaat niet.
do $$ begin
  begin
    insert into public.bijdragen (team_id, speler_id, seizoen, bedrag_cent, betaling, status)
    values ('aaaaaaaa-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-0000000000b1', '2026/27', 100, 'tr_fout', 'betaald');
    set constraints all immediate;
    raise exception 'een bijdrage kon op een kind van een ander team';
  exception when foreign_key_violation then null;
  end;
end $$;

-- ---------- wie de link van een kind heeft, en niet is ingelogd ----------
begin;
set local role anon;

do $$
declare
  t text;
  n int;
  p jsonb;
  tekst text;
begin
  -- Rechtstreeks in de tabellen: niets.
  foreach t in array array['team_instellingen', 'spelers', 'wedstrijden', 'wedstrijd_spelers', 'gebeurtenissen', 'trainingen', 'training_spelers', 'deellinks', 'bijdragen']
  loop
    begin
      execute format('select count(*) from public.%I', t) into n;
      if n <> 0 then raise exception 'zonder inlog komen er % rij(en) uit %', n, t; end if;
    exception when insufficient_privilege then null;
    end;
  end loop;

  if public.ouderpagina('bestaat-niet') is not null then raise exception 'een verzonnen code levert een pagina op'; end if;
  if public.ouderpagina(null) is not null then raise exception 'zonder code komt er een pagina'; end if;

  -- De ouder van Gijs: nog niet betaald (zijn betaling staat open) en het team
  -- is niet rond. Hij ziet wat hij nodig heeft om te betalen, en verder niets.
  p := public.ouderpagina('de-link-voor-de-ouder-van-gijs');
  if p is null then raise exception 'de link van Gijs geeft geen pagina'; end if;
  if p ->> 'team' <> 'JO14-2' or p ->> 'kind' <> 'Gijs' then raise exception 'team of kind klopt niet: % %', p ->> 'team', p ->> 'kind'; end if;
  if (p ->> 'toegang')::boolean then raise exception 'een openstaande betaling geeft toegang'; end if;
  if p ? 'wedstrijden' or p ? 'trainingen' or p ? 'gemist' then raise exception 'zonder toegang staan de wedstrijden of trainingen er al'; end if;
  -- Twee euro binnen: de openstaande, de dubbele melding en die van een ander seizoen tellen niet.
  if (p -> 'bijdrage' ->> 'opgehaald_cent')::int <> 200 then raise exception 'er is % cent opgehaald, het is 200', p -> 'bijdrage' ->> 'opgehaald_cent'; end if;
  if (p -> 'bijdrage' ->> 'nog_cent')::int <> 800 then raise exception 'voor het team ontbreekt nog % cent, het is 800', p -> 'bijdrage' ->> 'nog_cent'; end if;
  if (p -> 'bijdrage' ->> 'team_rond')::boolean then raise exception 'het team is rond bij twee euro'; end if;
  if p::text like '%Finn%' or p::text like '%Bram%' then raise exception 'er staat een ander kind op de pagina van Gijs'; end if;

  -- De ouder van Finn: betaald. Open, met de wedstrijden van dit seizoen en de
  -- trainingen van Finn.
  p := public.ouderpagina('de-link-voor-de-ouder-van-finn');
  tekst := p::text;
  if p ->> 'kind' <> 'Finn' then raise exception 'de link van Finn gaat over %', p ->> 'kind'; end if;
  if not (p ->> 'toegang')::boolean then raise exception 'voor Finn is betaald en de pagina is dicht'; end if;
  -- De gespeelde en de lopende; die van twee seizoenen terug niet.
  if jsonb_array_length(p -> 'wedstrijden') <> 2 then
    raise exception 'er staan % wedstrijden, dit seizoen zijn het er twee', jsonb_array_length(p -> 'wedstrijden');
  end if;
  if not exists (select 1 from jsonb_array_elements(p -> 'wedstrijden') w
                  where w ->> 'status' = 'afgelopen' and (w ->> 'voor')::int = 2 and (w ->> 'tegen')::int = 1) then
    raise exception 'de uitslag van de gespeelde wedstrijd klopt niet';
  end if;
  if not exists (select 1 from jsonb_array_elements(p -> 'wedstrijden') w
                  where w ->> 'status' = 'bezig' and w ->> 'voor' is null) then
    raise exception 'van een wedstrijd die nog loopt staat de stand er al';
  end if;
  -- Eén training dit seizoen, en Finn was er. Gijs miste hem; dat staat hier niet.
  if jsonb_array_length(p -> 'trainingen') <> 1 or p -> 'trainingen' -> 0 ->> 'status' <> 'aanwezig' then
    raise exception 'de trainingen van Finn kloppen niet: %', p -> 'trainingen';
  end if;
  if (p -> 'gemist' ->> 'afwezig')::int <> 0 or (p -> 'gemist' ->> 'afgemeld')::int <> 0 then raise exception 'Finn miste niets en er staat: %', p -> 'gemist'; end if;

  -- En wat er nooit op mag staan, ook niet met toegang.
  if tekst like '%Gijs%' or tekst like '%Bram%' then raise exception 'er staat een ander kind op de pagina van Finn'; end if;
  if tekst like '%seconden%' or tekst like '%minuten%' or tekst like '%speeltijd%' then raise exception 'de speeltijd staat op de pagina voor ouders'; end if;
  if tekst ~ '(4200|3000|2100|: ?70[,}]|: ?50[,}]|: ?35[,}])' then raise exception 'er staat een getal op de pagina dat de speeltijd verraadt'; end if;
  if tekst like '%GEHEIM%' then raise exception 'de notitie van de trainer staat op de pagina voor ouders'; end if;
  if tekst like '%opstelling%' or tekst like '%wisselplan%' then raise exception 'de opstelling of het wisselplan staat op de pagina'; end if;
  if tekst like '%doelpunt%' or tekst like '%assist%' then raise exception 'wie er scoorde staat op de pagina'; end if;
  if tekst like '%voorbeeld.nl%' then raise exception 'er staat een e-mailadres op de pagina'; end if;
  if tekst like '%Daan%' or tekst like '%gekaapt%' then raise exception 'er staat iets van een ander team op de pagina'; end if;
  if tekst ~ '[0-9a-f]{8}-[0-9a-f]{4}-' then raise exception 'er staat een id op de pagina'; end if;
end $$;
commit;

\echo 'Model: de pagina voor ouders is dicht tot er betaald is, en gaat alleen over het eigen kind'

-- ---------- iemand legt de rest bij: het team is rond ----------
insert into public.bijdragen (team_id, seizoen, bedrag_cent, betaling, status, betaald_op)
values ('aaaaaaaa-0000-0000-0000-00000000000a', public.seizoen_van(current_date), 800, 'tr_rest', 'betaald', now());

begin;
set local role anon;
do $$
declare p jsonb;
begin
  -- Gijs, waar niemand apart voor betaalde: nu open, en hij miste de training.
  -- Die van een vorig seizoen, waar hij zich afmeldde, telt niet mee.
  p := public.ouderpagina('de-link-voor-de-ouder-van-gijs');
  if not (p ->> 'toegang')::boolean or not (p -> 'bijdrage' ->> 'team_rond')::boolean then raise exception 'het team is rond en Gijs is dicht'; end if;
  if (p -> 'bijdrage' ->> 'nog_cent')::int <> 0 then raise exception 'er ontbreekt nog iets terwijl het team rond is'; end if;
  if p -> 'trainingen' -> 0 ->> 'status' <> 'afwezig' then raise exception 'de gemiste training van Gijs staat er niet: %', p -> 'trainingen'; end if;
  if (p -> 'gemist' ->> 'afwezig')::int <> 1 or (p -> 'gemist' ->> 'afgemeld')::int <> 0 then raise exception 'Gijs miste er een dit seizoen en er staat: %', p -> 'gemist'; end if;
  if p::text like '%Finn%' then raise exception 'op de pagina van Gijs staat Finn'; end if;
end $$;
commit;

\echo 'Model: is het team rond, dan mag elke ouder erin, bij zijn eigen kind'

-- ---------- intrekken ----------
-- De link van Finn is in verkeerde handen. Intrekken, en een nieuwe maken.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"44444444-4444-4444-4444-444444444444","email":"anna@voorbeeld.nl"}';
update public.deellinks set ingetrokken = now() where id = '99999999-0000-0000-0000-000000000002';
insert into public.deellinks (team_id, speler_id, code)
values ('aaaaaaaa-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-000000000002', 'de-nieuwe-link-voor-de-ouder-van-finn');
commit;

begin;
set local role anon;
do $$ begin
  if public.ouderpagina('de-link-voor-de-ouder-van-finn') is not null then
    raise exception 'een ingetrokken link geeft nog steeds een pagina';
  end if;
  if public.ouderpagina('de-nieuwe-link-voor-de-ouder-van-finn') ->> 'kind' <> 'Finn' then
    raise exception 'de nieuwe link van Finn werkt niet';
  end if;
  if public.ouderpagina('de-link-voor-de-ouder-van-gijs') is null then
    raise exception 'het intrekken van de link van Finn sloot ook die van Gijs';
  end if;
end $$;
commit;

\echo 'Model: een ingetrokken link is dicht, en een nieuwe werkt'

-- ---------- een team weggooien ruimt alles op ----------
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"44444444-4444-4444-4444-444444444444","email":"anna@voorbeeld.nl"}';
delete from public.teams where id = 'aaaaaaaa-0000-0000-0000-00000000000a';
commit;

do $$
declare
  t text;
  n int;
begin
  foreach t in array array['spelers', 'wedstrijden', 'wedstrijd_spelers', 'gebeurtenissen', 'trainingen', 'training_spelers', 'deellinks', 'bijdragen']
  loop
    execute format('select count(*) from public.%I where team_id = %L', t, 'aaaaaaaa-0000-0000-0000-00000000000a') into n;
    if n <> 0 then raise exception 'na het weggooien van het team staan er nog % rij(en) in %', n, t; end if;
  end loop;
  if (select count(*) from public.team_instellingen where id = 'aaaaaaaa-0000-0000-0000-00000000000a') <> 0 then
    raise exception 'de instellingen van een weggegooid team staan er nog';
  end if;
  -- en het team van Bas staat er nog
  if (select count(*) from public.spelers where team_id = 'bbbbbbbb-0000-0000-0000-00000000000b') <> 1 then
    raise exception 'het weggooien van een team raakte een ander team';
  end if;
end $$;

\echo 'Model: een team weggooien ruimt alles van dat team op'
