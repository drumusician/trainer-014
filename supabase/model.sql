-- Blaadje — het model in tabellen
--
-- Draait ná schema.sql en laat alles daarin met rust: team_toestand, het ene
-- JSON-blok waar de webapp mee werkt, blijft bestaan. Dit is waar de apps voor
-- iOS en Android tegenaan gaan werken, en waar de pagina voor ouders uit leest.
--
-- Waarom tabellen en geen blok meer: iemand anders dan de trainer gaat
-- meekijken. Een ouder mag de speeltijd zien en de notities niet, en dat
-- onderscheid kan de server in één blok niet maken.
--
-- Vier afspraken die overal terugkomen:
--
-- 1. Elke tabel heeft één sleutel, `id`, en die maakt het toestel zelf aan. Zo
--    kan een telefoon zonder bereik rijen aanmaken die later gewoon aankomen, en
--    het is wat gereedschap voor synchroniseren (PowerSync) van een tabel vraagt.
-- 2. Elke tabel draagt `team_id`, ook als dat via de wedstrijd al vaststaat. De
--    toegang is daardoor overal dezelfde ene vraag: ben je lid van dit team.
-- 3. Een verwijzing naar een speler of wedstrijd is altijd (id, team_id) samen.
--    Zonder dat kan een trainer in zijn eigen wedstrijd naar een kind van een
--    ander team wijzen, en dan zet de pagina voor ouders daar de naam bij.
-- 4. De app rekent, de server telt op. Speeltijd uit wissels terugrekenen
--    gebeurt op het toestel, één keer; hier staat de uitkomst per speler per
--    wedstrijd. De server kent de wisselregels niet en hoeft ze niet te kennen.
--
-- Verwijzingen naar een speler worden pas aan het eind van de transactie
-- nagekeken ('deferrable initially deferred'). Gooi je een team weg, dan ruimt
-- de database spelers en wedstrijden tegelijk op, en zonder dit struikelt hij
-- halverwege over een speler die nog even in een wedstrijd staat.
--
-- Te herhalen: alles staat achter 'if not exists' of 'or replace'.

-- ---------- seizoen ----------
-- Een seizoen loopt van 1 juli tot en met 30 juni: '2026/27'.
create or replace function public.seizoen_van(p_datum date) returns text
language sql immutable
as $$
  select case when extract(month from p_datum) >= 7
    then extract(year from p_datum)::int || '/' || lpad(((extract(year from p_datum)::int + 1) % 100)::text, 2, '0')
    else (extract(year from p_datum)::int - 1) || '/' || lpad((extract(year from p_datum)::int % 100)::text, 2, '0')
  end;
$$;

-- ---------- bijgewerkt ----------
create or replace function public.zet_bijgewerkt() returns trigger
language plpgsql
as $$
begin
  new.bijgewerkt := now();
  return new;
end;
$$;

-- ---------- van wie een team is ----------
-- De app maakt een team aan zonder te zeggen van wie het is; de database vult
-- in wie er op dat moment is ingelogd. Dat moet zo, omdat een team ook zonder
-- account gemaakt kan worden: op het toestel is er dan nog geen 'wie'. Pas bij
-- het opsturen, na het inloggen, staat vast van wie het is.
alter table public.teams alter column eigenaar set default auth.uid();

-- ---------- instellingen van het team ----------
-- Los van `teams`, want die mag alleen de eigenaar wijzigen (naam, weggooien),
-- en de formatie kiest ook de trainer die zaterdag invalt. De sleutel is die
-- van het team zelf: er is er precies één per team.
create table if not exists public.team_instellingen (
  id                   uuid primary key references public.teams (id) on delete cascade,
  formatie             text not null default '' check (length(formatie) <= 20),
  delen                smallint not null default 2 check (delen in (2, 4)),
  minuten_per_deel     smallint not null default 35 check (minuten_per_deel between 1 and 60),
  verslag_met_wissels  boolean not null default false,
  -- { formation, lineup: plek -> speler, bench: [speler] }. Alleen de app leest dit.
  standaardopstelling  jsonb,
  bijgewerkt           timestamptz not null default now()
);

