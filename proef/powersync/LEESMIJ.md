# Proef: synchroniseren met PowerSync

De vraag was of PowerSync kan wat Blaadje nodig heeft als de apps voor iOS en
Android tegen het model in tabellen (`supabase/model.sql`) gaan werken: zonder
account en zonder bereik werken, en later alles netjes op de server krijgen.

Antwoord: ja. Dertien scenario's, alle dertien geslaagd.

```
colima start     # of een andere Docker
./draai.sh
```

## Wat er staat

Wat Supabase doet, nagebouwd met drie containers, zodat de echte database
buiten schot blijft:

- **Postgres** met `schema.sql` en `model.sql` erin, ongewijzigd.
- **PostgREST**, de REST-laag die Supabase ook gebruikt. Hier komen de
  wijzigingen van het toestel binnen, langs dezelfde regels (RLS) als straks.
- **De PowerSync-dienst**, zelf gehost. Die leest mee met de database en stuurt
  elk toestel wat van hem is. Wie wat krijgt staat in `powersync/sync-config.yaml`.

Het proefprogramma (`Proef/`) is Swift met de PowerSync-SDK voor Swift, dezelfde
die de iOS-app gebruikt. Elk "toestel" is een eigen SQLite-bestand. Het draait
op macOS, niet in een iPhone-simulator.

## Wat het aantoont

1. Zonder account een team, spelers en een wedstrijd maken; na afsluiten staat het er nog.
2. Inloggen stuurt alles op wat zonder account gemaakt is, en wie inlogt wordt eigenaar.
3. Wat er stond blijft staan als de server het teruggeeft.
4. Een tweede toestel krijgt alles binnen.
5. Een wissel staat binnen een paar tienden van een seconde op het andere toestel.
6. Twee toestellen zonder bereik bij dezelfde wedstrijd: de wissels van allebei komen aan.
7. Twee toestellen wijzigen dezelfde rij: per veld wint wie het laatst opstuurt.
8. Weghalen op het ene toestel haalt weg op het andere.
9. Een andere trainer krijgt niets binnen.
10. Schrijven in andermans team wordt geweigerd, en het toestel wordt rechtgezet.
11. Wie wordt toegelaten krijgt het team binnen zonder opnieuw in te loggen.
12. Wie eruit wordt gezet raakt het weer kwijt.
13. Uitloggen wist het toestel; opnieuw inloggen haalt alles terug.

## Wat we ervan leerden

- **Een team heeft geen eigenaar tot je inlogt.** Zonder account weet het toestel
  niet van wie het team is. De database vult het in bij het opsturen
  (`eigenaar default auth.uid()` in `model.sql`); het toestel kent die kolom niet.
- **JSON moet onderweg uitgepakt.** Op het toestel is de opstelling tekst. Stuur
  je die zo door, dan staat er in de database een tekst in plaats van een object.
  De koppeling pakt die kolommen uit voor het opsturen.
- **Een weigering mag de rij niet ophouden.** Wat de server weigert wordt nooit
  beter van opnieuw proberen. De koppeling gooit het weg en schrijft het op; de
  server haalt de rij daarna zelf weer van het toestel.
- **Er is geen botsingsmelding meer.** Bij dezelfde rij wint per veld de laatste.
  Voor wissels en doelpunten speelt dat niet: dat zijn losse rijen.
- **Wie wat krijgt staat op twee plekken**: in de regels van de database, en nog
  een keer in `sync-config.yaml`. Die moeten gelijk blijven.

## Wat het niet aantoont

- Het draaide op macOS: niet op een iPhone, niet op de achtergrond, niet met een
  vergrendeld scherm.
- Alles op één machine: geen echt netwerk, geen wegvallend bereik halverwege.
- Niet tegen het echte Supabase-project en niet met de gehoste PowerSync-dienst,
  dus ook niets over kosten of over inloggen via Supabase.
- De SDK voor Kotlin (Android) is niet geprobeerd.
- Weggooien op het ene toestel terwijl het andere dezelfde rij wijzigt.
