# Blaadje

De wedstrijdapp. SvelteKit met TypeScript, gebouwd naar statische bestanden: geen server, werkt zonder bereik, staat meteen op het scherm.

Uitrollen, terugrollen en gegevens terughalen staat in [UITROLLEN.md](../UITROLLEN.md).

## Draaien

Vanaf de repo-root:

```
mise run dev      # http://localhost:5173
mise run test     # alle tests
mise run check    # types en Svelte-code
mise run build    # naar web/build
mise run preview  # de gebouwde versie op http://localhost:4173
```

Het hele hek in één keer, vanuit `web/`:

```
npm run controle  # opmaak, lint, typen, tests én de dekkingsdrempel
```

Dat is precies wat Netlify draait voordat er iets live gaat. De drempel staat in
`vitest.config.ts` en ligt net onder waar we nu staan: één regel zonder test keurt
niets af, een heel scherm zonder test wel.

De regels van de database worden apart bewezen, op een echte Postgres:

```
./supabase/test/draai.sh
```

## Waar wat staat

Vier plekken onderin, en daaronder taken die het scherm helemaal pakken.

- **Wedstrijd** (`/`) — nieuwe wedstrijd beginnen of verder met de wedstrijd die
  loopt, plus de standaardopstelling.
- **Team** (`/team`) — selectie en linies, en de ingang naar de trainingen.
- **Archief** (`/archief`) — bewaarde wedstrijden, en daarachter het
  seizoensoverzicht met speeltijd, topscorers en presentie.
- **Meer** (`/meer`) — synchroniseren, back-up, overzetten.

Het **wisselplan** (`/wisselplan`) is een spiekbriefje, geen wekker: rond welke
minuut wie erin komt voor wie. Tijdens de wedstrijd staat de volgende stap onder
het veld, grijs tot de minuut voorbij is en dan oranje; de app wisselt nooit zelf.
Of een stap gedaan is, volgt uit de wissels in het verloop. Zie `domain/plan.ts`.

De balk verdwijnt op `/wedstrijd`, `/opstelling/*`, `/wisselplan`, `/aanwezig` en `/afloop`.
Daar ben je met één ding bezig en telt elke pixel.

Een bewaarde wedstrijd kun je bijwerken: datum, tegenstander, thuis of uit, en
doelpunten erbij of eraf. Wissels blijven staan, want de speeltijd is bij het
bewaren uitgerekend en die zou dan niet meer kloppen.

## Hoe het in elkaar zit

```
src/lib/domain/     de rekenkern: pure functies, geen Svelte, wel tests
src/lib/actions/    wat een handeling met de toestand doet: klok, wissels, archief
src/lib/text/nl.ts  alle vaste tekst op het scherm, op één plek
src/lib/            toestand (runes), synchronisatie met Supabase, wat er in de kopbalk staat
src/lib/components/ veld, bank, speeltijdtabel, verloop, verslag
src/routes/         één map per scherm
src/test/           de opzet voor de tests: opslag, stand-ins voor SvelteKit
```

De code is Engels, de tekst op het scherm is Nederlands. Waarom en met welke
woorden staat in `src/lib/domain/GLOSSARY.md`. Elke zin die een trainer te zien
krijgt staat in `src/lib/text/nl.ts`, zodat er geen Engels tussen kan glippen —
en er is een test die daarop let.

`domain/` weet niets van schermen. Daar zit alles wat fout kán gaan: speeltijd
terugrekenen uit de wissels, keeperminuten apart houden, seizoenstotalen, het
verslag, de overzetcode. Dat is getest, en die tests draaien in seconden.

De schermen zijn routes, dus de terugknop van je telefoon werkt en je kunt een
scherm bookmarken. Wat er in de balk bovenaan staat, zet elk scherm zelf via
`zetKop()`.

## Speelvormen

11 tegen 11, 8 tegen 8, 6 tegen 6 en 4 tegen 4 (zonder keeper). De app rekent
nergens met een vast aantal spelers: hoeveel er op het veld staan volgt uit de
lijst plekken in `domain/formations.ts`. Een nieuwe formatie toevoegen is dus een
regel in dat bestand, verder niets.