-- ---------- spelers ----------
-- Een speler die weggaat wordt niet verwijderd maar krijgt `weg`: zijn
-- wedstrijden van eerder blijven kloppen. Echt verwijderen kan alleen zolang
-- hij nergens in voorkomt; daar zorgen de verwijzingen hieronder voor.
create table if not exists public.spelers (
  id          uuid primary key,
  team_id     uuid not null references public.teams (id) on delete cascade,
  naam        text not null check (length(naam) between 1 and 60),
  linie       text not null default '' check (linie in ('V', 'M', 'A', '')),
  keept       boolean not null default false,
  weg         timestamptz,
  gemaakt     timestamptz not null default now(),
  bijgewerkt  timestamptz not null default now(),
  unique (id, team_id)
);

create index if not exists spelers_team_idx on public.spelers (team_id);

-- ---------- wedstrijden ----------
-- Eén tabel voor de wedstrijd die loopt en voor de bewaarde. Wat alleen de app
-- nodig heeft om verder te kunnen (de klok, wie waar staat, het wisselplan)
-- staat als JSON in een kolom: daar zoekt niemand in, en het verandert als één
-- geheel. De uitslag staat er wél los bij, want die telt de server op.
create table if not exists public.wedstrijden (
  id                uuid primary key,
  team_id           uuid not null references public.teams (id) on delete cascade,
  datum             date not null,
  tegenstander      text not null default '' check (length(tegenstander) <= 80),
  thuis             boolean not null default true,
  status            text not null default 'gepland' check (status in ('gepland', 'bezig', 'afgelopen')),
  formatie          text not null default '' check (length(formatie) <= 20),
  delen             smallint not null default 2 check (delen in (2, 4)),
  minuten_per_deel  smallint not null default 35 check (minuten_per_deel between 1 and 60),
  doelpunten_voor   smallint not null default 0 check (doelpunten_voor >= 0),
  doelpunten_tegen  smallint not null default 0 check (doelpunten_tegen >= 0),
  -- hoe lang er echt gespeeld is, in seconden
  duur              integer not null default 0 check (duur >= 0),
  -- hoe het team heette toen de wedstrijd bewaard werd
  teamnaam          text check (length(teamnaam) <= 60),
  -- Van de trainer, voor de trainer. Komt nooit op de pagina voor ouders.
  notitie           text check (length(notitie) <= 4000),
  -- Wie hem bijhoudt, gezet bij de aftrap. Twee telefoons die tegelijk tikken
  -- zien dat aan elkaar.
  bijgehouden_door  uuid references auth.users (id) on delete set null,
  -- { elapsed, since, running, part, inBreak }
  klok              jsonb,
  -- plek -> speler, zoals het nu staat; na afloop zoals het eindigde
  opstelling        jsonb,
  -- [speler], in volgorde
  bank              jsonb,
  wisselplan        jsonb,
  gemaakt           timestamptz not null default now(),
  bijgewerkt        timestamptz not null default now(),
  unique (id, team_id)
);

create index if not exists wedstrijden_team_idx on public.wedstrijden (team_id, datum);

-- ---------- wie er was, en hoe lang hij speelde ----------
-- Eén rij per speler per wedstrijd. Vóór de aftrap staat hier alleen of hij er
-- is; na afloop schrijft de app erbij hoe lang hij speelde.
--
-- `aanwezig` staat er los bij omdat nul seconden twee dingen kan betekenen: hij
-- was er niet, of hij zat de hele wedstrijd op de bank. Voor eerlijke speeltijd
-- is dat het hele verschil.
create table if not exists public.wedstrijd_spelers (
  id               uuid primary key,
  team_id          uuid not null,
  wedstrijd_id     uuid not null,
  speler_id        uuid not null,
  -- de naam zoals hij die dag was
  naam             text not null check (length(naam) between 1 and 60),
  aanwezig         boolean not null default true,
  seconden         integer not null default 0 check (seconden >= 0),
  -- waarvan in het doel
  keeper_seconden  integer not null default 0 check (keeper_seconden >= 0),
  -- seconden per plek, bijvoorbeeld { "K": 2100, "LV": 2100 }
  posities         jsonb,
  bijgewerkt       timestamptz not null default now(),
  unique (wedstrijd_id, speler_id),
  foreign key (wedstrijd_id, team_id) references public.wedstrijden (id, team_id) on delete cascade,
  foreign key (speler_id, team_id) references public.spelers (id, team_id) deferrable initially deferred
);

