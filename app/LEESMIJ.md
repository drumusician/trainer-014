# Blaadje — wedstrijdapp

Eén map, geen build, geen dependencies. Open `index.html` in een browser en het werkt.

## Wat het doet

- Wedstrijd starten met een klok, twee helften, pauzeren.
- Opstelling op een getekend veld, met echte posities (4-3-3, 4-4-2, 4-2-3-1).
- Wissels in twee tikken: speler in het veld aantikken, dan wie erin komt. Tijdstip wordt vastgelegd.
- Doelpunten voor en tegen, met wie scoorde.
- Na afloop: gespeelde minuten per speler, berekend uit de wissels. Nooit ingevoerd.
- Wedstrijd bewaren in het archief, en later weer openen: uitslag, speeltijden en het hele verloop.
- Verslag kopiëren voor de groepsapp, met of zonder de wissels erin.
- Bank staat naast het veld, in dezelfde volgorde als de linies: aanval boven, keeper onder.
- K staat los van de veldlinie, dus een verdediger die ook keept staat in beide lijstjes.
- Standaardopstelling: maak hem één keer, elke nieuwe wedstrijd begint ermee.
- Overzetten: op je laptop een code maken, op je telefoon invoeren. Selectie en standaardopstelling gaan mee, bewaarde wedstrijden niet.
- Synchroniseren met Supabase: inloggen met een code uit de mail, daarna opsturen en ophalen. Zie `../supabase/LEESMIJ.md`.
- Trainingen: los aan te maken, datum achteraf aan te passen. Per speler aanwezig, afgemeld of niet gekomen.
- Presentie telt mee bij het opstellen: wie de laatste vier keer minder dan de helft kwam, staat oranje bij de opstelling.
- Seizoenstotaal over alles wat je bewaard hebt: W-G-V, topscorers en de opgetelde speeltijd per speler.

De namen staan **niet in de broncode**. Je zet ze bij het eerste gebruik zelf in de app; ze blijven in de opslag van je eigen browser.

## Op je telefoon zetten

1. Host de map op HTTPS (zie hieronder).
2. Open de site in Safari, deel-knop → **Zet op beginscherm**.
3. Start hem vanaf het beginscherm: schermvullend, zonder browserbalk, en hij werkt zonder bereik.

## Waarom hosten en niet gewoon een bestand

Het scherm wakker houden gaat via de Screen Wake Lock API, en die werkt alleen op een beveiligde verbinding. Vanaf een bestand op je schijf dus niet. Verder: in webapps op je beginscherm werkt wake lock pas vanaf iOS 18.4 — daaronder blijft het scherm alleen wakker als je hem in Safari zelf opent.

## Hosten met Cloudflare Pages

1. Repo naar GitHub (privé mag).
2. Cloudflare dashboard → Workers & Pages → Create → Pages → Connect to Git.
3. Build command leeg laten, **build output directory** op `app`.
4. Deploy. Je krijgt een `*.pages.dev`-adres met HTTPS.

Bij Netlify werkt hetzelfde: geen build command, publish directory `app`.

## Bestanden

- `index.html` — de hele app.
- `manifest.webmanifest` — naam, kleur en icoon voor het beginscherm.
- `sw.js` — service worker, zodat hij offline werkt langs de lijn.
- `icon-192.png`, `icon-512.png` — het icoon.

## Opslag

Alles staat in `localStorage` op dit ene toestel. Onder Instellen → Archief zit een exportknop die er tekst van maakt die je kunt bewaren.

Wil je later synchroniseren tussen toestellen of met Michel, dan kan er een backend achter. Het datamodel is daarop voorbereid: een wedstrijd is een lijst gebeurtenissen (`start`, `wissel`, `goal`, `tegen`, `rust`, `eind`) met een tijdstip. Minuten zijn afgeleid, niet opgeslagen. Die lijst kun je één op één in een tabel zetten zonder iets te herschrijven.
