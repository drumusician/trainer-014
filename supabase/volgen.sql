-- Blaadje — een wedstrijd volgen
--
-- Draait ná schema.sql en model.sql. Een ouder (of opa) opent in de app de link
-- van een kind en volgt daarmee dat kind: het programma, en tijdens de wedstrijd
-- een melding bij de aftrap, een doelpunt, de rust en het eindsignaal.
--
-- Wie volgt logt niet in en we weten niet wie het is. We bewaren alleen het
-- adres waarop zijn telefoon meldingen ontvangt, bij de link die hij opende.
--
-- Wat een volger nooit krijgt: speeltijd, wissels, de opstelling en de notities
-- van de trainer. Wel de voornaam van wie scoort: dat is waar het om gaat.
--
-- Te herhalen: alles staat achter 'if not exists' of 'or replace'.

-- ---------- de link voor het hele team ----------
-- Een link per kind is voor de trainer veertien berichten sturen. Wat een volger
-- vooral wil — de wedstrijd, de stand, de meldingen — is voor het hele team
-- hetzelfde. Dus kan een link ook van het team zijn: `speler_id` is dan leeg, en
-- hij gaat zo de groepsapp in. Wie hem opent ziet niets over een los kind.
-- De link per kind blijft, voor wie ook de trainingen van zijn eigen kind wil zien.
alter table public.deellinks alter column speler_id drop not null;
create unique index if not exists deellinks_een_per_team
  on public.deellinks (team_id) where speler_id is null and ingetrokken is null;
-- Zonder kind hangt de link alleen nog aan het team; gaat het team weg, dan hij ook.
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'deellinks_team_fkey') then
    alter table public.deellinks
      add constraint deellinks_team_fkey foreign key (team_id) references public.teams (id) on delete cascade;
  end if;
end $$;

-- ---------- wie er volgt ----------
-- `token` is het adres van de telefoon bij Apple. `omgeving` zegt via welke
-- deur Apple hem aanneemt: een app uit Xcode zit in de proefomgeving, een app
-- uit TestFlight of de winkel in de echte.
create table if not exists public.volgers (
  id           uuid primary key default gen_random_uuid(),
  deellink_id  uuid not null references public.deellinks (id) on delete cascade,
  token        text not null check (length(token) between 32 and 200),
  omgeving     text not null default 'echt' check (omgeving in ('echt', 'proef')),
  gemaakt      timestamptz not null default now(),
  unique (deellink_id, token)
);

create index if not exists volgers_token_idx on public.volgers (token);

-- Welke meldingen de deur al uit zijn. Een doelpunt waar later een assist bij
-- komt is voor de database een nieuwe rij, maar voor een ouder hetzelfde doelpunt.
create table if not exists public.meldingen (
  sleutel  text primary key,
  gemaakt  timestamptz not null default now()
);

-- Niemand komt hier rechtstreeks bij: geen enkele regel. Alles loopt via de
-- functies hieronder, en de code van de link is de sleutel.
alter table public.volgers   enable row level security;
alter table public.meldingen enable row level security;

-- ---------- volgen en ontvolgen ----------
-- `volg` zelf staat in taken.sql: daar kreeg hij het kind erbij.

create or replace function public.ontvolg(p_code text, p_token text) returns void
language sql security definer
set search_path = public
as $$
  delete from public.volgers v
   using public.deellinks d
   where d.id = v.deellink_id and d.code = p_code and v.token = p_token;
$$;

revoke all on function public.ontvolg(text, text) from public;
grant execute on function public.ontvolg(text, text) to anon, authenticated;

-- ---------- wat een volger ziet ----------
-- `volgpagina` staat in taken.sql: daar kwamen het programma en de taken erbij.

-- ---------- de melding bij een gebeurtenis ----------
-- Voor de serverfunctie die de meldingen verstuurt: wat moet er naar wie, voor
-- deze ene gebeurtenis. Niets (null) als er niets te melden valt:
--
-- - alleen de aftrap, een doelpunt, de rust en het einde; geen wissels;
-- - alleen bij een wedstrijd die bezig is. Wie een oud seizoen in zijn account
--   zet, stuurt geen honderd meldingen over wedstrijden van weken geleden;
-- - gebeurde het langer dan tien minuten geleden, dan geen losse melding. Had de
--   trainer geen bereik, dan komt alles tegelijk aan, en acht meldingen achter
--   elkaar is geen dienst. Dan komt er 'inhalen' terug, en volgt er even later
--   één samenvatting (`inhaalmelding`). Na drie uur is het geen nieuws meer;
-- - nooit twee keer hetzelfde.
create or replace function public.melding_voor(p_gebeurtenis uuid) returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  g         public.gebeurtenissen%rowtype;
  w         public.wedstrijden%rowtype;
  v_team    text;
  v_voor    integer;
  v_tegen   integer;
  v_naam    text;
  v_wat     text;
  v_stand   text;
  v_tokens  jsonb;
  v_nieuw   integer;
