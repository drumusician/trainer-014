-- Blaadje — het teamabonnement
--
-- Draait ná schema.sql, en vóór volgen.sql en taken.sql (die vragen hier of een
-- team aanstaat). Te herhalen.
--
-- De trainer of teamleider koopt in de app een jaarabonnement via Apple. Dat
-- zet het team aan: ouders zien het programma en de taken, en krijgen de
-- meldingen. De wedstrijddag van de trainer is altijd gratis.
--
-- Tot `gratis_tot()` staat elk team aan. Daarna alleen met een abonnement.
--
-- Wie betaalt weten we niet en willen we niet weten: Apple stuurt alleen een
-- nummer (originalTransactionId), het team dat de app bij de aankoop meegaf, en
-- tot wanneer het loopt. Alleen de serverfunctie `abonnement` schrijft hier, na
-- de handtekening van Apple te hebben nagekeken.

create table if not exists public.team_abonnementen (
  -- het nummer van Apple; blijft hetzelfde bij elke verlenging
  id           text primary key,
  team_id      uuid not null references public.teams (id) on delete cascade,
  product      text not null,
  verloopt     timestamptz not null,
  omgeving     text not null check (omgeving in ('Production', 'Sandbox', 'Xcode', 'LocalTesting')),
  -- terugbetaald of ingetrokken door Apple
  ingetrokken  boolean not null default false,
  bijgewerkt   timestamptz not null default now()
);

create index if not exists team_abonnementen_team_idx on public.team_abonnementen (team_id);

alter table public.team_abonnementen enable row level security;
drop policy if exists "leden lezen" on public.team_abonnementen;
create policy "leden lezen" on public.team_abonnementen for select using (public.is_lid(team_id));
grant select on public.team_abonnementen to authenticated;

-- Tot wanneer alles gratis is: de proef loopt tot na de winterstop. De
-- instelling `blaadje.gratis_tot` is er voor de proef in test/abonnement.sql.
create or replace function public.gratis_tot() returns timestamptz
language sql stable
as $$
  select coalesce(nullif(current_setting('blaadje.gratis_tot', true), '')::timestamptz,
                  timestamptz '2027-02-01 00:00:00 Europe/Amsterdam')
$$;

-- De ene vraag waar alles langs gaat: de pagina voor ouders, de meldingen, de herinneringen.
create or replace function public.team_aan(p_team uuid, p_nu timestamptz default now()) returns boolean
language sql security definer stable
set search_path = public
as $$
  select p_nu < public.gratis_tot()
      or exists (select 1 from public.team_abonnementen a
                  where a.team_id = p_team and not a.ingetrokken and a.verloopt > p_nu);
$$;

revoke all on function public.team_aan(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.team_aan(uuid, timestamptz) to service_role;

-- Voor de trainer: staat het team aan, en waardoor.
create or replace function public.team_status(p_team uuid) returns jsonb
language plpgsql security definer stable
set search_path = public
as $$
declare
  v_tot timestamptz;
begin
  if not public.is_lid(p_team) then
    return null;
  end if;
  select max(a.verloopt) into v_tot from public.team_abonnementen a
   where a.team_id = p_team and not a.ingetrokken;
  return jsonb_build_object(
    'aan', public.team_aan(p_team),
    'gratis_tot', public.gratis_tot(),
    'abonnement_tot', v_tot
  );
end;
$$;

revoke all on function public.team_status(uuid) from public, anon;
grant execute on function public.team_status(uuid) to authenticated;

-- Voor de serverfunctie: een aankoop, verlenging of intrekking vastleggen.
-- Een ouder bericht van Apple dat later binnenkomt, zet de datum niet terug.
create or replace function public.abonnement_bij(
  p_id text, p_team uuid, p_product text, p_verloopt timestamptz, p_omgeving text, p_ingetrokken boolean
) returns void
language sql security definer
set search_path = public
as $$
  insert into public.team_abonnementen (id, team_id, product, verloopt, omgeving, ingetrokken)
  values (p_id, p_team, p_product, p_verloopt, p_omgeving, p_ingetrokken)
  on conflict (id) do update
    set verloopt = greatest(public.team_abonnementen.verloopt, excluded.verloopt),
        ingetrokken = excluded.ingetrokken,
        product = excluded.product,
        bijgewerkt = now();
$$;

revoke all on function public.abonnement_bij(text, uuid, text, timestamptz, text, boolean) from public, anon, authenticated;
grant execute on function public.abonnement_bij(text, uuid, text, timestamptz, text, boolean) to service_role;
