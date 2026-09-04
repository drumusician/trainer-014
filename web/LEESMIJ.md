# Blaadje

De wedstrijdapp. SvelteKit met TypeScript, gebouwd naar statische bestanden: geen server, werkt zonder bereik, staat meteen op het scherm.

## Draaien

Vanaf de repo-root:

```
mise run dev      # http://localhost:5173
mise run test     # de rekenkern
mise run check    # types en Svelte-code
mise run build    # naar web/build
mise run preview  # de gebouwde versie op http://localhost:4173
```

## Waar wat staat

Vier plekken onderin, en daaronder taken die het scherm helemaal pakken.

- **Wedstrijd** (`/`) — nieuwe wedstrijd beginnen of verder met de wedstrijd die
  loopt, plus de standaardopstelling.
- **Team** (`/team`) — selectie en linies, en de ingang naar de trainingen.
- **Archief** (`/archief`) — bewaarde wedstrijden, en daarachter het
  seizoensoverzicht met speeltijd, topscorers en presentie.
- **Meer** (`/meer`) — synchroniseren, back-up, overzetten.

De balk verdwijnt op `/wedstrijd`, `/opstelling/*`, `/aanwezig` en `/afloop`.
Daar ben je met één ding bezig en telt elke pixel.

Een bewaarde wedstrijd kun je bijwerken: datum, tegenstander, thuis of uit, en
doelpunten erbij of eraf. Wissels blijven staan, want de speeltijd is bij het
bewaren uitgerekend en die zou dan niet meer kloppen.

## Hoe het in elkaar zit

```
src/lib/domein/     de rekenkern: pure functies, geen Svelte, wel tests
src/lib/            toestand (runes), synchronisatie met Supabase, wat er in de kopbalk staat
src/lib/componenten veld, bank, speeltijdtabel, verloop, verslag
src/routes/         één map per scherm
```

`domein/` weet niets van schermen. Daar zit alles wat fout kán gaan: speeltijd
terugrekenen uit de wissels, keeperminuten apart houden, seizoenstotalen, het
verslag, de overzetcode. Dat is getest, en die tests draaien in seconden.

De schermen zijn routes, dus de terugknop van je telefoon werkt en je kunt een
scherm bookmarken. Wat er in de balk bovenaan staat, zet elk scherm zelf via
`zetKop()`.

## Voor de aftrap

Bij een nieuwe wedstrijd komt eerst **Wie is er?**. Wie je wegtikt staat niet op
de bank en telt niet mee, zodat je hem er langs de lijn niet per ongeluk in
brengt. Iemand die al opgesteld stond laat zijn plek leeg.

Tik op de klok om hem bij te stellen: min of plus een minuut. De scheidsrechter
is leidend, niet je telefoon.

## Synchroniseren

Lokaal is leidend. De app werkt zonder bereik, en zodra er internet is gaat wat
er veranderd is vanzelf naar de server. De regel eronder:

- **Opsturen** gebeurt vier seconden na de laatste wijziging, en alleen als het
  pakket echt anders is dan wat er al staat. Een lopende wedstrijd zit er niet
  in, dus tijdens een wedstrijd wordt er niets verstuurd.
- **Ophalen** gebeurt bij het openen van de app en als je terugkomt uit een ander
  scherm, maar **nooit** als er hier nog iets klaarstaat. Dan zou je je eigen
  werk overschrijven.
- Botst het (op allebei de toestellen iets veranderd), dan doet de app niets en
  verschijnt er een balk: ophalen, of dit toestel opsturen. Die keuze is aan de
  trainer.
- Geen bereik? Dan blijft het klaarstaan en gaat het mee zodra je weer online
  bent.

Een code en een back-up bevatten precies hetzelfde als wat er naar de server
gaat: alles behalve de wedstrijd die nu loopt. Zo hoef je niet te onthouden welke
knop wat meeneemt.

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

De x-posities in `domein/formaties.ts` staan zo ver uit elkaar dat de
naambolletjes elkaar niet raken, ook niet op een iPhone SE. Verander je die, kijk
dan of vier verdedigers naast elkaar nog passen.

## De oude versie

`app/index.html` is de vorige versie: één bestand, geen build. Die staat er nog
als achtervang. Netlify publiceert nu `web/build`; terug is één wijziging in
`netlify.toml`.
