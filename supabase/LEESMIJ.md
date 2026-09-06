# Supabase voor Blaadje

Doel: op je laptop voorbereiden, langs de lijn op je telefoon gebruiken, en niets kwijtraken als een toestel sneuvelt.

## Wat er nu staat

`schema.sql` — vier tabellen en een handvol functies. Draai hem in de SQL editor
van je project; hij is te herhalen, dus bij een wijziging plak je hem er gewoon
opnieuw in.

- `teams` — naam en eigenaar. Meer niet.
- `team_toestand` — de hele app-toestand als één JSON-document, met een versienummer.
- `team_leden` — wie er bij een team kan, en met welke rol.
- `uitnodigingen` — wie er gevraagd is, op e-mailadres.
- `toestand_opslaan(team_id, data, verwachte_versie)` — opslaan met versiecontrole.
- `uitnodiging_aannemen()` — een uitnodiging op jouw adres omzetten in lidmaatschap.

Een team is van één iemand. Die eigenaar kan anderen uitnodigen op hun
e-mailadres; zij mogen daarna alles bijhouden, maar het team niet hernoemen,
verwijderen of er nog iemand bij zetten. Uitnodigen gaat bewust niet met een
deelbare code: een code die in een groepsapp rondslingert is een sleutel die je
niet meer terugkrijgt.

`is_lid()`, `is_eigenaar()` en `is_uitgenodigd()` zijn `security definer`. Dat
moet: een regel op `team_leden` die zelf `team_leden` bevraagt roept zichzelf aan,
en Postgres kapt dat af met een recursiefout.

## De regels bewijzen

```
./supabase/test/draai.sh
```

Draait de echte `schema.sql` op een verse Postgres en gaat na dat een trainer niet
bij het team van een ander kan — lezen niet, schrijven niet, en ook niet via een
uitnodiging die niet voor hem is. Dit draait in CI. De proef is met opzet zeven
keer gesloopt om te zien of hij bijt; alle zeven werden gevangen. Verander je iets
aan de regels, doe dat dan ook: maak de regel expres te ruim en kijk of de proef
omvalt.

Waarom één document en geen tabel per ding: de app bewaart nu al precies dit ene JSON-blok in de browser. Zo is synchroniseren letterlijk opsturen en terughalen. Zodra iemand anders dan de trainer moet meekijken (een assistent, of ouders die een verslag lezen), splitsen we het uit elkaar. Dat is dan een migratie van een uur, geen herbouw.

Het versienummer lost het enige echte probleem op: je zet zaterdagochtend een opstelling klaar op je laptop terwijl je telefoon nog de wedstrijd van vorige week heeft. Zonder versiecontrole wint wie het laatst opslaat en ben je stil je werk kwijt. Nu krijgt de app een foutmelding en kan hij vragen wat je wilt.

Uitrollen, terugrollen en gegevens terughalen staat in [UITROLLEN.md](../UITROLLEN.md).

## Instellen

1. Project aanmaken in de privé-org. Bij Security: **Data API aan**, **automatically expose new tables uit**, **automatic RLS aan**.
2. SQL editor → `schema.sql` erin → Run.
3. Authentication → Sign In / Providers → **Email** aanzetten.
4. Authentication → **Emails** → template **Magic Link**: zet `{{ .Token }}` in de tekst. Zonder die regel stuurt Supabase alleen een link, en de app vraagt om een code van zes cijfers.

   Zonder die regel werkt de **link** in de mail: de app vangt hem op als je terugkomt. Dan moet wel Authentication → **URL Configuration** kloppen: Site URL op je Netlify-adres, en bij Redirect URLs ook je lokale testadres (`http://localhost:8788` of welke poort je gebruikt).

   Waarom uiteindelijk toch een code en geen magic link: een app op je iPhone-beginscherm heeft eigen opslag, los van Safari. Een link uit de mail opent Safari, en dan logt de verkeerde omgeving in. Een code typ je in de app zelf, dus dat probleem bestaat niet.
5. Project Settings → API Keys → tabje **Publishable and secret API keys** → de `sb_publishable_...` sleutel. Die staat samen met de project-URL boven in `app/index.html`. Allebei openbaar bedoeld; RLS doet het echte werk.

De ingebouwde mail van Supabase heeft een lage limiet (een paar per uur) en is bedoeld om te testen. Voor jezelf is dat genoeg. Zodra er meer trainers op zitten: Authentication → SMTP Settings met een eigen afzender, anders komen de codes niet aan.

## Hoe de app het gebruikt

Instellen → Synchroniseren. Inloggen met e-mail en een code, één keer per toestel. Daarna twee knoppen: **Opsturen** en **Ophalen**.

Wat meegaat: selectie, formatie, standaardopstelling, trainingen, archief. Wat niet meegaat: de wedstrijd die nu loopt. Die blijft op het toestel waar je hem speelt, zodat een druk op de knop op je laptop nooit je lopende wedstrijd kan wissen.

Botst het, dan zegt de app dat er iets nieuwers op de server staat en doet hij niets. Je kiest dan zelf: ophalen, of met opzet dit toestel eroverheen sturen.

"Code maken / Code invoeren" blijft bestaan voor als je geen zin hebt in een account, of geen bereik hebt.

## Wat er nooit in mag

Namen van kinderen horen bij de trainer, niet in een openbare tabel. Alles hierboven staat achter RLS op `auth.uid()`. Zet dat nooit uit "om even te testen"; maak dan liever een tweede account aan.
