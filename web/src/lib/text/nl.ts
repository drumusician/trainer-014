/**
 * Alle tekst die een trainer op zijn scherm ziet, op één plek.
 *
 * Waarom hier en niet in de componenten:
 *
 * Ten eerste omdat het te lezen moet zijn. De woorden zijn het product net zo
 * goed als de knoppen, en verspreid over negentien bestanden kun je ze niet in
 * één keer doorlezen. Hier wel.
 *
 * Ten tweede omdat ze anders meebewegen met de code. Bij het hernoemen naar het
 * Engels zijn er 110 Engelse woorden midden in Nederlandse zinnen beland — "Nog
 * geen players", "wie on zitten", "de wissels laat ik er defaultLineup uit" —
 * en geen enkele test ving dat, want copy is geen gedrag. Zinnen die hier staan
 * hebben geen code omheen die per ongeluk mee verandert.
 *
 * De sleutels zijn Engels omdat de code dat is. De waarden zijn Nederlands
 * omdat het product dat is: Blaadje is voor Nederlandse jeugdtrainers, en het
 * Nederlands wordt hier geschreven en niet uit een andere taal vertaald. Komt
 * er ooit een tweede taal, dan komt daar een tweede bestand naast en verandert
 * er aan de componenten niets.
 *
 * Zinnen met iets variabels erin zijn functies. Zo blijft de hele zin bij
 * elkaar staan in plaats van in stukken door de opmaak verspreid, en zie je bij
 * het lezen meteen wat er invalt.
 */

/** Wat op meerdere schermen terugkomt. */
const common = {
	back: 'Terug',
	cancel: 'Annuleren',
	done: 'Klaar',
	delete: 'Weg',
	change: 'Wijzigen',
	noSquadYet: 'Nog geen spelers',
	noSquadHint: 'Zet eerst je selectie erin, dan valt er wat op te stellen.',
	toSquad: 'Naar Team'
} as const;

/** Wie is er vandaag — tevens het opzetscherm van een wedstrijd. */
const attendance = {
	title: 'Wie is er?',

	noMatch: 'Er is geen wedstrijd om spelers voor af te melden.',

	opponentHeading: 'Tegen wie',
	opponentLabel: 'Tegenstander',
	opponentPlaceholder: 'bijv. Sparta JO11-2',
	homeOrAwayLabel: 'Thuis of uit',
	home: 'Thuis',
	away: 'Uit',

	heading: 'Wie is er vandaag',
	/* Tijdens de wedstrijd is dit geen opzetscherm meer maar een correctie, en
	   dan mag het veld niet meer wijzigen — zie setAbsent in actions/match.ts. */
	hintDuringMatch:
		'De wedstrijd loopt. Wie in het veld staat haal je eruit met een wissel, niet hier — anders klopt zijn speeltijd niet meer. Van de bank afmelden kan wel.',
	hintBeforeMatch:
		'Tik weg wie er niet is. Die staat dan niet op de bank, zodat je hem er langs de lijn niet per ongeluk in brengt. Wie al opgesteld stond, laat zijn plek leeg.',

	/* In twee stukken, en dat is een uitzondering. Het aantal staat vet in een
	   verder grijze regel: dat is het getal waar je op scant. Vet kan niet in een
	   tekst zonder opmaak in dit bestand te halen, dus staat het getal in de
	   opmaak en de rest van de zin hier. */
	countRest: (total: number) => `van de ${total} aanwezig`,
	sessions: (came: number, total: number) => `${came}/${total} training`,

	onPitch: 'In het veld',
	present: 'Er wel',
	absent: 'Er niet',

	backToMatch: 'Terug naar de wedstrijd',
	onToLineup: 'Verder naar de opstelling'
} as const;

/** Na de wedstrijd: uitslag, speeltijd, verloop en het verslag. */
const afterMatch = {
	title: 'Uitslag',
	toStart: 'Naar start',
	noMatch: 'Nog geen wedstrijd.',
	resultHeading: 'Uitslag',
	details: (date: string, played: string, formation: string) => `${date} · ${played} gespeeld · ${formation}`,
	playingTimeHeading: 'Speeltijd',
	timelineHeading: 'Verloop',
	noteHeading: 'Hoe ging het',
	noteHint: 'Een paar regels voor jezelf of voor de groepsapp. Gaat mee in het verslag.',
	notePlaceholder: 'Sterk begin, na rust weggezakt. Achterin stond het goed.',
	shareHeading: 'Delen',
	shareHint: 'Voor de groepsapp. De wissels laat ik er standaard uit.',
	archived: 'Bewaard in archief',
	archive: 'Bewaren in archief',
	newMatch: 'Nieuwe wedstrijd'
} as const;