create index if not exists wedstrijd_spelers_team_idx on public.wedstrijd_spelers (team_id);
create index if not exists wedstrijd_spelers_speler_idx on public.wedstrijd_spelers (speler_id);

-- ---------- wat er gebeurde ----------
-- Eén rij per aftrap, pauze, wissel of doelpunt. Erbij zetten en weghalen kan,
-- wijzigen niet. Daardoor botst er nooit iets: houden twee telefoons dezelfde
-- wedstrijd bij, dan komen de wissels van allebei aan in plaats van dat de een
-- de ander overschrijft.
--
-- Bij een ruil wisselen twee veldspelers van plek: `positie` en `speler` zijn
-- de ene kant, `positie_b` en `speler_b` de andere.
create table if not exists public.gebeurtenissen (
  id            uuid primary key,
  team_id       uuid not null,
  wedstrijd_id  uuid not null,
  soort         text not null check (soort in ('aftrap', 'pauze', 'einde', 'doelpunt', 'tegendoelpunt', 'wissel', 'ruil')),
  -- seconden na de aftrap
  t             integer not null check (t >= 0),
  -- bij een pauze: welk deel er net op zit
  deel          smallint check (deel between 1 and 4),
  -- bij een doelpunt: wie hem maakte, leeg als je het niet weet
  speler        uuid,
  assist        uuid,
  erin          uuid,
  eruit         uuid,
  positie       text check (length(positie) <= 10),
  positie_b     text check (length(positie_b) <= 10),
  speler_b      uuid,
  door          uuid references auth.users (id) on delete set null default auth.uid(),
  gemaakt       timestamptz not null default now(),
  foreign key (wedstrijd_id, team_id) references public.wedstrijden (id, team_id) on delete cascade,
  foreign key (speler, team_id)   references public.spelers (id, team_id) deferrable initially deferred,
  foreign key (assist, team_id)   references public.spelers (id, team_id) deferrable initially deferred,
  foreign key (erin, team_id)     references public.spelers (id, team_id) deferrable initially deferred,
  foreign key (eruit, team_id)    references public.spelers (id, team_id) deferrable initially deferred,
  foreign key (speler_b, team_id) references public.spelers (id, team_id) deferrable initially deferred
);

create index if not exists gebeurtenissen_wedstrijd_idx on public.gebeurtenissen (wedstrijd_id, t);
create index if not exists gebeurtenissen_team_idx on public.gebeurtenissen (team_id);

-- ---------- trainingen ----------
create table if not exists public.trainingen (
  id          uuid primary key,
  team_id     uuid not null references public.teams (id) on delete cascade,
  datum       date not null,
  gemaakt     timestamptz not null default now(),
  bijgewerkt  timestamptz not null default now(),
  unique (id, team_id)
);

create index if not exists trainingen_team_idx on public.trainingen (team_id, datum);

create table if not exists public.training_spelers (
  id           uuid primary key,
  team_id      uuid not null,
  training_id  uuid not null,
  speler_id    uuid not null,
  status       text not null check (status in ('aanwezig', 'afgemeld', 'afwezig')),
  bijgewerkt   timestamptz not null default now(),
  unique (training_id, speler_id),
  foreign key (training_id, team_id) references public.trainingen (id, team_id) on delete cascade,
  foreign key (speler_id, team_id) references public.spelers (id, team_id) deferrable initially deferred
);