De notatie volgt wat trainers zeggen: bij 11 tegen 11 zonder keeper (4-3-3), in
de jeugd met keeper (1-3-3-1). Verwarrend, maar het is hoe het op het veld gaat.

Er is één formatie voor het team. Je kiest hem op het standaardopstellingscherm
of bij een nieuwe wedstrijd; allebei doen hetzelfde. Wissel je van formatie, dan
verhuist je standaardopstelling mee: wie op een plek staat die ook in de nieuwe
formatie bestaat blijft staan, de rest schuift door binnen zijn eigen linie, en
wat niet past gaat naar de bank. Plekken die overblijven laten we leeg — die vult
de trainer zelf, want er stilletjes een aanvaller op het middenveld zetten is een
keuze die niet van de app is.

## Voor de aftrap

Bij een nieuwe wedstrijd komt eerst **Wie is er?**. Wie je wegtikt staat niet op
de bank en telt niet mee, zodat je hem er langs de lijn niet per ongeluk in
brengt. Iemand die al opgesteld stond laat zijn plek leeg.

Tik op de klok om hem bij te stellen: min of plus een minuut. De scheidsrechter
is leidend, niet je telefoon.

## Synchroniseren

Sinds oktober 2026 werken het web en de iPhone-app in dezelfde tabellen
(`supabase/model.sql`). Wat je op het web klaarzet staat op je telefoon, en
andersom. De vertaling van de toestand naar rijen staat in
`src/lib/supabase/rijen.ts` en is regel voor regel dezelfde als die van de
iPhone-app (`ios/BlaadjeKern/.../Sync/Rijen.swift`). Dat moet: een rij is pas
dezelfde rij als het kenmerk klopt. `rijen.test.ts` legt de uitkomst naast de
rijen die de iPhone-app zelf maakte (`Fixtures/rijen-gedeeld.json`).

- **Opsturen** gebeurt vier seconden na de laatste wijziging, en dan alleen wat
  er veranderde: per veld, net als de telefoon. Het toestel onthoudt wat er
  volgens hem in de tabellen staat (`o14-gespiegeld-v1`); het verschil daarmee
  is wat er heen gaat. Wat een ander toestel intussen deed staat daar niet in,
  en wordt dus ook niet weggehaald. Doen twee toestellen hetzelfde veld, dan
  wint de laatste. Botsingen bestaan daardoor niet meer.
- **Ophalen** gebeurt bij het openen, als je terugkomt naar het tabblad en elke
  minuut zolang het voor je staat, maar **nooit** als er hier nog iets
  klaarstaat of de trainer intussen tikte. Dan gaat dat eerst de andere kant op.
- **Een leeg toestel maakt een team nooit leeg.** Staat er hier niets en in het
  account wel, dan haalt de app op in plaats van alles weg te halen.
- Weigert de server een rij, dan gaat de rest gewoon door; het staat in het
  logboekje bij Meer.
- Geen bereik? Dan blijft het klaarstaan en gaat het mee zodra je weer online
  bent.

Het oude blok (`team_toestand`, één JSON-document per team) wordt niet meer
geschreven. Staat een team nog leeg in de tabellen, dan verhuist de app dat blok
de eerste keer.

`./proef.sh` draait de webapp tegen een verse lokale database met het echte
model en PostgREST (Docker nodig, bijvoorbeeld `colima start`).

Een code en een back-up bevatten hetzelfde, op één ding na: de wedstrijd die nu
loopt zit er niet in. Die is bedoeld om over te zetten en te bewaren, en een
half gespeelde wedstrijd hoort daar niet bij.

## Welk team volgt dit toestel

Sinds er meer trainers bij een team kunnen, is dit de plek waar een fout iemands
seizoen kost. Vier regels, en alles in `sync.svelte.ts` is een uitwerking daarvan:

1. **Een toestel volgt precies één team.** Alles wat het opstuurt gaat daarheen.
2. **De app raadt nooit welk team dat is.** Hoor je bij meer teams en is er nog
   geen gekozen, dan gebeurt er niets tot de trainer kiest. Dat is een vraag, geen
   storing: er komt geen 'geen verbinding' te staan en er wordt niet doorgeprobeerd.