begin
  select * into g from public.gebeurtenissen where id = p_gebeurtenis;
  if not found or g.soort not in ('aftrap', 'doelpunt', 'tegendoelpunt', 'pauze', 'einde') then
    return null;
  end if;
  select * into w from public.wedstrijden where id = g.wedstrijd_id;
  if not found or w.status <> 'bezig' then
    return null;
  end if;
  -- Alleen voor een team dat aanstaat (abonnement.sql).
  if not public.team_aan(w.team_id) then
    return null;
  end if;
  -- Alleen de rust: bij vier kwarten zijn de andere pauzes geen nieuws.
  if g.soort = 'pauze' and coalesce(g.deel, 1) <> w.delen / 2 then
    return null;
  end if;
  if g.gemaakt < now() - interval '3 hours' then
    return null;
  end if;
  if g.gemaakt < now() - interval '10 minutes' then
    return jsonb_build_object('inhalen', true, 'wedstrijd', w.id);
  end if;

  select jsonb_agg(distinct jsonb_build_object('token', v.token, 'omgeving', v.omgeving)) into v_tokens
    from public.volgers v
    join public.deellinks d on d.id = v.deellink_id
   where d.team_id = w.team_id and d.ingetrokken is null;
  if v_tokens is null then
    return null;
  end if;

  insert into public.meldingen (sleutel)
  values (g.wedstrijd_id || '|' || g.soort || '|' || g.t || '|' || coalesce(g.speler::text, '') || '|' || coalesce(g.deel::text, ''))
  on conflict do nothing;
  get diagnostics v_nieuw = row_count;
  if v_nieuw = 0 then
    return null;
  end if;

  select t.naam into v_team from public.teams t where t.id = w.team_id;
  select count(*) filter (where e.soort = 'doelpunt'), count(*) filter (where e.soort = 'tegendoelpunt')
    into v_voor, v_tegen
    from public.gebeurtenissen e where e.wedstrijd_id = w.id;
  -- De thuisploeg eerst, zoals op het scorebord.
  v_stand := case when w.thuis
    then v_team || ' – ' || w.tegenstander || '  ' || v_voor || '–' || v_tegen
    else w.tegenstander || ' – ' || v_team || '  ' || v_tegen || '–' || v_voor end;

  if g.soort = 'doelpunt' then
    select s.naam into v_naam from public.spelers s where s.id = g.speler;
    v_wat := case when v_naam is null then 'Doelpunt!' else 'Doelpunt van ' || v_naam || '!' end;
  else
    v_wat := case g.soort
      when 'aftrap' then 'Aftrap'
      when 'tegendoelpunt' then 'Tegendoelpunt'
      when 'pauze' then 'Rust'
      else 'Afgelopen' end;
  end if;

  return jsonb_build_object('titel', v_stand, 'tekst', v_wat, 'wedstrijd', w.id, 'tokens', v_tokens);
end;
$$;

-- ---------- de samenvatting na even geen bereik ----------
-- Alles wat er in deze wedstrijd te melden viel en nog niet gemeld is, in één
-- bericht, met de stand van nu. De serverfunctie roept dit een paar tellen na
-- een 'inhalen' aan, zodat de rest van de stapel er dan ook is. Komen er tien
-- gebeurtenissen tegelijk binnen, dan vragen er tien om een samenvatting: de
-- eerste krijgt hem, de andere negen krijgen niets.
create or replace function public.inhaalmelding(p_wedstrijd uuid) returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  w          public.wedstrijden%rowtype;
  v_team     text;
  v_voor     integer;
  v_tegen    integer;
  v_stand    text;
  v_tokens   jsonb;
  v_makers   text[];
  v_zonder   integer;
  v_tegens   integer;
  v_einde    boolean;
  v_delen    text[] := '{}';
