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