/** Trainingen: de lijst, en één avond in detail. */
const trainings = {
	title: 'Trainingen',
	heading: 'Trainingen',
	noSquad: 'Zet eerst je selectie erin, dan kun je afvinken wie er was.',
	none: 'Nog geen trainingen. Maak er een aan; iedereen staat dan op aanwezig en je tikt alleen wie er niet is.',
	hint: 'Tik een training aan om hem bij te werken. De datum kun je daar aanpassen, dus een gemiste week vul je later gewoon in.',
	/* Alleen noemen wat er is: nul afgemeld hoeft niet in de regel te staan. */
	summary: (present: number, excused: number, absent: number) =>
		`${present} aanwezig` + (excused ? `, ${excused} afgemeld` : '') + (absent ? `, ${absent} niet gekomen` : ''),
	create: 'Nieuwe training',

	thinHeading: 'Weinig geweest',
	thinHint: 'Over de laatste vier trainingen. Je ziet het ook terug als je je opstelling maakt.',

	gone: 'Deze training staat er niet meer.',
	oneTitle: (date: string) => `Training ${date}`,
	oneHeading: 'Training',
	dateLabel: 'Datum',
	present: (n: number) => `${n} aanwezig`,
	excused: (n: number) => `${n} afgemeld`,
	absent: (n: number) => `${n} niet gekomen`,
	cycleHint: 'Tik op de knop achter een naam om hem langs aanwezig, afgemeld en niet gekomen te zetten.',
	/* De drie standen op de knop zelf. */
	statusWord: { present: 'Aanwezig', excused: 'Afgemeld', absent: 'Niet gekomen' },
	remove: 'Verwijderen'
} as const;

/** Team: de selectie, de verdeling over de linies, en de teamnaam. */
const team = {
	title: 'Team',

	statsHeading: 'Speeltijd en presentie',
	statsHint: 'Gespeelde minuten per speler, hoe vaak ze op de training waren, en wie er scoorden.',
	toStats: 'Spelersoverzicht',

	squadHeading: 'Selectie',
	emptyHint:
		'Plak hier de namen, één per regel. Ze blijven op dit toestel en komen nergens anders terecht. Liever stap voor stap?',
	emptyHintLink: 'Loop het opzetten door.',
	namesPlaceholder: 'Casper\nMaher\nDaan',
	add: 'Toevoegen',
	lineHint:
		'Zet per speler de linie: V verdediging, M middenveld, A aanval. K staat los: dat is iedereen die kan keepen, ook als hij verder in het veld speelt. Alleen K aan en de rest uit betekent: keept en verder niets. Tik een naam aan om te wijzigen of te verwijderen.',
	addPlayer: 'Speler toevoegen',
	askName: 'Naam van de speler',
	askRename: 'Naam wijzigen. Laat leeg om deze speler te verwijderen.',
	confirmRemove: (name: string) => `${name} verwijderen uit de selectie?`,

	coverageHeading: (formation: string) => `Verdeling in ${formation}`,
	canKeep: (n: number) => `${n} ${n === 1 ? 'kan' : 'kunnen'} keepen`,
	forPositions: (players: number, positions: number) =>
		`${players} voor ${positions} ${positions === 1 ? 'plek' : 'plekken'}`,
	coverageShort: 'Een linie is niet vol te krijgen met de spelers die je zo gemarkeerd hebt.',
	coverageThinKeepers: 'Er kan er maar één keepen. Is hij er niet, dan moet je ter plekke iemand aanwijzen.',
	coverageCrowded:
		'Waar meer dan twee keer zoveel spelers als plekken staan, zit er elke wedstrijd iemand op de bank die zichzelf daar ziet. Een andere formatie kan schelen.',
	coverageFine: 'De letters zijn een hint bij het wisselen, geen regel: je kunt altijd iedereen kiezen.',

	nameHeading: 'Naam van je team',
	nameHint: 'Staat boven de wedstrijd en in het verslag dat je deelt.',
	nameWarning: 'Vul hem in, anders staat er straks "Ons team" in je verslag.',
	nameLabel: 'Teamnaam',
	namePlaceholder: 'bijv. JO11-2'
} as const;

/** Het wedstrijdscherm: de klok, het veld en alles wat je langs de lijn tikt. */
const match = {
	noSquadHeading: 'Nog geen spelers',
	noMatchHeading: 'Nog geen wedstrijd',
	noMatchHint: 'Begin er een op het startscherm, dan zet je hier je opstelling neer.',
	finishedHeading: 'Wedstrijd afgelopen',
	toOverview: 'Naar het overzicht',

	/* De klokregel. Tijdens een pauze staat er welk deel voorbij is. */
	clockInBreak: (breakName: string, partName: string) => `${breakName} · ${partName} voorbij`,
	clockRunning: (partName: string) => `${partName} · tik om de tijd te zetten`,
	pause: 'Pauze',
	start: 'Start',
	minuteLabel: 'Minuut',
	minuteBack: '−1′',
	minuteForward: '+1′',

	goal: 'Doelpunt',
	conceded: 'Tegen',
	undo: (what: string) => `↶ ${what} terug`,
	whoIsThere: 'Wie is er?',
	finish: 'Wedstrijd afsluiten',
	confirmFinish: 'Wedstrijd afsluiten?\n\nDe klok stopt en je krijgt het overzicht met de speeltijden.',

	/* De oranje balk onderin, die zegt wat de volgende tik doet. */
	goalPrompt: 'Tik op het veld wie hem maakte.',
	goalUnknown: 'Weet ik niet',
	assistPrompt: 'scoorde. Wie legde hem klaar? Tik hem aan, of sla dit over.',
	noAssist: 'Geen assist',
	emptyPosition: 'Lege plek',
	substitutePrompt: (line: string) => `${line}. Tik wie erin komt, of een andere plek om te ruilen.`,
	alreadyKept: (minutes: number) => `Hij keepte deze wedstrijd al ${minutes} minuten.`,
	scored: (name: string) => `${name} scoorde`
} as const;

export const text = {
	common,
	attendance,
	afterMatch,
	trainings,
	team,
	match
} as const;
