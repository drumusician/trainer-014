-- Blaadje — databaseschema
-- Plak dit in de SQL editor van je Supabase-project en voer het uit.
-- Alles staat achter Row Level Security: zonder ingelogde eigenaar komt er niets uit.

-- ---------- teams ----------
-- Eén trainer kan meerdere teams hebben. De namen van de kinderen staan in de
-- toestand hieronder, niet hier.
create table if not exists public.teams (
  id        uuid primary key default gen_random_uuid(),
  naam      text not null check (length(naam) between 1 and 60),
  eigenaar  uuid not null references auth.users (id) on delete cascade,
  gemaakt   timestamptz not null default now()
);

create index if not exists teams_eigenaar_idx on public.teams (eigenaar);

-- ---------- toestand ----------
-- De hele app-toestand als één document: selectie, standaardopstelling,
-- trainingen en archief. Dat is precies wat de app nu ook in localStorage zet,
-- dus synchroniseren is opsturen en terughalen, zonder vertaalslag.
-- `versie` telt bij elke opslag op, zodat laptop en telefoon elkaar niet
-- stilletjes overschrijven.
create table if not exists public.team_toestand (
  team_id     uuid primary key references public.teams (id) on delete cascade,
  data        jsonb not null,
  versie      bigint not null default 1,
  bijgewerkt  timestamptz not null default now()
);

-- ---------- rechten ----------
alter table public.teams          enable row level security;
alter table public.team_toestand  enable row level security;

drop policy if exists "eigen teams lezen"      on public.teams;
drop policy if exists "eigen teams aanmaken"   on public.teams;
drop policy if exists "eigen teams bijwerken"  on public.teams;
drop policy if exists "eigen teams verwijderen" on public.teams;

create policy "eigen teams lezen"       on public.teams for select using (auth.uid() = eigenaar);
create policy "eigen teams aanmaken"    on public.teams for insert with check (auth.uid() = eigenaar);
create policy "eigen teams bijwerken"   on public.teams for update using (auth.uid() = eigenaar);
create policy "eigen teams verwijderen" on public.teams for delete using (auth.uid() = eigenaar);

drop policy if exists "eigen toestand lezen"    on public.team_toestand;
drop policy if exists "eigen toestand schrijven" on public.team_toestand;
drop policy if exists "eigen toestand bijwerken" on public.team_toestand;

create policy "eigen toestand lezen" on public.team_toestand for select
  using (exists (select 1 from public.teams t where t.id = team_id and t.eigenaar = auth.uid()));
create policy "eigen toestand schrijven" on public.team_toestand for insert
  with check (exists (select 1 from public.teams t where t.id = team_id and t.eigenaar = auth.uid()));
create policy "eigen toestand bijwerken" on public.team_toestand for update
  using (exists (select 1 from public.teams t where t.id = team_id and t.eigenaar = auth.uid()));

-- ---------- opslaan met versiecontrole ----------
-- De app stuurt de versie mee die hij dacht te hebben. Klopt die niet, dan is er
-- op een ander toestel iets veranderd en krijgt de app dat te horen in plaats van
-- dat het werk van de ander verdwijnt.
create or replace function public.toestand_opslaan(
  p_team_id uuid,
  p_data jsonb,
  p_verwachte_versie bigint
) returns public.team_toestand
language plpgsql
security invoker
set search_path = public
as $$
declare
  huidig public.team_toestand;
begin
  select * into huidig from public.team_toestand where team_id = p_team_id;

  if not found then
    insert into public.team_toestand (team_id, data, versie, bijgewerkt)
    values (p_team_id, p_data, 1, now())
    returning * into huidig;
    return huidig;
  end if;

  if p_verwachte_versie is distinct from huidig.versie then
    raise exception 'versie loopt niet gelijk (hier %, jij %)', huidig.versie, p_verwachte_versie
      using errcode = '40001';
  end if;

  update public.team_toestand
     set data = p_data, versie = huidig.versie + 1, bijgewerkt = now()
   where team_id = p_team_id
  returning * into huidig;

  return huidig;
