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
create or replace function public.volg(p_code text, p_token text, p_omgeving text default 'echt') returns boolean
language plpgsql security definer
set search_path = public
as $$
declare
  v_link uuid;
begin
  select d.id into v_link from public.deellinks d where d.code = p_code and d.ingetrokken is null;
  if v_link is null then
    return false;
  end if;
  insert into public.volgers (deellink_id, token, omgeving)
  values (v_link, p_token, case when p_omgeving = 'proef' then 'proef' else 'echt' end)
  on conflict (deellink_id, token) do update set omgeving = excluded.omgeving;
  return true;
end;
$$;

create or replace function public.ontvolg(p_code text, p_token text) returns void
language sql security definer
set search_path = public
as $$
  delete from public.volgers v
   using public.deellinks d
   where d.id = v.deellink_id and d.code = p_code and v.token = p_token;
$$;

revoke all on function public.volg(text, text, text) from public;
revoke all on function public.ontvolg(text, text) from public;
grant execute on function public.volg(text, text, text) to anon, authenticated;
grant execute on function public.ontvolg(text, text) to anon, authenticated;

-- ---------- wat een volger ziet ----------
-- Het team, de voornaam van het kind, de wedstrijden van dit seizoen (ook die
-- nu loopt, met de stand), en de trainingen met of dit kind er was.
-- Klopt de code niet of is hij ingetrokken, dan komt er niets terug.
create or replace function public.volgpagina(p_code text) returns jsonb
language plpgsql security definer stable
set search_path = public
as $$
declare
  v_team     uuid;
  v_speler   uuid;
  v_seizoen  text := public.seizoen_van(current_date);
begin
  select d.team_id, d.speler_id into v_team, v_speler
    from public.deellinks d
   where d.code = p_code and d.ingetrokken is null;
  if v_team is null then
    return null;
  end if;

  return jsonb_build_object(
    'team', (select t.naam from public.teams t where t.id = v_team),
    'kind', (select s.naam from public.spelers s where s.id = v_speler),
    'seizoen', v_seizoen,
    'wedstrijden', coalesce((
      select jsonb_agg(jsonb_build_object(
               'datum', w.datum,
               'tegenstander', w.tegenstander,
               'thuis', w.thuis,
               'status', w.status,
               -- de stand zodra er gespeeld wordt
               'voor', case when w.status <> 'gepland' then w.doelpunten_voor end,
               'tegen', case when w.status <> 'gepland' then w.doelpunten_tegen end
             ) order by w.datum, w.gemaakt)
        from public.wedstrijden w
       where w.team_id = v_team and public.seizoen_van(w.datum) = v_seizoen
    ), '[]'::jsonb),
    'trainingen', coalesce((
      select jsonb_agg(jsonb_build_object(
               'datum', tr.datum,
               'status', (select ts.status from public.training_spelers ts
                           where ts.training_id = tr.id and ts.speler_id = v_speler)
             ) order by tr.datum, tr.gemaakt)
        from public.trainingen tr
       where tr.team_id = v_team and public.seizoen_van(tr.datum) = v_seizoen
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.volgpagina(text) from public;
grant execute on function public.volgpagina(text) to anon, authenticated;

-- ---------- de melding bij een gebeurtenis ----------
-- Voor de serverfunctie die de meldingen verstuurt: wat moet er naar wie, voor
-- deze ene gebeurtenis. Niets (null) als er niets te melden valt:
--
-- - alleen de aftrap, een doelpunt, de rust en het einde; geen wissels;
-- - alleen bij een wedstrijd die bezig is. Wie een oud seizoen in zijn account
--   zet, stuurt geen honderd meldingen over wedstrijden van weken geleden;
-- - niet als het langer dan tien minuten geleden gebeurde. Had de trainer geen
--   bereik, dan komt alles na afloop tegelijk aan, en acht meldingen achter
--   elkaar is geen dienst. De eindstand komt dan nog wel, tot drie uur later;
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
  if g.gemaakt < now() - (case when g.soort = 'einde' then interval '3 hours' else interval '10 minutes' end) then
    return null;
  end if;
  -- Alleen de rust: bij vier kwarten zijn de andere pauzes geen nieuws.
  if g.soort = 'pauze' and coalesce(g.deel, 1) <> w.delen / 2 then
    return null;
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
      when 'aftrap' then 'De wedstrijd is begonnen'
      when 'tegendoelpunt' then 'Tegendoelpunt'
      when 'pauze' then 'Rust'
      else 'Afgelopen' end;
  end if;

  return jsonb_build_object('titel', v_stand, 'tekst', v_wat, 'wedstrijd', w.id, 'tokens', v_tokens);
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
grant execute on function public.melding_voor(uuid) to service_role;
grant execute on function public.vergeet_token(text) to service_role;
