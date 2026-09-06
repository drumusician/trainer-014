# Woordenlijst

De code wordt naar het Engels gebracht. Deze lijst legt vast wélk Engels woord
bij welk begrip hoort, want inconsistente Engelse namen zijn erger dan
consistente Nederlandse. Wie hier iets aan toevoegt, kiest één woord en gebruikt
dat overal.

De **interfaceteksten blijven Nederlands** — de app is voor Nederlandse
jeugdtrainers. Alleen de code verandert van taal. Ook de **adresroutes blijven**
zoals ze zijn (`/app/wedstrijd`, `/app/trainingen`): dat is productoppervlak, en
het is het enige deel dat bij gebruikers kan breken.

## Kern

| Nederlands | Engels | let op |
|---|---|---|
| toestand | `state` | alles wat de app onthoudt |
| wedstrijd | `match` | |
| speler | `player` | |
| selectie | `squad` | de spelers van je team, niet de opstelling |
| opstelling | `lineup` | wie op welke plek staat |
| standaard(opstelling) | `defaultLineup` | de opstelling waar elke wedstrijd mee begint |
| bank | `bench` | |
| formatie | `formation` | `4-4-2 ruit` → `4-4-2 diamond` |
| plek | `position` | de plek op het veld: `K`, `LV`, `CVl` |
| linie | `line` | keeper, verdediging, middenveld, aanval |
| veldlinie | `fieldLine` | linie zonder de keeper |
| archief | `archive` | bewaarde wedstrijden |
| training | `training` | een trainingsavond |

## Wat er tijdens een wedstrijd gebeurt

| Nederlands | Engels | let op |
|---|---|---|
| gebeurtenis | `event` | waar de speeltijd uit wordt teruggerekend |
| wissel | `substitution` | iemand van de bank voor iemand in het veld |
| ruil | `swap` | twee spelers wisselen van plek, de bank blijft gelijk |
| eruit / erin | `off` / `on` | bij een wissel: `playerOff`, `playerOn` |
| doelpunt | `goal` | |
| tegendoelpunt | `conceded` | |
| assist | `assist` | |
| rust | `break` | het einde van een deel, niet alleen de rust |
| eind | `end` | |
| deel / delen | `part` / `parts` | helften of kwarten, dezelfde code |
| pauze | `inBreak` | het is nú rust |
| verstreken | `elapsed` | seconden gespeeld |
| sinds | `since` | wanneer de klok voor het laatst ging lopen |
| loopt | `running` | |
| afgelopen | `finished` | |
| bewaard | `archived` | in het archief gezet |
| afwezig | `absent` | |
| tegenstander | `opponent` | |
| thuis | `home` | |

## Afgeleide cijfers

| Nederlands | Engels |
|---|---|
| speeltijd | `playingTime` |
| keepertijd | `keeperTime` |
| positietijd | `positionTime` |
| stand | `score` |
| duur | `duration` |
| seizoen | `season` |
| presentie / aanwezigheid | `attendance` |
| aanwezig / afgemeld / niet gekomen | `present` / `excused` / `absent` |
| bezetting | `coverage` — hoeveel spelers je per linie hebt tegenover het aantal plekken |

## Om de app heen

| Nederlands | Engels |
|---|---|
| acties | `actions` — verandert de toestand |
| domein | `domain` — rekent, verandert niets |
| kop | `header` |
| verslag | `report` |
| notitie | `note` |
| overzetten | `transfer` — de code waarmee je naar een ander toestel gaat |
| back-up | `backup` |
| opslag | `storage` |
| toestel | `device` |
| problemen | `issues` |
| meten | `analytics` |

## Wat er níet verandert

- De **veldnamen in de opslag** volgen later en apart. Die staan in de
  `localStorage` van elke gebruiker, in Supabase en in geëxporteerde
  back-upbestanden. Ze hernoemen zonder migratie wist ieders gegevens.
- De **plekcodes** (`K`, `LV`, `CVl`, `RV`, `VM`, `ML`, `MR`, `TIEN`, `SPl`,
  `SPr`) zijn al grotendeels internationale voetbalnotatie. Alleen `TIEN` is
  Nederlands; die wordt `TEN` als de opslag aan de beurt is, niet eerder.
- De **routes** en alle **teksten op het scherm**.