end;
$$;

revoke all on function public.toestand_opslaan(uuid, jsonb, bigint) from public;
grant execute on function public.toestand_opslaan(uuid, jsonb, bigint) to authenticated;

-- ---------- toegang tot de tabellen ----------
-- "Automatically expose new tables" staat uit, dus dit expliciet:
grant select, insert, update, delete on public.teams         to authenticated;
grant select, insert, update         on public.team_toestand to authenticated;

-- ==========================================================================
-- Meerdere trainers per team
-- ==========================================================================
-- Een team is van één iemand, maar zaterdag staat er soms een ander langs de
-- lijn. Vanaf hier hangt de toegang niet meer aan het eigenaarsveld maar aan
-- een lidmaatschap. De eigenaar blijft de enige die het team kan hernoemen,
-- verwijderen en mensen kan toelaten.
--
-- Dit stuk is te herhalen: alles staat achter 'if not exists' of 'or replace',
-- en de bijvulling onderaan slaat over wat er al is.

create table if not exists public.team_leden (
  team_id     uuid not null references public.teams (id) on delete cascade,
  gebruiker   uuid not null references auth.users (id) on delete cascade,
  rol         text not null default 'trainer' check (rol in ('eigenaar', 'trainer')),
  toegevoegd  timestamptz not null default now(),
  primary key (team_id, gebruiker)
);

create index if not exists team_leden_gebruiker_idx on public.team_leden (gebruiker);

-- Uitnodigen gaat op e-mailadres, niet met een deelbare code. Een code die
-- rondslingert in een groepsapp is een sleutel die je niet meer terugkrijgt;
-- een adres is een naam die je herkent en weer kunt intrekken.
create table if not exists public.uitnodigingen (
  id       uuid primary key default gen_random_uuid(),
  team_id  uuid not null references public.teams (id) on delete cascade,
  email    text not null check (position('@' in email) > 1 and length(email) <= 200),
  door     uuid not null references auth.users (id) on delete cascade,
  gemaakt  timestamptz not null default now()
);

create unique index if not exists uitnodigingen_uniek
  on public.uitnodigingen (team_id, lower(email));
create index if not exists uitnodigingen_email_idx on public.uitnodigingen (lower(email));

-- ---------- wie mag wat ----------
-- Deze twee moeten 'security definer' zijn. Een regel op team_leden die zelf
-- team_leden bevraagt roept zichzelf aan, en Postgres kapt dat af met een fout
-- over oneindige recursie. Zo'n functie stapt daar één keer omheen, en doet
-- verder niets anders dan kijken.
create or replace function public.is_lid(p_team uuid) returns boolean
language sql security definer stable
set search_path = public
as $$
  select exists (
    select 1 from public.team_leden l
     where l.team_id = p_team and l.gebruiker = auth.uid()
  );
$$;

create or replace function public.is_eigenaar(p_team uuid) returns boolean
language sql security definer stable
set search_path = public
as $$
  select exists (
    select 1 from public.teams t
     where t.id = p_team and t.eigenaar = auth.uid()
  );
$$;

-- Ook definer, en om dezelfde reden: zonder dit zou de leesregel op teams een
-- subvraag op uitnodigingen doen, waarvan de eigen regel weer teams bevraagt.
create or replace function public.is_uitgenodigd(p_team uuid) returns boolean
language sql security definer stable
set search_path = public
as $$
  select exists (
    select 1 from public.uitnodigingen u
     where u.team_id = p_team
       and lower(u.email) = lower(auth.jwt() ->> 'email')
  );
$$;

revoke all on function public.is_lid(uuid), public.is_eigenaar(uuid), public.is_uitgenodigd(uuid) from public;
grant execute on function public.is_lid(uuid), public.is_eigenaar(uuid), public.is_uitgenodigd(uuid) to authenticated;