begin
  -- Eén tegelijk per wedstrijd, anders verdelen twee aanroepen de stapel onder elkaar.
  perform pg_advisory_xact_lock(hashtext(p_wedstrijd::text));
  select * into w from public.wedstrijden where id = p_wedstrijd;
  if not found or not public.team_aan(w.team_id) then
    return null;
  end if;

  with nieuw as (
    insert into public.meldingen (sleutel)
    select e.wedstrijd_id || '|' || e.soort || '|' || e.t || '|' || coalesce(e.speler::text, '') || '|' || coalesce(e.deel::text, '')
      from public.gebeurtenissen e
     where e.wedstrijd_id = p_wedstrijd
       and e.soort in ('doelpunt', 'tegendoelpunt', 'einde')
       and e.gemaakt >= now() - interval '3 hours'
    on conflict do nothing
    returning sleutel
  ), gemist as (
    select e.soort, s.naam
      from public.gebeurtenissen e
      left join public.spelers s on s.id = e.speler
     where e.wedstrijd_id = p_wedstrijd
       and (e.wedstrijd_id || '|' || e.soort || '|' || e.t || '|' || coalesce(e.speler::text, '') || '|' || coalesce(e.deel::text, ''))
           in (select sleutel from nieuw)
  )
  select array_agg(naam order by naam) filter (where soort = 'doelpunt' and naam is not null),
         count(*) filter (where soort = 'doelpunt' and naam is null),
         count(*) filter (where soort = 'tegendoelpunt'),
         coalesce(bool_or(soort = 'einde'), false)
    into v_makers, v_zonder, v_tegens, v_einde
    from gemist;
  if v_makers is null and v_zonder = 0 and v_tegens = 0 and not v_einde then
    return null;
  end if;

  select jsonb_agg(distinct jsonb_build_object('token', v.token, 'omgeving', v.omgeving)) into v_tokens
    from public.volgers v
    join public.deellinks d on d.id = v.deellink_id
   where d.team_id = w.team_id and d.ingetrokken is null;
  if v_tokens is null then
    return null;
  end if;

  select t.naam into v_team from public.teams t where t.id = w.team_id;
  select count(*) filter (where e.soort = 'doelpunt'), count(*) filter (where e.soort = 'tegendoelpunt')
    into v_voor, v_tegen
    from public.gebeurtenissen e where e.wedstrijd_id = w.id;
  v_stand := case when w.thuis
    then v_team || ' – ' || w.tegenstander || '  ' || v_voor || '–' || v_tegen
    else w.tegenstander || ' – ' || v_team || '  ' || v_tegen || '–' || v_voor end;

  if v_makers is not null then
    v_delen := v_delen || ('gescoord door ' || array_to_string(v_makers, ', '));
  end if;
  if v_zonder > 0 then
    v_delen := v_delen || (v_zonder || case when v_zonder = 1 then ' doelpunt' else ' doelpunten' end
                           || case when v_makers is not null then ' erbij' else '' end);
  end if;
  if v_tegens > 0 then
    v_delen := v_delen || (v_tegens || case when v_tegens = 1 then ' tegendoelpunt' else ' tegendoelpunten' end);
  end if;

  return jsonb_build_object(
    'titel', v_stand,
    'tekst', case when v_einde then 'Afgelopen' else 'De uitslag is aangepast' end
             || case when cardinality(v_delen) > 0 then ': ' || array_to_string(v_delen, ', ') else '' end,
    'wedstrijd', w.id,
    'tokens', v_tokens
  );
end;
$$;

-- Een adres dat Apple niet meer kent: die telefoon heeft de app niet meer.
create or replace function public.vergeet_token(p_token text) returns void
language sql security definer
set search_path = public
as $$
  delete from public.volgers where token = p_token;
$$;

-- Alleen de serverfunctie mag hierbij, met de sleutel die langs de regels heen mag.
revoke all on function public.melding_voor(uuid) from public, anon, authenticated;
revoke all on function public.vergeet_token(text) from public, anon, authenticated;
revoke all on function public.inhaalmelding(uuid) from public, anon, authenticated;
grant execute on function public.inhaalmelding(uuid) to service_role;
grant execute on function public.melding_voor(uuid) to service_role;
grant execute on function public.vergeet_token(text) to service_role;
