-- Bewijst dat twee trainers elkaars gegevens niet kunnen zien of wijzigen.
--
-- Dit is het duurste wat er in deze app kan stukgaan: als de regels lekken,
-- lekken er namen van kinderen van een ander team. Met één gebruiker is dat
-- onzichtbaar, dus het hoort een test te zijn en geen aanname.
--
-- De proef draait op de echte schema.sql, niet op een nabootsing ervan. Elke
-- controle stopt met een fout zodra hij niet klopt, dus psql eindigt dan met
-- een foutcode en de CI wordt rood.

\set ON_ERROR_STOP on

-- ---------- twee trainers ----------
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'tjaco@voorbeeld.nl'),
  ('22222222-2222-2222-2222-222222222222', 'matthijs@voorbeeld.nl'),
  ('33333333-3333-3333-3333-333333333333', 'vreemde@voorbeeld.nl');

-- ---------- Tjaco maakt een team en zet er gegevens in ----------
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111"}';

insert into public.teams (id, naam, eigenaar)
values ('aaaaaaaa-0000-0000-0000-000000000001', 'JO13-1', '11111111-1111-1111-1111-111111111111');

select public.toestand_opslaan(
  'aaaaaaaa-0000-0000-0000-000000000001',
  '{"teamName":"JO13-1","players":[{"id":"p1","name":"Bram"}]}'::jsonb,
  null
);

do $$ begin
  if (select count(*) from public.teams) <> 1 then
    raise exception 'de eigenaar ziet zijn eigen team niet';
  end if;
  if (select count(*) from public.team_toestand) <> 1 then
    raise exception 'de eigenaar ziet zijn eigen gegevens niet';
  end if;
end $$;
commit;

-- ---------- Matthijs mag er niet bij ----------
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222"}';

do $$
declare n int;
begin
  select count(*) into n from public.teams;
  if n <> 0 then raise exception 'een ander ziet % team(s) die niet van hem zijn', n; end if;

  select count(*) into n from public.team_toestand;
  if n <> 0 then raise exception 'een ander leest de gegevens van een team dat niet van hem is'; end if;

  select count(*) into n from public.teams where id = 'aaaaaaaa-0000-0000-0000-000000000001';
  if n <> 0 then raise exception 'gericht opvragen op id omzeilt de regels'; end if;
end $$;

-- Bijwerken raakt niets. Let op de tweede vorm: zónder where.
-- Met een where filtert de leesregel de rij er al uit, waardoor een veel te
-- ruime bijwerkregel onzichtbaar blijft. Zonder where niet — en dan is hij wel
-- degelijk te misbruiken. Nagegaan: met 'using (true)' raakte die ene update
-- een rij van een ander team en was de teamnaam daarna weg.
do $$
declare n int;
begin
  update public.team_toestand set data = '{"gekaapt":true}'::jsonb
   where team_id = 'aaaaaaaa-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'een ander kon de gegevens van een team overschrijven'; end if;

  update public.team_toestand set data = '{"gekaapt":true}'::jsonb;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'een ander kon zonder where % rij(en) van een ander overschrijven', n; end if;

  update public.teams set naam = 'gekaapt';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'een ander kon zonder where % team(s) van een ander hernoemen', n; end if;

  /* Verwijderen op team_toestand is helemaal niet toegekend, dus een rechtenfout
     is hier het goede antwoord. Alleen rijen raken is fout. */
  begin
    delete from public.team_toestand;
    get diagnostics n = row_count;
    if n <> 0 then raise exception 'een ander kon zonder where de gegevens van een ander verwijderen'; end if;
  exception when insufficient_privilege then null;
  end;

  update public.teams set naam = 'gekaapt'
   where id = 'aaaaaaaa-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'een ander kon de naam van andermans team wijzigen'; end if;

  delete from public.teams where id = 'aaaaaaaa-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'een ander kon andermans team verwijderen'; end if;
end $$;

-- een team op naam van iemand anders aanmaken mag niet
do $$ begin
  begin
    insert into public.teams (naam, eigenaar)
    values ('gekaapt', '11111111-1111-1111-1111-111111111111');
    raise exception 'een ander kon een team op naam van iemand anders aanmaken';
  exception when insufficient_privilege then null;
  end;
end $$;

-- en de opslagfunctie mag geen achterdeur zijn
do $$ begin
  begin
    perform public.toestand_opslaan(
      'aaaaaaaa-0000-0000-0000-000000000001', '{"gekaapt":true}'::jsonb, 1
    );
    raise exception 'de opslagfunctie liet een ander bij andermans team';
  exception when insufficient_privilege then null;
  end;
end $$;
commit;