-- Wie een team aanmaakt is er meteen lid van. Met de hand erbij zetten zou
-- betekenen dat een half mislukte aanmelding een team achterlaat waar niemand
-- meer bij kan.
create or replace function public.eigenaar_wordt_lid() returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.team_leden (team_id, gebruiker, rol)
  values (new.id, new.eigenaar, 'eigenaar')
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists teams_eigenaar_wordt_lid on public.teams;
create trigger teams_eigenaar_wordt_lid
  after insert on public.teams
  for each row execute function public.eigenaar_wordt_lid();

-- ---------- de regels opnieuw ----------
alter table public.team_leden    enable row level security;
alter table public.uitnodigingen enable row level security;

drop policy if exists "eigen teams lezen"      on public.teams;
drop policy if exists "eigen teams bijwerken"  on public.teams;
drop policy if exists "eigen teams verwijderen" on public.teams;
drop policy if exists "teams van mijn ploeg lezen"  on public.teams;
drop policy if exists "alleen de eigenaar wijzigt"  on public.teams;
drop policy if exists "alleen de eigenaar verwijdert" on public.teams;

-- Lezen mag ieder lid. De eigenaar staat er los bij omdat de RETURNING van een
-- verse insert al langs de leesregel komt voordat het lidmaatschap gezien wordt.
-- En wie uitgenodigd is mag de naam zien: anders neem je iets aan zonder te weten
-- wat. Verder komt hij nergens bij; de gegevens hangen aan het lidmaatschap.
create policy "teams van mijn ploeg lezen" on public.teams for select
  using (eigenaar = auth.uid() or public.is_lid(id) or public.is_uitgenodigd(id));
create policy "alleen de eigenaar wijzigt" on public.teams for update
  using (eigenaar = auth.uid());
create policy "alleen de eigenaar verwijdert" on public.teams for delete
  using (eigenaar = auth.uid());

drop policy if exists "eigen toestand lezen"    on public.team_toestand;
drop policy if exists "eigen toestand schrijven" on public.team_toestand;
drop policy if exists "eigen toestand bijwerken" on public.team_toestand;
drop policy if exists "toestand van mijn ploeg lezen"     on public.team_toestand;
drop policy if exists "toestand van mijn ploeg schrijven" on public.team_toestand;
drop policy if exists "toestand van mijn ploeg bijwerken" on public.team_toestand;

create policy "toestand van mijn ploeg lezen" on public.team_toestand for select
  using (public.is_lid(team_id));
create policy "toestand van mijn ploeg schrijven" on public.team_toestand for insert
  with check (public.is_lid(team_id));
create policy "toestand van mijn ploeg bijwerken" on public.team_toestand for update
  using (public.is_lid(team_id));

drop policy if exists "leden van mijn ploeg lezen" on public.team_leden;
drop policy if exists "eigenaar laat toe"          on public.team_leden;
drop policy if exists "eigenaar zet eruit"         on public.team_leden;

create policy "leden van mijn ploeg lezen" on public.team_leden for select
  using (public.is_lid(team_id));
create policy "eigenaar laat toe" on public.team_leden for insert
  with check (public.is_eigenaar(team_id));
-- De eigenaar kan iedereen eruit zetten behalve zichzelf: een team zonder
-- eigenaar is een team waar niemand meer iets aan kan veranderen.
create policy "eigenaar zet eruit" on public.team_leden for delete
  using (public.is_eigenaar(team_id) and rol <> 'eigenaar');

drop policy if exists "uitnodigingen zien"       on public.uitnodigingen;
drop policy if exists "eigenaar nodigt uit"      on public.uitnodigingen;
drop policy if exists "eigenaar trekt in"        on public.uitnodigingen;

-- De uitgenodigde moet zijn eigen uitnodiging kunnen zien, anders weet hij niet
-- dat hij er een heeft.
create policy "uitnodigingen zien" on public.uitnodigingen for select
  using (public.is_eigenaar(team_id) or lower(email) = lower(auth.jwt() ->> 'email'));