create index if not exists training_spelers_team_idx on public.training_spelers (team_id);

-- ---------- de link voor ouders ----------
-- Elk kind heeft zijn eigen link, en de trainer stuurt die naar de ouder van dat
-- kind. De link is de sleutel: wie hem heeft ziet dat ene kind en geen ander.
-- Zo hoeft een ouder niet in te loggen, en bewaren we niets van hem.
--
-- Trainers nodig je uit op e-mailadres, omdat een code die rondslingert een
-- sleutel is die je niet terugkrijgt. Hier is het een afweging de andere kant
-- op: de link kan alleen lezen, alleen over één kind, en de trainer kan hem
-- intrekken en een nieuwe sturen.
create table if not exists public.deellinks (
  id           uuid primary key default gen_random_uuid(),
  team_id      uuid not null,
  speler_id    uuid not null,
  code         text not null unique default replace(gen_random_uuid()::text, '-', '')
               check (length(code) >= 20),
  gemaakt      timestamptz not null default now(),
  ingetrokken  timestamptz,
  foreign key (speler_id, team_id) references public.spelers (id, team_id) on delete cascade
);

create index if not exists deellinks_team_idx on public.deellinks (team_id);
-- Per kind één link die werkt. Een nieuwe maken kan pas als de oude is ingetrokken.
create unique index if not exists deellinks_een_per_kind on public.deellinks (speler_id) where ingetrokken is null;

-- ---------- de bijdrage van ouders ----------
-- Een ouder betaalt een euro voor zijn eigen kind, of in één keer voor het hele
-- team. De pagina voor ouders gaat open voor een kind waarvoor betaald is, en
-- voor iedereen zodra het team rond is.
--
-- Het team is rond als er dit seizoen bij elkaar tien euro binnen is, hoe dan
-- ook: tien losse euro's, of drie losse en iemand die de rest bijlegt. Daardoor
-- hoeft er nooit iets terugbetaald te worden. Wie voor het team betaalt, betaalt
-- wat er nog ontbreekt, en wat anderen al gaven telt gewoon mee.
--
-- `speler_id` zegt voor welk kind; leeg is voor het team. Geen naam en geen
-- adres van wie betaalt: we willen weten dát er betaald is, niet door wie.
-- `betaling` is het nummer bij de betaalprovider, en maakt dat dezelfde melding
-- twee keer binnenkrijgen niet twee bijdragen oplevert.
--
-- Niemand komt hier rechtstreeks bij. De server schrijft, met de sleutel die
-- langs de regels heen mag, zodra de betaalprovider meldt dat het rond is.
create table if not exists public.bijdragen (
  id           uuid primary key default gen_random_uuid(),
  team_id      uuid not null references public.teams (id) on delete cascade,
  speler_id    uuid,
  seizoen      text not null,
  bedrag_cent  integer not null check (bedrag_cent > 0),
  betaling     text not null unique,
  status       text not null default 'open' check (status in ('open', 'betaald', 'mislukt')),
  gemaakt      timestamptz not null default now(),
  betaald_op   timestamptz,
  foreign key (speler_id, team_id) references public.spelers (id, team_id) deferrable initially deferred
);

create index if not exists bijdragen_team_idx on public.bijdragen (team_id, seizoen);

-- De prijzen, op één plek.
create or replace function public.prijs_kind_cent() returns integer language sql immutable as $$ select 100 $$;
create or replace function public.prijs_team_cent() returns integer language sql immutable as $$ select 1000 $$;

-- ---------- bijgewerkt bijhouden ----------
do $$
declare t text;
begin
  foreach t in array array['team_instellingen', 'spelers', 'wedstrijden', 'wedstrijd_spelers', 'trainingen', 'training_spelers']
  loop
    execute format('drop trigger if exists %I on public.%I', t || '_bijgewerkt', t);
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.zet_bijgewerkt()',
      t || '_bijgewerkt', t
    );
  end loop;
end $$;

