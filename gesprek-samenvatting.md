# Gesprek-samenvatting — opzet O14 trainerschap

Kort verslag van het gesprek waarin deze map is ontstaan. Als naslag en startpunt voor volgende sessies.

## Aanleiding
Volgend jaar (nu: eerste training vrijdag) O14 van mijn zoon trainen en coachen. Zelf 13 jaar op redelijk niveau gevoetbald, goed speelinzicht, maar weinig kaas gegeten van tactiek en het overbrengen ervan. Nooit echt wedstrijden gekeken behalve WK/EK.

## Tactiek bijleren — bronnen
- **KNVB Aftrapmodule** (gratis, één avond, voor startende jeugdtrainers) als instap.
- **Rinus** (KNVB, gratis) als oefeningen/planning-tool.
- **Tifo Football** (YouTube, Engels) voor visueel tactiekbegrip — formaties, pressing.
- Kapstok-concept: **de vier fases** — balbezit, balverlies, omschakeling naar aanval, omschakeling naar verdediging. Bijna alle tactiek valt hieronder. Voor O14 zijn de omschakelmomenten waar de meeste winst zit.
- Formaties zijn alleen startposities, niet heilig. 4-3-3 = extra middenvelder (driehoek), 4-4-2 = twee spitsen + platte lijn.

## Trainingsaanpak — principes
- Vaste weekstructuur: inloop met bal → warming-up → technisch blok (bouwt op) → partij → afsluiten. Alleen het technische blok groeit mee.
- Herhaling werkt; kinderen krijgen houvast van een vast ritme.
- 17 spelers + 2 trainers: splits bij het technische blok in 2 groepen. Stilstaan is de vijand.
- Kleine veldjes bij de partij = veel meer balcontacten dan groot veld.

## Rotatie / speeltijd
- Geen exacte speeltijd op de klok bijhouden — dat is gekkenwerk. Op gevoel doorwisselen, wel bewust: even checken wie het minst heeft gespeeld.
- Rouleren binnen de linies: poule verdedigers / middenvelders / aanvallers, doorschuiven wie speelt vs. bank.
- Op O14 af en toe over de linies wisselen voor de ontwikkeling.
- Geen vaste keeper? Ieder een halve wedstrijd. Uitkijken naar iemand die het gráág doet.

## Tools — afweging
- **Rinus**: gratis, KNVB-gestuurd, goede bibliotheek + planning. Soms lastig precies vinden wat je zoekt.
- **De VoetbalTrainer (TrainingsPlanner)**: ~1500 trainingen/oefeningen, leerlijnen, vakmatiger. **Prijs (gecheckt 19 aug 2026): €89,50 per jaar** voor een individueel abonnement; een andere pagina noemt "vanaf €95,00 per jaar". **Geen gratis proefperiode voor individuele trainers** — de "30 dagen op proef" die eerder in deze notitie stond, gold voor *clubs* en die pagina's zijn inmiddels offline (404). Betalen of niet, dus.
- Aanpak: Rinus als bibliotheek/planner, deze map (Cowork) als eigen kladblok voor zelfbedachte oefeningen, log en conclusies. Eventueel VoetbalTrainer proberen als Rinus te beperkt blijft.
- Coach Amigo was te veel micro-management (spelervolgsysteem hoeft niet).

### Bevinding 19 aug 2026 — Rinus is traag
Bij het openen van de oefeningen-modal bleef de app ruim een minuut op een spinner staan. In de netwerktab: alle afbeeldingen keurig 304, de meeste calls in milliseconden, maar één request — `hook?hook=userExercisesFirst…` — deed er **~50 seconden** over. Dat is hun backend, daar valt aan mijn kant niets aan te doen.

Vermoeden: `userExercisesFirst` is een eerste-keer-pad (eigen oefeningenlijst die nog nergens gecached staat). Te testen door de modal opnieuw te openen — als die hook dan wél snel is, was het eenmalig.

Gevolgen voor de keuze:
- Bevestigt dat een app op het veld geen optie is (zie *Materiaal* in `README.md`). Een minuut wachten op een spinner met 17 kinderen ernaast.
- Als dit structureel is: overwegen om De VoetbalTrainer te nemen — maar dat is €89,50 blind vooruitbetalen, er is geen proefperiode (zie hierboven). Eerst een paar weken kijken hoeveel ik Rinus überhaupt nodig heb.

## Wat er in deze map staat
- `README.md` — overzicht van de map.
- `trainingslog.md` — per training doel/opzet/conclusies. Training 1 (vrijdag) staat erin.
- `team.md` — losse indrukken over de groep.
- `oefeningen/` — eigen oefeningen met tekening + instructie (aannemen & meenemen, slalom pass-en-go).

## Volgende stappen
- Vrijdag training 1 draaien, daarna het "na afloop"-blok invullen.
- Rinus eens goed doorspitten.
- VoetbalTrainer alleen overwegen als Rinus echt tekortschiet — geen proefperiode, dus het is meteen €89,50.
- Training 2: half veld met keepers, eventueel buitenspel introduceren.