create policy "eigenaar nodigt uit" on public.uitnodigingen for insert
  with check (public.is_eigenaar(team_id) and door = auth.uid());
create policy "eigenaar trekt in" on public.uitnodigingen for delete
  using (public.is_eigenaar(team_id));

-- ---------- een uitnodiging aannemen ----------
-- Ook 'security definer': de uitgenodigde is nog geen lid, dus hij mag zichzelf
-- volgens de regels hierboven niet in team_leden zetten. Deze functie doet dat
-- voor hem, en alleen voor uitnodigingen die op zijn eigen adres staan.
create or replace function public.uitnodiging_aannemen()
returns setof uuid
language plpgsql security definer
set search_path = public
as $$
declare
  mijn_email text := lower(auth.jwt() ->> 'email');
  r record;
begin
  if auth.uid() is null or mijn_email is null or mijn_email = '' then
    raise exception 'niet ingelogd' using errcode = '42501';
  end if;

  for r in
    select id, team_id from public.uitnodigingen where lower(email) = mijn_email
  loop
    insert into public.team_leden (team_id, gebruiker, rol)
    values (r.team_id, auth.uid(), 'trainer')
    on conflict do nothing;
    delete from public.uitnodigingen where id = r.id;
    return next r.team_id;
  end loop;
end;
$$;

revoke all on function public.uitnodiging_aannemen() from public;
grant execute on function public.uitnodiging_aannemen() to authenticated;

-- ---------- toegang tot de nieuwe tabellen ----------
grant select, insert, delete on public.team_leden    to authenticated;
grant select, insert, delete on public.uitnodigingen to authenticated;

-- ---------- bijvullen ----------
-- Teams die er al waren hebben nog geen lidmaatschap. Zonder deze regel raakt
-- iedereen die vandaag al inlogt zijn eigen team kwijt.
insert into public.team_leden (team_id, gebruiker, rol)
select id, eigenaar, 'eigenaar' from public.teams
on conflict do nothing;

-- ---------- wie is wie ----------
-- team_leden bewaarde alleen een gebruikersnummer, en de adressen staan in
-- auth.users, waar de app niet bij mag. Op het scherm stond daardoor 'eigenaar'
-- en 'trainer' zonder naam erbij — precies de vraag die je stelt als je kijkt
-- wie er allemaal bij je team kan.
--
-- Dus schrijven we het adres mee op het moment dat iemand lid wordt. Alleen
-- teamgenoten kunnen het lezen; dat regelt de leesregel op team_leden, die er al
-- staat. En het is het adres waarop je hem zelf hebt uitgenodigd.
alter table public.team_leden add column if not exists email text;

create or replace function public.eigenaar_wordt_lid() returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.team_leden (team_id, gebruiker, rol, email)
  values (new.id, new.eigenaar, 'eigenaar', (select u.email from auth.users u where u.id = new.eigenaar))
  on conflict do nothing;
  return new;
end;
$$;

create or replace function public.uitnodiging_aannemen()
returns setof uuid
language plpgsql security definer
set search_path = public
as $$
declare
  mijn_email text := lower(auth.jwt() ->> 'email');
  r record;
begin
  if auth.uid() is null or mijn_email is null or mijn_email = '' then
    raise exception 'niet ingelogd' using errcode = '42501';
  end if;

  for r in
    select id, team_id from public.uitnodigingen where lower(email) = mijn_email
  loop
    insert into public.team_leden (team_id, gebruiker, rol, email)
    values (r.team_id, auth.uid(), 'trainer', mijn_email)
    on conflict do nothing;
    delete from public.uitnodigingen where id = r.id;
    return next r.team_id;
  end loop;
end;
$$;

-- Wie al lid was heeft nog geen adres bij zijn regel staan.
update public.team_leden l
   set email = u.email
  from auth.users u
 where u.id = l.gebruiker and l.email is null;
