-- Blaadje — de database klaarzetten voor PowerSync
--
-- Draait ná schema.sql en model.sql. PowerSync leest mee met de database en
-- stuurt elk toestel wat van hem is; schrijven doet het toestel zelf, langs de
-- gewone regels. Hiervoor heeft PowerSync een eigen rol nodig die mag meelezen,
-- en een lijst van tabellen waar hij naar luistert.
--
-- Vóór het draaien: vervang VERVANG-DIT hieronder door een lang, willekeurig
-- wachtwoord (minstens 24 tekens) en bewaar dat; je vult het daarna in bij
-- PowerSync. Zet het wachtwoord niet in git.
--
-- Te herhalen: draai je het opnieuw, dan krijgt de rol het nieuwe wachtwoord.

do $$
declare
  v_wachtwoord text := 'VERVANG-DIT';
begin
  if v_wachtwoord = 'VERVANG-DIT' or length(v_wachtwoord) < 24 then
    raise exception 'Vervang eerst VERVANG-DIT door een wachtwoord van minstens 24 tekens.';
  end if;
  if exists (select from pg_roles where rolname = 'powersync_role') then
    execute format('alter role powersync_role with replication bypassrls login password %L', v_wachtwoord);
  else
    execute format('create role powersync_role with replication bypassrls login password %L', v_wachtwoord);
  end if;
end $$;

-- Alleen wat een toestel nodig heeft. Met opzet níét: team_toestand (het oude
-- blok van de webapp), uitnodigingen (daar staan e-mailadressen in), deellinks
-- en bijdragen. Wat hier niet staat kan PowerSync niet lezen, wat er ook in de
-- regels voor het synchroniseren komt te staan.
grant usage on schema public to powersync_role;
grant select on
  public.teams,
  public.team_leden,
  public.team_instellingen,
  public.spelers,
  public.wedstrijden,
  public.wedstrijd_spelers,
  public.gebeurtenissen,
  public.trainingen,
  public.training_spelers
to powersync_role;

-- De lijst waar PowerSync naar luistert. De naam moet 'powersync' zijn.
-- Bestaat hij al, dan wordt hij bijgewerkt en niet weggegooid: weggooien terwijl
-- PowerSync meeluistert breekt de verbinding.
do $$
declare
  v_tabellen text := 'public.teams, public.team_leden, public.team_instellingen, public.spelers, '
    || 'public.wedstrijden, public.wedstrijd_spelers, public.gebeurtenissen, public.trainingen, public.training_spelers';
begin
  if exists (select from pg_publication where pubname = 'powersync') then
    execute 'alter publication powersync set table ' || v_tabellen;
  else
    execute 'create publication powersync for table ' || v_tabellen;
  end if;
end $$;