-- ---------- en zonder inloggen komt er niets uit ----------
begin;
set local role anon;
do $$
declare n int;
begin
  begin
    select count(*) into n from public.teams;
    if n <> 0 then raise exception 'zonder inloggen zijn er % team(s) zichtbaar', n; end if;
  exception when insufficient_privilege then null;  -- geen rechten is ook goed
  end;
end $$;
commit;

-- ---------- de gegevens van de eigenaar staan er nog ----------
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111"}';
do $$ begin
  if (select data ->> 'teamName' from public.team_toestand) is distinct from 'JO13-1' then
    raise exception 'de gegevens van de eigenaar zijn onderweg veranderd';
  end if;
end $$;
commit;

\echo 'RLS: teams zijn gescheiden'

-- ==========================================================================
-- Meerdere trainers per team
-- ==========================================================================
-- Vanaf hier hangt de toegang aan een lidmaatschap. Dat maakt de vraag scherper:
-- wie erbij hoort moet erbij kunnen, en wie er niet bij hoort nog steeds niet.
-- Dat tweede is waar het om gaat — een uitnodiging voor de een mag geen deur
-- openzetten voor de ander.

-- ---------- de eigenaar is meteen lid ----------
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","email":"tjaco@voorbeeld.nl"}';
do $$ begin
  if not exists (
    select 1 from public.team_leden
     where team_id = 'aaaaaaaa-0000-0000-0000-000000000001'
       and gebruiker = '11111111-1111-1111-1111-111111111111'
       and rol = 'eigenaar'
  ) then raise exception 'wie een team aanmaakt is er geen lid van'; end if;
end $$;
commit;

-- ---------- Matthijs is nog steeds nergens ----------
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","email":"matthijs@voorbeeld.nl"}';
do $$
declare n int;
begin
  select count(*) into n from public.team_leden;
  if n <> 0 then raise exception 'een buitenstaander ziet % lidmaatschap(pen)', n; end if;

  select count(*) into n from public.uitnodigingen;
  if n <> 0 then raise exception 'een buitenstaander ziet uitnodigingen die niet voor hem zijn'; end if;

  -- zichzelf toelaten mag niet
  begin
    insert into public.team_leden (team_id, gebruiker)
    values ('aaaaaaaa-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222');
    raise exception 'een buitenstaander kon zichzelf lid maken';
  exception when insufficient_privilege then null;
  end;

  -- en zichzelf uitnodigen ook niet
  begin
    insert into public.uitnodigingen (team_id, email, door)
    values ('aaaaaaaa-0000-0000-0000-000000000001', 'matthijs@voorbeeld.nl',
            '22222222-2222-2222-2222-222222222222');
    raise exception 'een buitenstaander kon zichzelf uitnodigen';
  exception when insufficient_privilege then null;
  end;

  -- aannemen zonder uitnodiging levert niets op
  select count(*) into n from public.uitnodiging_aannemen();
  if n <> 0 then raise exception 'aannemen zonder uitnodiging leverde % team(s) op', n; end if;
end $$;
commit;

-- ---------- Tjaco nodigt Matthijs uit ----------
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","email":"tjaco@voorbeeld.nl"}';

insert into public.uitnodigingen (team_id, email, door)
values ('aaaaaaaa-0000-0000-0000-000000000001', 'Matthijs@Voorbeeld.nl',
        '11111111-1111-1111-1111-111111111111');

do $$ begin
  -- op naam van een ander uitnodigen mag niet, ook niet door de eigenaar
  begin
    insert into public.uitnodigingen (team_id, email, door)
    values ('aaaaaaaa-0000-0000-0000-000000000001', 'nog.iemand@voorbeeld.nl',
            '22222222-2222-2222-2222-222222222222');
    raise exception 'een uitnodiging kon op naam van iemand anders gezet worden';
  exception when insufficient_privilege then null;
  end;
end $$;
commit;

-- ---------- de uitgenodigde ziet hem, de vreemde niet ----------
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","email":"vreemde@voorbeeld.nl"}';
do $$
declare n int;
begin
  select count(*) into n from public.uitnodigingen;
  if n <> 0 then raise exception 'een vreemde ziet de uitnodiging voor iemand anders'; end if;
  select count(*) into n from public.uitnodiging_aannemen();
  if n <> 0 then raise exception 'een vreemde kon een uitnodiging aannemen die niet voor hem was'; end if;
  select count(*) into n from public.teams;
  if n <> 0 then raise exception 'een vreemde kwam er via het aannemen alsnog bij'; end if;
end $$;
commit;