-- ---------- wie mag wat ----------
-- Overal dezelfde vraag: ben je lid van dit team. Geen uitzonderingen per
-- tabel, want elke uitzondering is een plek waar het later lekt.
alter table public.team_instellingen  enable row level security;
alter table public.spelers            enable row level security;
alter table public.wedstrijden        enable row level security;
alter table public.wedstrijd_spelers  enable row level security;
alter table public.gebeurtenissen     enable row level security;
alter table public.trainingen         enable row level security;
alter table public.training_spelers   enable row level security;
alter table public.deellinks          enable row level security;
alter table public.bijdragen          enable row level security;
-- bijdragen: geen enkele regel. Niemand leest of schrijft daar rechtstreeks.

do $$
declare t text;
begin
  foreach t in array array['spelers', 'wedstrijden', 'wedstrijd_spelers', 'gebeurtenissen', 'trainingen', 'training_spelers', 'deellinks']
  loop
    execute format('drop policy if exists "leden lezen" on public.%I', t);
    execute format('drop policy if exists "leden zetten erbij" on public.%I', t);
    execute format('drop policy if exists "leden werken bij" on public.%I', t);
    execute format('drop policy if exists "leden halen weg" on public.%I', t);
    execute format('create policy "leden lezen" on public.%I for select using (public.is_lid(team_id))', t);
    execute format('create policy "leden zetten erbij" on public.%I for insert with check (public.is_lid(team_id))', t);
    execute format('create policy "leden werken bij" on public.%I for update using (public.is_lid(team_id)) with check (public.is_lid(team_id))', t);
    execute format('create policy "leden halen weg" on public.%I for delete using (public.is_lid(team_id))', t);
  end loop;
end $$;

-- De instellingen hangen aan `id`, want dat ís het team.
drop policy if exists "leden lezen"        on public.team_instellingen;
drop policy if exists "leden zetten erbij" on public.team_instellingen;
drop policy if exists "leden werken bij"   on public.team_instellingen;
create policy "leden lezen" on public.team_instellingen for select using (public.is_lid(id));
create policy "leden zetten erbij" on public.team_instellingen for insert with check (public.is_lid(id));
create policy "leden werken bij" on public.team_instellingen for update using (public.is_lid(id)) with check (public.is_lid(id));

-- "Automatically expose new tables" staat uit, dus dit expliciet. Let op wat er
-- níét staat: een gebeurtenis kun je niet bijwerken, een deellink ook niet op
-- zijn code na (zie hieronder), en bij de bijdragen komt niemand.
grant select, insert, update         on public.team_instellingen to authenticated;
grant select, insert, update, delete on public.spelers           to authenticated;
grant select, insert, update, delete on public.wedstrijden       to authenticated;
grant select, insert, update, delete on public.wedstrijd_spelers to authenticated;
grant select, insert, delete         on public.gebeurtenissen    to authenticated;
grant select, insert, update, delete on public.trainingen        to authenticated;
grant select, insert, update, delete on public.training_spelers  to authenticated;
grant select, insert, delete         on public.deellinks         to authenticated;
-- Intrekken is het enige wat je aan een link verandert. De code en het team
-- staan vast: anders maak je van een ingetrokken link een nieuwe naar een ander team.
grant update (ingetrokken) on public.deellinks to authenticated;

-- ---------- de pagina voor ouders ----------
-- Wat iemand met de link van een kind te zien krijgt, en niets anders.
--
-- Altijd: de naam van het team, de voornaam van het kind, en hoe het met de
-- bijdrage staat. Dat is wat je nodig hebt om te kunnen betalen.
--
-- Met toegang (er is voor dit kind betaald, of het team is rond): de
-- wedstrijden van dit seizoen, gespeeld en gepland, en de trainingen met
-- daarbij of dit kind er was.
--
-- Over een ander kind staat er nooit iets op, ook geen naam.
--
-- Wat er met opzet evenmin in zit: de speeltijd, ook niet die van je eigen
-- kind. Dat klinkt als openheid en levert langs de lijn alleen discussie op;
-- het is een gegeven voor de trainers. Verder ook niet: de notities van de
-- trainer, de opstelling, het wisselplan, wie er scoorde, en wie de trainers zijn.
--
-- 'security definer', want wie de link opent is niet ingelogd en mag van de
-- regels hierboven nergens bij. Deze functie is de enige deur, en de code is de
-- sleutel. Klopt de code niet of is hij ingetrokken, dan komt er niets terug.
drop function if exists public.ouderpagina(text, uuid);

