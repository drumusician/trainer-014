-- Blaadje — het programma en de taken
--
-- Draait ná schema.sql, model.sql, abonnement.sql en volgen.sql. De trainer of teamleider zet de
-- wedstrijden die komen er alvast in, en bij elke wedstrijd wie wat regelt:
-- limonade, rijden, fluiten, vlaggen, de teamtas. Een ouder kiest in de app één
-- keer zijn kind, ziet het programma met de taken, en kan zeggen "kan niet" of
-- een open taak overnemen. Bij een uitwedstrijd zegt hij zelf dat hij rijdt, en
-- bij elke wedstrijd die nog komt kan hij zijn kind afmelden.
--
-- Een wedstrijd in het programma is een gewone rij in `wedstrijden`, met status
-- 'gepland' en nog zonder klok. Op de dag zelf wordt diezelfde rij de wedstrijd;
-- de taken blijven er zo vanzelf aan vast zitten.
--
-- Te herhalen: alles staat achter 'if not exists' of 'or replace'.

-- ---------- hoe laat ----------
alter table public.wedstrijden add column if not exists aanvang text
  check (aanvang ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');

-- ---------- taken ----------
-- `speler_id` is de familie die het doet; leeg is open. `afgemeld_door` is de
-- familie die zei dat ze niet kon: de trainer ziet dat, en andere ouders krijgen
-- een melding dat er iets open staat.
create table if not exists public.taken (
  id             uuid primary key,
  team_id        uuid not null,
  wedstrijd_id   uuid not null,
  soort          text not null,
  speler_id      uuid,
  afgemeld_door  uuid,
  gemaakt        timestamptz not null default now(),
  bijgewerkt     timestamptz not null default now(),
  foreign key (wedstrijd_id, team_id) references public.wedstrijden (id, team_id) on delete cascade,
  foreign key (speler_id, team_id) references public.spelers (id, team_id) deferrable initially deferred,
  foreign key (afgemeld_door, team_id) references public.spelers (id, team_id) deferrable initially deferred
);

-- Welke taken er zijn. Los van de tabel, zodat er een bij kan.
alter table public.taken drop constraint if exists taken_soort_check;
alter table public.taken add constraint taken_soort_check
  check (soort in ('limonade', 'rijden', 'fluiten', 'vlaggen', 'velddienst', 'teamtas'));

-- De vereniging regelt het, zoals een clubscheidsrechter: dan is er geen
-- familie, en staat de taak toch niet open.
alter table public.taken add column if not exists vereniging boolean not null default false;

create index if not exists taken_team_idx on public.taken (team_id);
create index if not exists taken_wedstrijd_idx on public.taken (wedstrijd_id);

drop trigger if exists taken_bijgewerkt on public.taken;
create trigger taken_bijgewerkt before update on public.taken
  for each row execute function public.zet_bijgewerkt();

alter table public.taken enable row level security;
drop policy if exists "leden lezen" on public.taken;
drop policy if exists "leden zetten erbij" on public.taken;
drop policy if exists "leden werken bij" on public.taken;
drop policy if exists "leden halen weg" on public.taken;
create policy "leden lezen" on public.taken for select using (public.is_lid(team_id));
create policy "leden zetten erbij" on public.taken for insert with check (public.is_lid(team_id));
create policy "leden werken bij" on public.taken for update using (public.is_lid(team_id)) with check (public.is_lid(team_id));
create policy "leden halen weg" on public.taken for delete using (public.is_lid(team_id));
grant select, insert, update, delete on public.taken to authenticated;

-- ---------- welk kind hoort bij deze telefoon ----------
-- Met de link van het team kiest een ouder één keer zijn kind. Met de link van
-- een kind is dat het kind van de link. Zo weet de app welke taken van jou zijn.
alter table public.volgers add column if not exists speler_id uuid
  references public.spelers (id) on delete set null;

-- Het kind dat bij een volger hoort: dat van de link, anders het gekozen kind.
create or replace function public.kind_van(p_code text, p_token text) returns table (team uuid, speler uuid)
language sql security definer stable
set search_path = public
as $$
  select d.team_id, coalesce(d.speler_id, v.speler_id)
    from public.deellinks d
    left join public.volgers v on v.deellink_id = d.id and v.token = p_token
   where d.code = p_code and d.ingetrokken is null;
$$;
revoke all on function public.kind_van(text, text) from public, anon, authenticated;

drop function if exists public.volg(text, text, text);
create or replace function public.volg(
  p_code text, p_token text, p_omgeving text default 'echt', p_speler uuid default null
) returns boolean
language plpgsql security definer
set search_path = public
as $$
declare
  v_link    uuid;
  v_team    uuid;
  v_speler  uuid;
begin
  select d.id, d.team_id, d.speler_id into v_link, v_team, v_speler
    from public.deellinks d where d.code = p_code and d.ingetrokken is null;
  if v_link is null then
    return false;
  end if;
  -- Alleen een kind van dit team, en niet als de link al van een kind is.
  if v_speler is null and p_speler is not null
     and exists (select 1 from public.spelers s where s.id = p_speler and s.team_id = v_team and s.weg is null) then
    v_speler := p_speler;
  elsif v_speler is not null then
    v_speler := null; -- staat al op de link
  end if;
  insert into public.volgers (deellink_id, token, omgeving, speler_id)
  values (v_link, p_token, case when p_omgeving = 'proef' then 'proef' else 'echt' end, v_speler)
  on conflict (deellink_id, token) do update
    set omgeving = excluded.omgeving,
        speler_id = coalesce(excluded.speler_id, public.volgers.speler_id);
  return true;
end;
$$;

-- Een ander kind kiezen, of een kind kiezen nadat je al volgde.
create or replace function public.kies_kind(p_code text, p_token text, p_speler uuid) returns boolean
language plpgsql security definer
set search_path = public
as $$
declare
  v_aantal integer;
begin
  update public.volgers v
     set speler_id = p_speler
    from public.deellinks d
   where d.id = v.deellink_id and d.code = p_code and d.ingetrokken is null and d.speler_id is null
     and v.token = p_token
     and exists (select 1 from public.spelers s where s.id = p_speler and s.team_id = d.team_id and s.weg is null);
  get diagnostics v_aantal = row_count;
  return v_aantal > 0;
end;
$$;

revoke all on function public.volg(text, text, text, uuid) from public;
revoke all on function public.kies_kind(text, text, uuid) from public;
grant execute on function public.volg(text, text, text, uuid) to anon, authenticated;
grant execute on function public.kies_kind(text, text, uuid) to anon, authenticated;

-- ---------- wat een volger ziet ----------
-- Zoals in volgen.sql, en daarbij: de voornamen van het team (om je kind te
-- kiezen), welk kind bij deze telefoon hoort, en bij elke wedstrijd die nog komt
-- de aanvang en de taken. Wie een taak heeft staat erbij met de voornaam van
-- het kind; dat is hoe een team het ook in de app-groep zegt.
drop function if exists public.volgpagina(text);
create or replace function public.volgpagina(p_code text, p_token text default null) returns jsonb
language plpgsql security definer stable
set search_path = public
as $$
declare
  v_team     uuid;
  v_link     uuid;
  v_mijn     uuid;
  v_seizoen  text := public.seizoen_van(current_date);
begin
  select d.team_id, d.speler_id into v_team, v_link
    from public.deellinks d
   where d.code = p_code and d.ingetrokken is null;
  if v_team is null then
    return null;
  end if;
  select k.speler into v_mijn from public.kind_van(p_code, p_token) k;

  -- Staat het team niet aan, dan alleen de naam: de app zegt dan dat de trainer
  -- het team moet aanzetten.
  if not public.team_aan(v_team) then
    return jsonb_build_object(
      'team', (select t.naam from public.teams t where t.id = v_team),
      'aan', false, 'kind', null, 'mijn_kind', null, 'spelers', '[]'::jsonb,
      'seizoen', v_seizoen, 'wedstrijden', '[]'::jsonb, 'trainingen', '[]'::jsonb);
  end if;

  return jsonb_build_object(
    'aan', true,
    'team', (select t.naam from public.teams t where t.id = v_team),
    -- het kind van de link; met de link van het team staat hier niets
    'kind', (select s.naam from public.spelers s where s.id = v_link),
    'mijn_kind', (select jsonb_build_object('id', s.id, 'naam', s.naam) from public.spelers s where s.id = v_mijn),
    -- om je kind te kiezen, alleen met de link van het team
    'spelers', case when v_link is null then coalesce((
      select jsonb_agg(jsonb_build_object('id', s.id, 'naam', s.naam) order by s.naam)
        from public.spelers s where s.team_id = v_team and s.weg is null
    ), '[]'::jsonb) else '[]'::jsonb end,
    'seizoen', v_seizoen,
    'wedstrijden', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', w.id,
               'datum', w.datum,
               'aanvang', w.aanvang,
               'tegenstander', w.tegenstander,
               'thuis', w.thuis,
               'status', w.status,
               'voor', case when w.status <> 'gepland' then w.doelpunten_voor end,
               'tegen', case when w.status <> 'gepland' then w.doelpunten_tegen end,
               -- jouw kind is afgemeld
               'kan_niet', exists (select 1 from public.wedstrijd_spelers ws
                                    where ws.wedstrijd_id = w.id and ws.speler_id = v_mijn and not ws.aanwezig),
               'taken', case when w.status <> 'afgelopen' then coalesce((
                 select jsonb_agg(jsonb_build_object(
                          'id', tk.id,
                          'soort', tk.soort,
                          'wie', case when tk.vereniging then 'Vereniging' else s.naam end,
                          'van_mij', coalesce(tk.speler_id = v_mijn, false)
                        ) order by tk.gemaakt, tk.id)
                   from public.taken tk
                   left join public.spelers s on s.id = tk.speler_id
                  where tk.wedstrijd_id = w.id
               ), '[]'::jsonb) else '[]'::jsonb end
             ) order by w.datum, w.aanvang nulls last, w.gemaakt)
        from public.wedstrijden w
       where w.team_id = v_team and public.seizoen_van(w.datum) = v_seizoen
    ), '[]'::jsonb),
    'trainingen', coalesce((
      select jsonb_agg(jsonb_build_object(
               'datum', tr.datum,
               'status', (select ts.status from public.training_spelers ts
                           where ts.training_id = tr.id and ts.speler_id = v_link)
             ) order by tr.datum, tr.gemaakt)
        from public.trainingen tr
       where tr.team_id = v_team and public.seizoen_van(tr.datum) = v_seizoen
         and v_link is not null
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.volgpagina(text, text) from public;
grant execute on function public.volgpagina(text, text) to anon, authenticated;

-- ---------- kan niet, of doe ik ----------
-- Alleen voor een wedstrijd die nog komt, alleen je eigen taak teruggeven, en
-- alleen een open taak overnemen.
create or replace function public.taak_kan_niet(p_code text, p_token text, p_taak uuid) returns boolean
language plpgsql security definer
set search_path = public
as $$
declare
  v_team   uuid;
  v_kind   uuid;
  v_aantal integer;
begin
  select k.team, k.speler into v_team, v_kind from public.kind_van(p_code, p_token) k;
  if v_kind is null then
    return false;
  end if;
  update public.taken tk
     set speler_id = null, afgemeld_door = v_kind
    from public.wedstrijden w
   where tk.id = p_taak and tk.team_id = v_team and tk.speler_id = v_kind
     and w.id = tk.wedstrijd_id and w.status <> 'afgelopen';
  get diagnostics v_aantal = row_count;
  return v_aantal > 0;
end;
$$;

create or replace function public.taak_doe_ik(p_code text, p_token text, p_taak uuid) returns boolean
language plpgsql security definer
set search_path = public
as $$
declare
  v_team   uuid;
  v_kind   uuid;
  v_aantal integer;
begin
  select k.team, k.speler into v_team, v_kind from public.kind_van(p_code, p_token) k;
  if v_kind is null then
    return false;
  end if;
  update public.taken tk
     set speler_id = v_kind, afgemeld_door = null
    from public.wedstrijden w
   where tk.id = p_taak and tk.team_id = v_team and tk.speler_id is null and not tk.vereniging
     and w.id = tk.wedstrijd_id and w.status <> 'afgelopen';
  get diagnostics v_aantal = row_count;
  return v_aantal > 0;
end;
$$;

revoke all on function public.taak_kan_niet(text, text, uuid) from public;
revoke all on function public.taak_doe_ik(text, text, uuid) from public;
grant execute on function public.taak_kan_niet(text, text, uuid) to anon, authenticated;
grant execute on function public.taak_doe_ik(text, text, uuid) to anon, authenticated;

-- ---------- rijden ----------
-- Rijden is aanbieden, geen beurt die je krijgt: een ouder zegt zelf dat hij
-- rijdt, en dat is een taak rijden bij zijn kind. Zette de trainer een open plek
-- neer, dan vult hij die. Toch niet: de taak gaat weg, zonder vraag aan de rest.
create or replace function public.ik_rijd(p_code text, p_token text, p_wedstrijd uuid, p_rijd boolean) returns boolean
language plpgsql security definer
set search_path = public
as $$
declare
  v_team  uuid;
  v_kind  uuid;
  v_open  uuid;
begin
  select k.team, k.speler into v_team, v_kind from public.kind_van(p_code, p_token) k;
  if v_kind is null or not exists (
    select 1 from public.wedstrijden w
     where w.id = p_wedstrijd and w.team_id = v_team and not w.thuis and w.status <> 'afgelopen'
  ) then
    return false;
  end if;
  if not p_rijd then
    delete from public.taken
     where wedstrijd_id = p_wedstrijd and team_id = v_team and soort = 'rijden' and speler_id = v_kind;
    return true;
  end if;
  if exists (select 1 from public.taken
              where wedstrijd_id = p_wedstrijd and team_id = v_team and soort = 'rijden' and speler_id = v_kind) then
    return true;
  end if;
  select tk.id into v_open from public.taken tk
   where tk.wedstrijd_id = p_wedstrijd and tk.team_id = v_team and tk.soort = 'rijden'
     and tk.speler_id is null and not tk.vereniging
   order by tk.gemaakt, tk.id limit 1
   for update skip locked;
  if v_open is not null then
    update public.taken set speler_id = v_kind, afgemeld_door = null where id = v_open;
  else
    insert into public.taken (id, team_id, wedstrijd_id, soort, speler_id)
    values (gen_random_uuid(), v_team, p_wedstrijd, 'rijden', v_kind);
  end if;
  return true;
end;
$$;

-- ---------- afmelden ----------
-- Een kind dat niet kan, staat als afwezig bij de wedstrijd. De trainer ziet
-- het in het programma, en op de dag zelf staat het kind bij "Wie is er?" al
-- op afwezig. Alleen zolang de trainer de wedstrijd nog niet opzette (geen
-- klok): daarna hoort hij het liever even zelf.
--
-- Het kenmerk van de rij is hetzelfde als de app hem geeft (SyncModel.uuid in
-- BlaadjeKern, kenmerk in rijen.ts): anders zet de app er een tweede naast.
create or replace function public.rij_kenmerk(p_team uuid, p_kenmerk text) returns uuid
language sql immutable
set search_path = public
as $$
  select (substr(h, 1, 8) || '-' || substr(h, 9, 4) || '-' || substr(h, 13, 4) || '-'
          || substr(h, 17, 4) || '-' || substr(h, 21, 12))::uuid
    from (select encode(set_byte(set_byte(b, 6, (get_byte(b, 6) & 15) | 80), 8, (get_byte(b, 8) & 63) | 128), 'hex') as h
            from (select substring(sha256(convert_to(p_team::text || '|' || p_kenmerk, 'UTF8')) from 1 for 16) as b) x) y;
$$;

create or replace function public.kind_kan_niet(p_code text, p_token text, p_wedstrijd uuid, p_kan_niet boolean) returns boolean
language plpgsql security definer
set search_path = public
as $$
declare
  v_team  uuid;
  v_kind  uuid;
begin
  select k.team, k.speler into v_team, v_kind from public.kind_van(p_code, p_token) k;
  if v_kind is null or not exists (
    select 1 from public.wedstrijden w
     where w.id = p_wedstrijd and w.team_id = v_team and w.status = 'gepland' and w.klok is null
  ) then
    return false;
  end if;
  if p_kan_niet then
    insert into public.wedstrijd_spelers (id, team_id, wedstrijd_id, speler_id, naam, aanwezig)
    select public.rij_kenmerk(v_team, 'ws|' || p_wedstrijd || '|' || v_kind), v_team, p_wedstrijd, v_kind, s.naam, false
      from public.spelers s where s.id = v_kind
    on conflict (wedstrijd_id, speler_id) do update set aanwezig = false;
  else
    delete from public.wedstrijd_spelers where wedstrijd_id = p_wedstrijd and speler_id = v_kind;
  end if;
  return true;
end;
$$;

revoke all on function public.ik_rijd(text, text, uuid, boolean) from public;
revoke all on function public.kind_kan_niet(text, text, uuid, boolean) from public;
revoke all on function public.rij_kenmerk(uuid, text) from public, anon, authenticated;
grant execute on function public.ik_rijd(text, text, uuid, boolean) to anon, authenticated;
grant execute on function public.kind_kan_niet(text, text, uuid, boolean) to anon, authenticated;

-- ---------- herinneringen ----------
-- Elke minuut vraagt de serverfunctie `meld` wat er nu de deur uit moet. Drie
-- soorten, en elk hooguit één keer (de tabel `meldingen` onthoudt het):
--
-- 1. De avond ervoor, tussen 19 en 22 uur: per familie wat ze morgen doen.
-- 2. Limonade, als de rust over tien minuten of minder begint.
-- 3. Een taak die openviel omdat een familie niet kon: naar de rest van het team.
--    Alleen de eerste dag; daarna is het geen nieuws meer.
--
-- `p_nu` is er voor de proef; normaal is het nu.
create or replace function public.herinneringen(p_nu timestamptz default now()) returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_lokaal  timestamp := p_nu at time zone 'Europe/Amsterdam';
  v_uit     jsonb := '[]'::jsonb;
  r         record;
  v_dagen   text[] := '{zo,ma,di,wo,do,vr,za}';
  v_maanden text[] := '{jan,feb,mrt,apr,mei,jun,jul,aug,sep,okt,nov,dec}';
begin
  -- 1. de avond ervoor
  if extract(hour from v_lokaal) between 19 and 21 then
    for r in
      select w.id as wedstrijd, w.tegenstander, w.aanvang, tk.speler_id,
             string_agg(tk.soort, ' en ' order by tk.soort) as wat,
             (select jsonb_agg(distinct jsonb_build_object('token', v.token, 'omgeving', v.omgeving))
                from public.volgers v
                join public.deellinks d on d.id = v.deellink_id
               where d.team_id = w.team_id and d.ingetrokken is null
                 and coalesce(d.speler_id, v.speler_id) = tk.speler_id) as tokens
        from public.taken tk
        join public.wedstrijden w on w.id = tk.wedstrijd_id
       where w.datum = v_lokaal::date + 1 and w.status = 'gepland' and tk.speler_id is not null
         and public.team_aan(w.team_id, p_nu)
       group by w.id, w.tegenstander, w.aanvang, w.team_id, tk.speler_id
    loop
      continue when r.tokens is null;
      insert into public.meldingen (sleutel) values ('avond|' || r.wedstrijd || '|' || r.speler_id)
      on conflict do nothing;
      continue when not found;
      v_uit := v_uit || jsonb_build_object(
        'titel', 'Morgen tegen ' || r.tegenstander || coalesce(', ' || r.aanvang, ''),
        'tekst', 'Jullie regelen: ' || r.wat || '.',
        'tokens', r.tokens);
    end loop;
  end if;

  -- 2. limonade, vlak voor de rust
  for r in
    select w.id as wedstrijd, w.tegenstander, tk.speler_id,
           (select jsonb_agg(distinct jsonb_build_object('token', v.token, 'omgeving', v.omgeving))
              from public.volgers v
              join public.deellinks d on d.id = v.deellink_id
             where d.team_id = w.team_id and d.ingetrokken is null
               and coalesce(d.speler_id, v.speler_id) = tk.speler_id) as tokens,
           (w.delen / 2) * w.minuten_per_deel * 60
             - ((w.klok->>'elapsed')::float8 + (extract(epoch from p_nu) * 1000 - (w.klok->>'since')::float8) / 1000) as nog
      from public.wedstrijden w
      join public.taken tk on tk.wedstrijd_id = w.id and tk.soort = 'limonade' and tk.speler_id is not null
     where w.status = 'bezig' and public.team_aan(w.team_id, p_nu)
       and (w.klok->>'running')::boolean is true
       and coalesce((w.klok->>'inBreak')::boolean, false) is false
       and (w.klok->>'part')::int = w.delen / 2
       and w.klok->>'since' is not null
  loop
    continue when r.tokens is null or r.nog > 600 or r.nog < -900;
    insert into public.meldingen (sleutel) values ('limonade|' || r.wedstrijd || '|' || r.speler_id)
    on conflict do nothing;
    continue when not found;
    v_uit := v_uit || jsonb_build_object(
      'titel', 'Bijna rust',
      'tekst', 'Jullie hebben de limonade.',
      'tokens', r.tokens);
  end loop;

  -- 3. een taak die openviel
  for r in
    select tk.id as taak, tk.soort, tk.afgemeld_door, w.tegenstander, w.datum,
           (select jsonb_agg(distinct jsonb_build_object('token', v.token, 'omgeving', v.omgeving))
              from public.volgers v
              join public.deellinks d on d.id = v.deellink_id
             where d.team_id = w.team_id and d.ingetrokken is null
               and coalesce(d.speler_id, v.speler_id) is distinct from tk.afgemeld_door) as tokens
      from public.taken tk
      join public.wedstrijden w on w.id = tk.wedstrijd_id
     where tk.speler_id is null and tk.afgemeld_door is not null and not tk.vereniging
       and tk.bijgewerkt > p_nu - interval '1 day'
       and w.status <> 'afgelopen' and w.datum >= v_lokaal::date
       and public.team_aan(w.team_id, p_nu)
  loop
    continue when r.tokens is null;
    insert into public.meldingen (sleutel) values ('open|' || r.taak || '|' || r.afgemeld_door)
    on conflict do nothing;
    continue when not found;
    v_uit := v_uit || jsonb_build_object(
      'titel', 'Kan iemand ' || case r.soort
                                  when 'limonade' then 'de limonade doen'
                                  when 'teamtas' then 'de teamtas meenemen'
                                  when 'velddienst' then 'de velddienst doen'
                                  else r.soort end || '?',
      'tekst', 'Tegen ' || r.tegenstander || ', ' || v_dagen[extract(dow from r.datum)::int + 1] || ' '
               || extract(day from r.datum)::int || ' ' || v_maanden[extract(month from r.datum)::int]
               || '. Tik om het over te nemen.',
      'tokens', r.tokens);
  end loop;

  return v_uit;
end;
$$;

revoke all on function public.herinneringen(timestamptz) from public, anon, authenticated;
grant execute on function public.herinneringen(timestamptz) to service_role;