-- ---------- Matthijs neemt aan ----------
-- Let op de hoofdletters. De uitnodiging staat op 'Matthijs@Voorbeeld.nl' en hij
-- logt in als 'MATTHIJS@voorbeeld.NL'. Geen van beide is kleingeschreven, dus
-- elke vergelijking moet aan allebei de kanten omlaag. Laat je er één weg, dan
-- doet de uitnodiging stilzwijgend niets — en dat is precies het soort fout
-- waarvan de trainer denkt dat hij zelf iets verkeerd heeft ingetypt.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","email":"MATTHIJS@voorbeeld.NL"}';
do $$
declare n int;
begin
  select count(*) into n from public.uitnodigingen;
  if n <> 1 then raise exception 'de uitgenodigde ziet zijn eigen uitnodiging niet'; end if;

  -- de naam wel, de gegevens niet: anders neem je iets aan zonder te weten wat
  if (select naam from public.teams where id = 'aaaaaaaa-0000-0000-0000-000000000001')
     is distinct from 'JO13-1' then
    raise exception 'de uitgenodigde ziet niet voor welk team hij gevraagd wordt';
  end if;
  select count(*) into n from public.team_toestand;
  if n <> 0 then raise exception 'de uitgenodigde komt al bij de gegevens voordat hij aanneemt'; end if;

  select count(*) into n from public.uitnodiging_aannemen();
  if n <> 1 then raise exception 'aannemen leverde % team(s) op in plaats van 1', n; end if;

  select count(*) into n from public.teams;
  if n <> 1 then raise exception 'na aannemen ziet de trainer % team(s)', n; end if;

  select count(*) into n from public.team_toestand;
  if n <> 1 then raise exception 'na aannemen komt de trainer niet bij de gegevens'; end if;

  select count(*) into n from public.uitnodigingen;
  if n <> 0 then raise exception 'de uitnodiging bleef staan na het aannemen'; end if;
end $$;
commit;

-- ---------- wat een tweede trainer wel en niet mag ----------
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","email":"matthijs@voorbeeld.nl"}';
do $$
declare n int;
begin
  -- bijhouden mag: dat is waarvoor hij is uitgenodigd
  perform public.toestand_opslaan(
    'aaaaaaaa-0000-0000-0000-000000000001',
    '{"teamName":"JO13-1","players":[{"id":"p1","name":"Bram"},{"id":"p2","name":"Sil"}]}'::jsonb,
    1
  );
  if (select jsonb_array_length(data -> 'players') from public.team_toestand) <> 2 then
    raise exception 'een tweede trainer kon de wedstrijd niet bijhouden';
  end if;

  -- het team hernoemen niet
  update public.teams set naam = 'van mij nu';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'een tweede trainer kon het team hernoemen'; end if;

  -- het team weggooien niet
  delete from public.teams;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'een tweede trainer kon het team verwijderen'; end if;

  -- anderen toelaten niet
  begin
    insert into public.team_leden (team_id, gebruiker)
    values ('aaaaaaaa-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333');
    raise exception 'een tweede trainer kon zelf iemand toelaten';
  exception when insufficient_privilege then null;
  end;

  -- en de eigenaar eruit zetten al helemaal niet
  delete from public.team_leden where rol = 'eigenaar';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'een tweede trainer kon de eigenaar eruit zetten'; end if;
end $$;
commit;

-- ---------- de eigenaar kan hem er weer uit zetten ----------
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","email":"tjaco@voorbeeld.nl"}';
do $$
declare n int;
begin
  -- maar zichzelf niet: een team zonder eigenaar is een team dat vastzit
  delete from public.team_leden where gebruiker = '11111111-1111-1111-1111-111111111111';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'de eigenaar kon zichzelf eruit zetten'; end if;

  delete from public.team_leden where gebruiker = '22222222-2222-2222-2222-222222222222';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'de eigenaar kon de tweede trainer er niet uit zetten'; end if;
end $$;
commit;

-- ---------- en dan is hij er ook echt uit ----------
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","email":"matthijs@voorbeeld.nl"}';
do $$
declare n int;
begin
  select count(*) into n from public.teams;
  if n <> 0 then raise exception 'een verwijderde trainer ziet het team nog'; end if;

  select count(*) into n from public.team_toestand;
  if n <> 0 then raise exception 'een verwijderde trainer leest de gegevens nog'; end if;

  update public.team_toestand set data = '{"gekaapt":true}'::jsonb;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'een verwijderde trainer kon zonder where nog schrijven'; end if;

  begin
    perform public.toestand_opslaan(
      'aaaaaaaa-0000-0000-0000-000000000001', '{"gekaapt":true}'::jsonb, 2
    );
    raise exception 'een verwijderde trainer kon nog opslaan';
  exception when insufficient_privilege then null;
  end;
end $$;
commit;

-- ---------- de gegevens zijn heel gebleven ----------
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","email":"tjaco@voorbeeld.nl"}';
do $$ begin
  if (select jsonb_array_length(data -> 'players') from public.team_toestand) <> 2 then
    raise exception 'wat de tweede trainer bijhield is onderweg kwijtgeraakt';
  end if;
end $$;
commit;

\echo 'RLS: lidmaatschap laat de juiste mensen binnen en de rest buiten'
