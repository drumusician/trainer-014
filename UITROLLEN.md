# Uitrollen, terugrollen, terughalen

Wat je moet weten als er iets live moet, of als er live iets mis is. Zaterdag om
half tien op een parkeerplaats is geen moment om dit uit te zoeken.

## Wat er live komt, en hoe

Alles op `main` gaat naar Netlify. De build draait eerst het hele hek — opmaak,
lint, typen, 450+ tests inclusief de dekkingsdrempel — en pas daarna `vite build`
(zie `netlify.toml`). Valt er iets om, dan is er geen deploy. Dat is met opzet:
GitHub Actions geeft sneller uitsluitsel, maar Netlify is de plek waar het echt
tegengehouden wordt.

Lokaal draai je precies hetzelfde met `npm run controle` in `web/`.

## Terugrollen

In Netlify → Deploys → een oudere deploy → **Publish deploy**. Eén klik, een paar
seconden.

**Maar dat werkt niet altijd.** De app bewaart alles in de browser van de trainer,
en die opslag verandert soms mee met een release. De omzetting naar Engelse
veldnamen (`migrateStorage`) is zo'n verandering: hij draait één keer bij het
openen en schrijft het resultaat terug. Zet je daarna de oude code terug, dan
staat er opslag die die versie niet kent, en dan ziet de trainer een lege app.

Dus vóór je terugrolt:

1. Kijk of de release iets aan de opslag heeft gedaan — grep op `migrateStorage`
   en `migrate(` in `web/src/lib/`.
2. Zo ja: terugrollen lost het niet op. Ga vooruit, niet achteruit. Een nieuwe
   commit die de fout repareert is sneller live dan het gedoe daarna.
3. Zo nee: terugrollen is veilig.

De vuistregel: **code kun je terugrollen, opgeslagen gegevens niet.** Een
omzetting die je uitrolt is een deur die achter je dichtvalt. Schrijf ze daarom
zo dat ze een tweede keer draaien zonder schade — dat doen ze nu — en test ze
tegen echte opgeslagen gegevens (`storage-format.test.ts`) en niet alleen tegen
een verzonnen object.

## De database

`supabase/schema.sql` is het hele schema, en hij is te herhalen: alles staat
achter `if not exists` of `or replace`. Bij een wijziging plak je hem opnieuw in
de SQL editor van Supabase en draai je hem. Er is geen migratiegereedschap en dat
is voorlopig ook niet nodig.

Wat je wél moet weten:

- **Een `drop` of een `alter` die gegevens weggooit staat er niet in, en dat moet
  zo blijven.** Moet een kolom weg, doe dat met de hand en pas nadat je een
  export hebt.
- **De regels zijn het gevoeligste deel.** `supabase/test/draai.sh` draait de
  echte `schema.sql` op een verse Postgres en bewijst dat een trainer niet bij het
  team van een ander kan. Die proef draait in CI. Verander je iets aan de regels,
  dan hoort daar een controle bij die omvalt als je het weer weghaalt.
- Terugrollen van de database is opnieuw een oudere `schema.sql` draaien. Dat
  herstelt regels en functies, geen gegevens.

## Gegevens terughalen

Er zijn drie kopieën, in deze volgorde van vertrouwen:

1. **Het toestel zelf.** Alles staat in `localStorage` onder `o14-app-v1`. Zolang
   de trainer de app niet heeft weggegooid, staat zijn seizoen er nog — ook als de
   site plat ligt.
2. **De server**, als hij ingelogd is. In Supabase: `team_toestand.data` is het
   hele document. Bij Gegevens → **Ophalen** trekt de app dat weer binnen.
3. **Het bestand.** Gegevens → **Bestand opslaan** geeft een `.json` met alles
   erin; **Bestand openen** leest hem terug. Dat is de kopie die het doet als de
   andere twee weg zijn.

Terughalen uit Supabase met de hand: kopieer de JSON uit `team_toestand.data`,
plak hem in een bestand en open dat met **Bestand openen**. Er zit geen andere
vorm tussen; wat er in de database staat is exact wat de app opslaat.

Een lopende wedstrijd gaat nooit mee, niet naar de server en niet in een
back-up. Die blijft op het toestel waar hij gespeeld wordt, zodat een druk op de
knop op je laptop nooit de wedstrijd van dat moment kan wissen. Keerzijde: raakt
dat toestel zaterdag kwijt, dan is die ene wedstrijd weg.

## Als het misgaat terwijl er gevoetbald wordt

In deze volgorde:

1. **Niets terugrollen.** De app werkt zonder bereik en zonder server. Een kapotte
   site raakt de wedstrijd die al open staat niet.
2. Laat de trainer **niet herladen**. Dat is de enige handeling die hem de nieuwe,
   kapotte versie in trekt.
3. Na afloop: Gegevens → **Bestand opslaan**, en dán pas repareren.
4. Het logboekje onder Gegevens (**Stuur dit naar Tjaco**) vertelt achteraf wat de
   app zelf heeft zien misgaan, mét de versie erbij. Er staan geen namen in.
