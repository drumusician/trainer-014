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
  ('22222222-2222-2222-2222-222222222222', 'matthijs@voorbeeld.nl');

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
