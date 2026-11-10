-- Blaadje — je account verwijderen
--
-- Draait ná schema.sql en model.sql. Te herhalen.
--
-- Apple wil dat je in de app zelf je account kunt verwijderen (richtlijn
-- 5.1.1(v)), en de AVG wil dat het dan ook echt weg is. Dat doet deze ene
-- functie, als de ingelogde trainer zelf:
--
-- - Een team waar jij de enige trainer bent, gaat mee weg: de spelers, de
--   wedstrijden, de trainingen, de links voor ouders en wie er volgt. Er is dan
--   niemand meer die erbij kan, dus bewaren heeft geen zin.
-- - Een team met nog een andere trainer blijft staan. Was jij de eigenaar, dan
--   wordt de trainer die er het langst bij zit de nieuwe eigenaar. Zonder die
--   stap zou het team meegaan, want `teams.eigenaar` verwijst met
--   `on delete cascade` naar de gebruiker.
-- - Wat jij deed in een team dat blijft (een wedstrijd bijhouden, een
--   gebeurtenis) blijft staan zonder jouw naam: die verwijzingen staan op
--   `on delete set null`.
-- - Daarna gaat de gebruiker zelf uit auth.users, en daarmee je e-mailadres,
--   je lidmaatschappen en de uitnodigingen die jij verstuurde.
--
-- Een gekocht seizoen hangt aan het team, niet aan jou: blijft het team, dan
-- blijft het seizoen.

create or replace function public.verwijder_account() returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_mij uuid := auth.uid();
  v_team record;
  v_opvolger uuid;
begin
  if v_mij is null then
    raise exception 'niet ingelogd' using errcode = '42501';
  end if;

  for v_team in
    select t.id from public.teams t
     where t.eigenaar = v_mij
        or exists (select 1 from public.team_leden l where l.team_id = t.id and l.gebruiker = v_mij)
  loop
    select l.gebruiker into v_opvolger from public.team_leden l
     where l.team_id = v_team.id and l.gebruiker <> v_mij
     order by l.toegevoegd asc, l.gebruiker asc
     limit 1;

    if v_opvolger is null then
      delete from public.teams where id = v_team.id;
    elsif exists (select 1 from public.teams t where t.id = v_team.id and t.eigenaar = v_mij) then
      update public.teams set eigenaar = v_opvolger where id = v_team.id;
      update public.team_leden set rol = 'eigenaar' where team_id = v_team.id and gebruiker = v_opvolger;
    end if;
  end loop;

  delete from auth.users where id = v_mij;
end;
$$;

revoke all on function public.verwijder_account() from public, anon;
grant execute on function public.verwijder_account() to authenticated;
