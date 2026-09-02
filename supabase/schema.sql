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
