# De regels uitproberen

`./draai.sh` maakt een verse database, voert `supabase-staketsel.sql` uit, dan de
echte `../schema.sql`, en daarna `rls.sql`. Elke controle stopt met een fout
zodra hij niet klopt, dus de opdracht eindigt rood.

Er is geen Supabase-project en geen geheim voor nodig. Het staketsel levert
alleen wat `schema.sql` van Supabase verwacht: de rollen `anon` en
`authenticated`, de tabel `auth.users`, en `auth.uid()` die het token op dezelfde
manier uitleest.

Lokaal draait hij tegen de Postgres die al op je machine staat. In de CI tegen
een verse `postgres:16` — zie `.github/workflows/ci.yml`.

## Wat hij aantoont

Twee trainers, ieder een eigen team. De ander mag niets: niet lezen, niet
gericht op id opvragen, niet bijwerken, niet verwijderen, geen team op naam van
een ander aanmaken, en niet via `toestand_opslaan` naar binnen. Zonder inloggen
komt er niets uit.

## Waarom de bijwerkproef twee vormen heeft

Met een `where` filtert de leesregel de rij er al uit, en dan blijft een veel te
ruime bijwerkregel onzichtbaar. Zonder `where` niet. Nagegaan door de regel op
`using (true)` te zetten: die ene opdracht raakte een rij van een ander team en
de teamnaam was daarna weg. Beide vormen staan er nu in.

## Nagelopen dat hij echt vangt

Zes manieren om de regels stuk te maken, allemaal gevangen: leesregel op `teams`
te ruim, leesregel op de gegevens te ruim, bijwerken door iedereen op elk van de
twee tabellen, verwijderen toegekend aan iedereen, en Row Level Security
helemaal uitgezet.
