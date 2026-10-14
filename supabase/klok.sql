-- Blaadje — de klok voor de herinneringen
--
-- Elke minuut vraagt de database de serverfunctie `meld` of er herinneringen de
-- deur uit moeten (zie `herinneringen` in taken.sql): de avond voor een
-- wedstrijd, de limonade vlak voor de rust, en een taak die openviel.
--
-- Plak dit in de SQL Editor en vervang JOUW_MELD_GEHEIM door dezelfde tekst als
-- het secret MELD_GEHEIM. Niet terugzetten in dit bestand: het geheim hoort niet
-- in git. Te herhalen: een bestaande klok met dezelfde naam wordt vervangen.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule(jobid) from cron.job where jobname = 'blaadje-herinneringen';

select cron.schedule(
  'blaadje-herinneringen',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://gdsqdsxflueawfipjqbw.supabase.co/functions/v1/meld',
    body := '{"type": "KLOK"}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-meld-geheim', 'JOUW_MELD_GEHEIM')
  );
  $$
);