3. **Het eerste contact met een team is altijd ophalen, nooit opsturen.** Weet het
   toestel niet wat er in de tabellen staat, dan heeft het dit team nog nooit
   gezien, en dan is opsturen het overschrijven van iets wat het niet kent. Wat er
   op dit toestel stond gaat dan apart (`o14-app-v1-voor-account`).
4. **Overstappen kan alleen als er niets klaarstaat, en lukt helemaal of niet.**
   Eerst het andere team ophalen, en pas omzetten als dat gelukt is.

Regel 3 zat er eerst niet in, en dat is het scherpst denkbare randje: een net
toegevoegde trainer logt in en zijn nog lege app duwt naar jouw team.

Regel 4 heeft een tweede helft die makkelijk te missen is: stap je over naar een
team waar nog *niets* staat, dan wordt wat er op dit toestel staat gewist. Dat
hoort namelijk bij het team dat je verlaat, en meenemen zou het bij het nieuwe
naar binnen schrijven. Kwam je nergens vandaan, dan blijft het juist staan — dat
ís het begin van dat team.

Er is nog een vijfde regel, en die gaat niet over teams maar over mensen: **logt
er iemand anders in dan de vorige keer, dan vraagt de app van wie de gegevens op
dit toestel zijn.** Zolang dat niet beantwoord is gaat er niets heen en weer.

Zonder die vraag gebeurt het volgende op een geleende telefoon: de nieuwe trainer
logt in, heeft nog geen team, dus maakt de app er een aan — met de naam van het
team dat er al stond — en stuurt de spelers van de vorige trainer daarheen.
Niemand die het ziet gebeuren.

Zelf een team beginnen kan altijd, ook als je al bij het team van iemand anders
hoort — anders is meekijken een val waar je nooit meer uitkomt met een eigen
ploeg. Zo'n nieuw team begint leeg, om dezelfde reden als regel 4: wat er in de
app staat hoort bij het team dat je verlaat.

De lijst met je teams staat altijd op het gegevensscherm, met daarin welk team
aanstaat. Hij was eerst een eenmalig keuzemoment dat verdween zodra je gekozen
had, en dat maakte er een eenrichtingsdeur van: wie twee teams heeft koos er een
en kwam nooit meer bij het andere.

## De wedstrijd

Een wedstrijd houd je bij in de iPhone-app. Het web volgt: wat er in het account
staat wint, ook als hier al een wedstrijd liep. Vroeger was het andersom (na de
aftrap won dit toestel), maar met per veld opsturen zou een oude kopie hier de
wissels en doelpunten van de telefoon weer weghalen.

Een wedstrijd heeft een vast kenmerk (`id`) dat meegaat naar het archief, zodat
hij op de server één rij blijft.

## Opslag

Alles staat in `localStorage` onder `o14-app-v1`, in precies dezelfde vorm als de
vorige versie. Wat er op je telefoon stond, blijft dus staan. De inlog voor
Supabase staat los, onder `o14-sessie-v1`.

Spelers met de oude linie `K` worden bij het laden omgezet naar `keept: true`,
want keepen staat nu los van je veldlinie.

## Waarom het veld doet wat het doet

Het veld schaalt op hoogte, niet op breedte: `min(beschikbare breedte,
beschikbare hoogte × 0,625)`. Daardoor past het op elk scherm in één beeld en
hoef je tijdens een wedstrijd nergens te scrollen. De namen schalen mee met
container queries, met een onder- en bovengrens.

De x-posities in `domain/formations.ts` staan zo ver uit elkaar dat de
naambolletjes elkaar niet raken, ook niet op een iPhone SE. Verander je die, kijk
dan of vier verdedigers naast elkaar nog passen.

## De oude versie

`app/index.html` is de vorige versie: één bestand, geen build. Die staat er nog
als achtervang. Netlify publiceert nu `web/build`; terug is één wijziging in
`netlify.toml`.
