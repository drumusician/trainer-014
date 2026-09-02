# Supabase voor Blaadje

Doel: op je laptop voorbereiden, langs de lijn op je telefoon gebruiken, en niets kwijtraken als een toestel sneuvelt.

## Wat er nu staat

`schema.sql` — twee tabellen en één functie. Draai hem één keer in de SQL editor van je project.

- `teams` — naam en eigenaar. Meer niet.
- `team_toestand` — de hele app-toestand als één JSON-document, met een versienummer.
- `toestand_opslaan(team_id, data, verwachte_versie)` — opslaan met versiecontrole.

Waarom één document en geen tabel per ding: de app bewaart nu al precies dit ene JSON-blok in de browser. Zo is synchroniseren letterlijk opsturen en terughalen. Zodra iemand anders dan de trainer moet meekijken (een assistent, of ouders die een verslag lezen), splitsen we het uit elkaar. Dat is dan een migratie van een uur, geen herbouw.

Het versienummer lost het enige echte probleem op: je zet zaterdagochtend een opstelling klaar op je laptop terwijl je telefoon nog de wedstrijd van vorige week heeft. Zonder versiecontrole wint wie het laatst opslaat en ben je stil je werk kwijt. Nu krijgt de app een foutmelding en kan hij vragen wat je wilt.

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