create or replace function public.ouderpagina(p_code text) returns jsonb
language plpgsql security definer stable
set search_path = public
as $$
declare
  v_team       uuid;
  v_speler     uuid;
  v_seizoen    text := public.seizoen_van(current_date);
  v_opgehaald  integer;
  v_rond       boolean;
  v_toegang    boolean;
  v_uit        jsonb;
begin
  select d.team_id, d.speler_id into v_team, v_speler
    from public.deellinks d
   where d.code = p_code and d.ingetrokken is null;
  if v_team is null then
    return null;
  end if;

  select coalesce(sum(b.bedrag_cent), 0) into v_opgehaald
    from public.bijdragen b
   where b.team_id = v_team and b.seizoen = v_seizoen and b.status = 'betaald';
  v_rond := v_opgehaald >= public.prijs_team_cent();
  v_toegang := v_rond or exists (
    select 1 from public.bijdragen b
     where b.team_id = v_team and b.seizoen = v_seizoen and b.status = 'betaald' and b.speler_id = v_speler
  );

  v_uit := jsonb_build_object(
    'team', (select t.naam from public.teams t where t.id = v_team),
    'seizoen', v_seizoen,
    'kind', (select s.naam from public.spelers s where s.id = v_speler),
    'bijdrage', jsonb_build_object(
      'opgehaald_cent', v_opgehaald,
      'team_cent', public.prijs_team_cent(),
      'kind_cent', public.prijs_kind_cent(),
      -- wat iemand nu betaalt om het voor het hele team rond te maken
      'nog_cent', greatest(public.prijs_team_cent() - v_opgehaald, 0),
      'team_rond', v_rond
    ),
    'toegang', v_toegang
  );
  if not v_toegang then
    return v_uit;
  end if;

  return v_uit || jsonb_build_object(
    'wedstrijden', coalesce((
      select jsonb_agg(jsonb_build_object(
               'datum', w.datum,
               'tegenstander', w.tegenstander,
               'thuis', w.thuis,
               'status', w.status,
               -- de uitslag pas als hij vaststaat
               'voor', case when w.status = 'afgelopen' then w.doelpunten_voor end,
               'tegen', case when w.status = 'afgelopen' then w.doelpunten_tegen end
             ) order by w.datum, w.gemaakt)
        from public.wedstrijden w
       where w.team_id = v_team and public.seizoen_van(w.datum) = v_seizoen
    ), '[]'::jsonb),
    -- Elke training van dit seizoen, met erbij of dit kind er was. Leeg als de
    -- trainer het die keer niet heeft bijgehouden.
    'trainingen', coalesce((
      select jsonb_agg(jsonb_build_object(
               'datum', tr.datum,
               'status', (select ts.status from public.training_spelers ts
                           where ts.training_id = tr.id and ts.speler_id = v_speler)
             ) order by tr.datum, tr.gemaakt)
        from public.trainingen tr
       where tr.team_id = v_team and public.seizoen_van(tr.datum) = v_seizoen
    ), '[]'::jsonb),
    'gemist', (
      select jsonb_build_object(
               'afgemeld', count(*) filter (where ts.status = 'afgemeld'),
               'afwezig',  count(*) filter (where ts.status = 'afwezig'))
        from public.training_spelers ts
        join public.trainingen tr on tr.id = ts.training_id
       where ts.speler_id = v_speler and public.seizoen_van(tr.datum) = v_seizoen
    )
  );
end;
$$;

revoke all on function public.ouderpagina(text) from public;
grant execute on function public.ouderpagina(text) to anon, authenticated;
