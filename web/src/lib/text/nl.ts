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
	toSquad: 'Naar Team',
	toStart: 'Naar start',
	getStarted: 'Aan de slag'
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
	copied: 'Gekopieerd. Staat hier ook, voor als plakken niet lukt.',
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
	remove: 'Verwijderen',
	confirmRemove: (date: string) => `De training van ${date} verwijderen?`
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
	/* In stukken omdat de K vet staat: dat is de letter waar de uitleg over gaat. */
	lineHint: {
		before: 'Zet per speler de linie: V verdediging, M middenveld, A aanval.',
		bold: 'K',
		after:
			'staat los: dat is iedereen die kan keepen, ook als hij verder in het veld speelt. Alleen K aan en de rest uit betekent: keept en verder niets. Tik een naam aan om te wijzigen of te verwijderen.'
	},
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
	/* 'Stop', niet 'Pauze': bij vier kwarten heet de knop ernaast in het eerste
	   kwart óók 'Pauze', en dan staan er twee dezelfde knoppen naast elkaar die
	   iets heel anders doen — de een zet de klok stil, de ander beëindigt het
	   kwart. Start/Stop hoort bij een klok en botst nergens mee. */
	pause: 'Stop',
	start: 'Start',
	minuteLabel: 'Minuut',
	minuteBack: '−1′',
	minuteForward: '+1′',

	goal: 'Doelpunt',
	conceded: 'Tegen',
	undo: (what: string) => `↶ ${what} terug`,
	whoIsThere: 'Wie is er?',
	keptBy: (wie: string) => `${wie} houdt deze wedstrijd bij. Tik hier niet ook mee, anders raken jullie wissels zoek.`,
	takeOver: 'Ik neem hem over',
	confirmTakeOver:
		'Deze wedstrijd op dit toestel overnemen?\n\nDoe dit als het andere toestel leeg is of kwijt. Houden jullie hem daarna allebei bij, dan raken de wissels van een van jullie zoek.',
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

/** De schil om elk scherm: waarschuwingen en de tabbalk. */
const shell = {
	savingFails: 'Opslaan lukt niet. Wat je nu doet is weg zodra je de app sluit — maak ruimte op je toestel.',
	conflict: 'Op de server staat iets nieuwers, van een ander toestel.',
	conflictPull: 'Ophalen',
	conflictPush: 'Dit toestel',
	tabs: {
		matches: 'Wedstrijden',
		training: 'Training',
		team: 'Team',
		data: 'Gegevens'
	}
} as const;

/** Wat je ziet als een scherm het niet doet. */
const errorPage = {
	title: 'Er ging iets mis',
	heading: 'Er ging iets mis',
	hint: 'Dit scherm kwam er niet uit. Je gegevens staan gewoon nog op dit toestel — er is niets kwijt.',
	toMatches: 'Terug naar de wedstrijden',
	toData: 'Gegevens en back-up',
	forReporting: 'Voor als je het doorgeeft:',
	logged: (path: string) => `Een scherm liep vast: ${path}`
} as const;

/** Het beginscherm: wat er nu speelt, hoe jullie spelen, en wat je gespeeld hebt. */
const home = {
	title: 'Wedstrijden',

	welcomeHeading: 'Welkom bij Blaadje',
	welcomeHint:
		'In drie stappen sta je klaar: de naam van je team, wie erin zitten, en hoe jullie spelen. Duurt een minuut.',
	getStarted: 'Aan de slag',

	/* Het blok bovenaan zegt in twee woorden wat er nu aan de hand is. */
	nowBusy: 'Bezig',
	nowBusyClock: (time: string, part: string, running: boolean) =>
		`${time} · ${part} · ${running ? 'klok loopt' : 'klok staat stil'}`,
	nowReady: 'Klaar om te beginnen',
	nowReadyHint: 'De opstelling staat. De klok begint als jij op Start drukt.',
	nowTodo: 'Nog te doen',
	nowTodoTitle: 'Opstelling maken',
	nowJustPlayed: 'Net gespeeld',
	nowNotArchived: 'Nog niet bewaard',
	versus: (opponent: string) => `Tegen ${opponent}`,
	nowSaturday: 'Zaterdag',
	nowNewMatch: 'Nieuwe wedstrijd',
	nowSetup: (formation: string, parts: number, minutes: number) =>
		`${formation} · ${parts === 4 ? '4 kwarten' : '2 helften'} van ${minutes} min`,

	whoIsThere: 'Wie is er?',
	lineup: 'Opstelling',
	discard: 'Weggooien',
	confirmDiscard: (opponent: string) =>
		`Deze wedstrijd tegen ${opponent} weggooien?\n\nWat je in het archief bewaarde blijft staan.`,

	howYouPlayHeading: 'Zo spelen jullie',
	formationLabel: 'Formatie',
	partsLabel: 'Speelwijze',
	halves: '2 helften',
	quarters: '4 kwarten',
	minutesLabel: (parts: number) => `Minuten per ${parts === 4 ? 'kwart' : 'helft'}`,
	durationLabel: 'Speelduur',
	durationValue: (minutes: number) => `${minutes} minuten`,
	editDefaultLineup: 'Vaste opstelling wijzigen',
	makeDefaultLineup: 'Vaste opstelling maken',

	playedHeading: 'Gespeeld',
	nothingArchived:
		'Nog niets bewaard. Sluit een wedstrijd af en bewaar hem, dan staat hij hier met uitslag, speeltijden en het hele verloop.',
	seasonLine: (won: number, drew: number, lost: number, forGoals: number, against: number, minutes: number) =>
		`${won}W ${drew}G ${lost}V · ${forGoals} voor, ${against} tegen · ${minutes} minuten voetbal`,
	matchLine: (home: boolean, opponent: string) => `${home ? 'thuis' : 'uit'} tegen ${opponent}`,
	toSeason: 'Seizoen en topscorers'
} as const;

/** Een bewaarde wedstrijd terugkijken en bijwerken. */
const archivedMatch = {
	fallbackTitle: 'Wedstrijd',
	title: (date: string, opponent: string) => `${date} · ${opponent}`,
	gone: 'Deze wedstrijd staat er niet meer.',
	resultHeading: 'Uitslag',
	details: (date: string, played: string, formation: string) => `${date} · ${played} gespeeld · ${formation}`,
	edit: 'Bijwerken',
	doneEditing: 'Klaar met bijwerken',
	dateLabel: 'Datum',
	homeOrAwayLabel: 'Thuis of uit',
	home: 'Thuis',
	away: 'Uit',
	opponentLabel: 'Tegenstander',
	playingTimeHeading: 'Speeltijd',
	keeperMinutes: (minutes: number) => `${minutes} min in het doel`,
	timelineHeading: 'Verloop',
	/* Alleen de score is hier te wijzigen; zie actions/archive.ts voor waarom. */
	editHint:
		'Een doelpunt dat er niet was kun je weghalen; de stand telt vanzelf opnieuw. Wissels blijven staan, want daar hangt de speeltijd aan.',
	addGoalHeading: 'Doelpunt erbij',
	minuteLabel: 'Minuut',
	minutePlaceholder: '35',
	forOrAgainstLabel: 'Voor of tegen',
	forUs: (team: string) => `Voor ${team}`,
	against: 'Tegen',
	scorerLabel: 'Wie scoorde',
	scorerUnknown: 'Weet ik niet',
	add: 'Toevoegen',
	needMinute: 'Vul een minuut in.',
	noteHeading: 'Hoe ging het',
	notePlaceholder: 'Nog niets opgeschreven.',
	shareHeading: 'Delen',
	remove: 'Verwijderen',
	confirmRemove: (opponent: string, date: string) =>
		`De wedstrijd tegen ${opponent} van ${date} uit het archief verwijderen?`
} as const;

/** Het seizoen: alles uit het archief bij elkaar. */
const season = {
	title: 'Seizoen',
	heading: 'Seizoen',
	empty:
		'Nog geen bewaarde wedstrijden en geen trainingen. Sluit een wedstrijd af en bewaar hem, dan telt hij hier mee.',
	record: (matches: number, won: number, drew: number, lost: number) =>
		`${matches} ${matches === 1 ? 'wedstrijd' : 'wedstrijden'} · ${won}W ${drew}G ${lost}V`,
	goals: (forGoals: number, against: number, minutes: number) =>
		`${forGoals} voor, ${against} tegen · ${minutes} minuten voetbal`,
	scorersHeading: 'Topscorers',
	scorersHint: 'Alleen doelpunten waarvan je de maker aantikte. De rest telt gewoon mee in de uitslag.',
	toPlayers: 'Speeltijd en presentie per speler',
	noMatchesYet: 'Nog geen bewaarde wedstrijden.'
} as const;

/** Het spelersoverzicht: alles wat je van iedereen weet, op een rij. */
const players = {
	title: 'Spelers',
	heading: 'Spelers',
	empty: 'Nog geen selectie. Zet je namen erin bij Team.',
	hint: (matches: number, sessions: number) =>
		`Alles bij elkaar: gespeelde minuten over ${matches} ${matches === 1 ? 'bewaarde wedstrijd' : 'bewaarde wedstrijden'}, en hoe vaak ze op de training waren (${sessions} ${sessions === 1 ? 'training' : 'trainingen'}).`,
	sortLabel: 'Sorteer op',
	sortByMinutes: 'Speeltijd',
	sortByAttendance: 'Presentie',
	sortByGoals: 'Doelpunten',
	sortByName: 'Naam',
	noLine: 'geen linie',
	matchesAverage: (matches: number, average: number) =>
		`${matches} ${matches === 1 ? 'wedstrijd' : 'wedstrijden'} · gem. ${average} min`,
	keeperMinutes: (minutes: number) => `${minutes} min in het doel`,
	scored: (n: number) => `${n}× gescoord`,
	assists: (n: number) => `${n} ${n === 1 ? 'assist' : 'assists'}`,
	minutes: (n: number) => `${n} min`,
	noSessions: 'geen training',
	attendance: (pct: number, came: number, total: number) => `${pct}% · ${came}/${total}`,
	footnote:
		'Speeltijd telt alleen wedstrijden die je bewaard hebt. Een wedstrijd waarin iemand niet in het veld kwam telt bij hem niet mee, dus zijn gemiddelde blijft eerlijk.'
} as const;

/** Het opstelscherm: het veld met de bank ernaast, voor de wedstrijd of de standaard. */
const lineupScreen = {
	titleDefault: 'Standaardopstelling',
	titleMatch: 'Opstelling',
	noMatch: 'Er is geen wedstrijd om op te stellen. Begin er een op het startscherm.',
	toStart: 'Naar start',
	getStarted: 'Aan de slag',
	benchEmpty: 'Niemand over.',

	/* De oranje balk zegt wat de volgende tik doet. */
	chosenPlayer: (line: string) => `${line}. Tik een andere plek om te ruilen, of iemand van de bank.`,
	emptyPosition: 'Lege plek',
	chosenEmpty: (line: string) => `${line}. Tik wie hier komt te staan.`,
	toBench: 'Naar de bank',

	noSubstitute: (lines: string) => `Geen wissel voor ${lines}.`,
	thinLead: 'Weinig getraind:',
	thinPlayer: (name: string, came: number, total: number) => `${name} ${came}/${total}`,

	formationLabel: 'Formatie',
	saveDefault: 'Bewaren',
	doneToMatch: 'Klaar — naar de wedstrijd',
	whoIsThere: 'Wie is er?',
	clear: 'Wissen',
	confirmClear: 'De standaardopstelling weggooien?',
	filled: (filled: number, needed: number) => `${filled} van de ${needed} ingevuld`,
	confirmIncomplete: (filled: number, needed: number) =>
		`Er staan er ${filled} op het veld in plaats van ${needed}. Toch doorgaan?`
} as const;

/** De setup-wizard: drie stappen om te beginnen. */
const setup = {
	title: 'Aan de slag',
	skip: 'Overslaan',
	step: (n: number) => `Stap ${n} van 3`,
	next: 'Verder',
	back: 'Terug',

	nameHeading: 'Hoe heet je team?',
	nameHint:
		'Die naam staat boven je wedstrijd en in het verslag dat je na afloop deelt. Iets als JO11-2, MO13-1 of gewoon de naam die iedereen gebruikt.',
	nameLabel: 'Teamnaam',
	namePlaceholder: 'bijv. JO11-2',

	squadHeading: 'Wie zitten erin?',
	squadHint:
		'Plak of typ de namen, één per regel. Alleen voornamen is genoeg. Ze blijven op dit toestel staan en gaan nergens anders heen.',
	namesPlaceholder: 'Sem\nNoah\nLuuk',
	already: (n: number) => `Je hebt er al ${n}.`,
	adding: (n: number) => `Hier komen er ${n} bij.`,
	filled: (n: number) => `${n} ${n === 1 ? 'naam' : 'namen'} ingevuld.`,
	laterIsFine: 'Later spelers toevoegen kan altijd.',

	playHeading: 'Hoe spelen jullie?',
	playHint:
		'Dit bepaalt hoeveel plekken er op het veld staan en hoe de klok loopt. Je kunt het later altijd omzetten; je opstelling verhuist dan mee.',

	doneHeading: 'Klaar',
	summary: (players: number, formation: string, parts: number, minutes: number) =>
		`${players} ${players === 1 ? 'speler' : 'spelers'}, ${formation} in ${parts === 4 ? 'vier kwarten' : 'twee helften'} van ${minutes} minuten.`,
	lineupHint:
		'Wil je nu meteen je vaste opstelling neerzetten? Dan begint elke wedstrijd daarmee en hoef je langs de lijn alleen nog te wisselen.',
	needName: 'Vul de naam van je team in.',
	needPlayer: 'Zet er minstens één speler in, anders valt er niets op te stellen.',
	makeLineup: 'Opstelling maken',
	later: 'Later'
} as const;

/** Gegevens: inloggen, synchroniseren, overzetten en back-up. */
const data = {
	title: 'Gegevens',

	syncHeading: 'Synchroniseren',
	signInHint:
		'Log in met je e-mailadres, dan staat je seizoen veilig en heb je het op al je toestellen. Je krijgt een code per mail; geen wachtwoord om te onthouden.',
	otherUserHeading: 'Van wie zijn deze gegevens?',
	otherUser: (vorige: string) =>
		`Op dit toestel staat nog het team van ${vorige}. Er gaat niets heen en weer zolang dit niet duidelijk is.`,
	otherUserKeep: 'Meenemen naar dit account',
	otherUserFresh: 'Schoon beginnen',
	otherUserFreshHint:
		'Schoon beginnen wist het team op dit toestel en haalt op wat bij dit account hoort. Staat het team hier nergens anders, dan is het weg — maak dan eerst een back-up bij Overzetten.',

	installFirstLead: 'Zet Blaadje eerst op je beginscherm',
	installFirst: 'en log daar in. Die app staat los van deze browser: log je hier in, dan ben je daar niet ingelogd.',
	localWarningLead: 'Let op:',
	localWarning: (host: string) =>
		`je draait dit op ${host}, en dat is een aparte opslag. Wil je inloggen voor je telefoon, doe dat dan op de echte site.`,
	emailLabel: 'E-mailadres',
	emailPlaceholder: 'jij@voorbeeld.nl',
	sendCode: 'Stuur inlog',
	/*
	 * Alleen een code, geen link.
	 *
	 * Een link opent de browser, en de app op je beginscherm staat daar los van:
	 * je zou inloggen in Safari terwijl je zaterdag de app gebruikt. Een code typ
	 * je in de app zelf, en dan klopt het altijd — waar je ook bent.
	 */
	codeHintBefore: 'Vul de',
	codeHintWord: 'code',
	codeHintAfter: 'uit de mail hieronder in. Je mag gerust even naar je mail-app; dit scherm staat er straks nog.',
	codeLabel: 'Code uit de mail',
	/* Geen aantal cijfers noemen: de lengte van de code is een instelling in
	   Supabase en staat er niet voor eeuwig hetzelfde. Een tekst die je moet
	   naschrijven zodra je daar iets aanpast, is een tekst die vanzelf onwaar
	   wordt. */
	codePlaceholder: '12345678',
	signIn: 'Inloggen',
	otherAddress: 'Ander adres',

	signedInAs: 'Ingelogd als',
	unknownEmail: 'onbekend',
	signedInHint:
		'De app werkt gewoon zonder bereik en stuurt vanzelf op zodra er weer internet is. Een wedstrijd die je klaarzet gaat mee, dus je stelt thuis op en pakt hem op het veld op je telefoon op. Een wedstrijd die al loopt wordt wel opgestuurd, maar nooit overschreven door een ander toestel.',
	statusConflict: 'Er staat iets nieuwers op de server.',
	statusOffline: 'Nog niet opgestuurd, geen verbinding.',
	statusPending: 'Nog niet opgestuurd.',
	statusUpdated: (when: string) => `Bijgewerkt ${when}.`,
	statusNever: 'Nog niets uitgewisseld.',
	pushNow: 'Nu opsturen',
	pull: 'Ophalen',
	signOut: 'Uitloggen',
	forcePush: 'Toch dit toestel opsturen',

	/* ---------- wie kan erbij ---------- */
	teamHeading: 'Wie kan hierbij',
	teamHint:
		'Nodig een tweede trainer uit met het adres waarmee hij inlogt. Hij ziet dan alles wat jij ziet: spelers, trainingen en archief. Alleen jij kunt mensen toevoegen of eruit halen.',
	teamOnlyOwner: 'Alleen de eigenaar kan hier iemand bij zetten.',
	roleOwner: 'eigenaar',
	roleTrainer: 'trainer',
	you: 'jij',
	memberUnknown: 'adres onbekend',
	inviteLabel: 'E-mailadres',
	invitePlaceholder: 'naam@voorbeeld.nl',
	invite: 'Uitnodigen',
	invitePending: (email: string) => `${email} · nog niet ingelogd`,
	withdraw: 'Intrekken',
	tellHim: 'Uitleg delen',
	tellHimHint: 'Hij ziet de uitnodiging pas als hij inlogt, dus laat het hem even weten.',
	tellHimShared: 'Doorgestuurd.',
	tellHimCopied: 'De uitleg staat op je klembord. Plak hem in een bericht aan',
	tellHimSelf: 'Kopieer deze tekst en stuur hem naar',
	inviteTitle: (team: string) => `Blaadje voor ${team}`,
	inviteText: (team: string, adres: string) =>
		[
			`Ik heb je toegevoegd aan ${team} in Blaadje, de app waarmee ik de wedstrijden bijhoud.`,
			'',
			'Zo kom je erin:',
			'',
			'1. Ga naar https://blaadje.app en open de app.',
			`2. Log in met dit adres: ${adres}. Je krijgt een code per mail.`,
			'3. Ga naar Gegevens. Daar staat dat je bent uitgenodigd; druk op Aannemen.',
			'',
			'Zet hem daarna op je beginscherm, dan werkt hij ook zonder bereik.'
		].join('\n'),
	removeMember: 'Eruit halen',
	confirmRemoveMember: 'Deze trainer er weer uit halen?\n\nHij komt dan niet meer bij dit team.',

	invitedHeading: 'Je bent uitgenodigd',
	invitedFor: (naam: string) => `${naam} heeft je gevraagd om mee te kijken.`,
	acceptInvite: 'Aannemen',

	chooseTeamHeading: 'Welk team volgt dit toestel',
	chooseTeamHint:
		'Alles wat je hier bijhoudt gaat naar het team dat aanstaat. Wissel je, dan wordt wat er nu in de app staat vervangen door dat van het andere team — stuur dus eerst op wat er nog klaarstaat.',
	chooseTeam: (naam: string) => `Overstappen naar ${naam}`,
	currentTeam: (naam: string) => `${naam} · staat aan`,
	confirmChooseTeam: (naam: string) =>
		`Dit toestel op ${naam} zetten?\n\nDe selectie, trainingen en het archief die nu in de app staan worden vervangen door die van ${naam}.`,
	firstPullHeading: 'Nog niet opgehaald',
	newTeam: 'Nieuw team',
	askNewTeam: 'Hoe heet het nieuwe team?',
	confirmNewTeam: (huidig: string) =>
		`Een nieuw team beginnen?\n\nWat er nu in de app staat hoort bij ${huidig} en blijft daar. Dit toestel begint leeg voor het nieuwe team.`,

	transferHeading: 'Overzetten en back-up',
	onlyHereLead: 'Alles staat alleen op dit toestel.',
	onlyHere:
		'Raakt het kwijt of gaat het stuk, dan is je seizoen weg. Maak af en toe een back-up, of log hierboven in en het gaat vanzelf.',
	transferHint:
		'Alles wat de app onthoudt: selectie, standaardopstelling, trainingen en het hele archief. Als bestand om te bewaren, of als code om op je andere toestel in te voeren. Een wedstrijd die nu loopt gaat nooit mee.',
	saveFile: 'Bestand opslaan',
	openFile: 'Bestand openen',
	makeCode: 'Code maken',
	enter: 'Invoeren',
	savedAndCopied: 'Opgeslagen als bestand, en gekopieerd.',
	copiedBefore: 'Gekopieerd. Stuur hem naar je andere toestel en tik daar op',
	copiedAfter: '.',
	pasteHint: 'Plak hier een code of de inhoud van een bestand; allebei werkt.',
	pastePlaceholder: 'Plak de code of de back-up',
	adopt: 'Overnemen',
	confirmAdopt: (what: string) =>
		`Dit overnemen op dit toestel?\n\n${what}.\n\nWat hierin zit vervangt wat je nu hebt. Een wedstrijd die nu loopt blijft staan.`,
	confirmRestore: (what: string) =>
		`Dit terugzetten op dit toestel?\n\n${what}.\n\nWat hierin zit vervangt wat je nu hebt. Een wedstrijd die nu loopt blijft staan.`,
	adopted: 'Overgenomen.',
	restored: 'Teruggezet.',
	unreadable: (why: string) => `Dit kon ik niet lezen: ${why}`,
	unreadableFile: (why: string) => `Dit bestand kon ik niet lezen: ${why}`,

	mayCleanLead: 'Deze browser mag je gegevens opruimen',
	mayClean: 'als hij plaats nodig heeft. Zet de app op je beginscherm en log in, of maak af en toe een back-up.',

	issuesHeading: 'Wat er misging',
	issuesHint:
		'De app gaat door als er iets hapert — een volle opslag mag de klok niet stoppen. Maar dan moet je het achteraf wel kunnen zien. Dit blijft op je toestel.',
	clearIssues: 'Lijst wissen',
	sendIssues: 'Stuur dit naar Tjaco',
	sendIssuesHint: 'Dit is precies wat er weggaat, en er staan geen namen van kinderen in. Versturen doe je zelf.',
	sendIssuesMail: 'Openen in mail',
	sendIssuesCopied: 'Gekopieerd. Lukt de mail niet, plak hem dan zelf in een bericht aan',
	sendIssuesSubject: 'Blaadje — wat er misging',
	closeIssues: 'Sluiten',

	footer: (versie: string) => `Blaadje ${versie} · het scherm blijft wakker zolang de klok loopt`
} as const;

/**
 * De uitleg om de app op je beginscherm te zetten.
 *
 * Een paar zinnen staan hier in stukken. Dat is geen slordigheid: in "Scrol naar
 * Zet op beginscherm" is dat middenstuk vet, want dat is precies het knopje dat
 * je moet zoeken. Vet kan niet in een tekst zonder opmaak, dus staat het als
 * eigen sleutel. De groepering laat zien dat het één zin is.
 */
const install = {
	heading: 'Op je beginscherm zetten',
	already: 'Blaadje staat al op je beginscherm. Dat is precies goed.',
	intro:
		'Blaadje is een website, geen download uit de App Store. Zet hem op je beginscherm en hij werkt als een gewone app: geen browserbalk meer, en het scherm blijft aan zolang de klok loopt.',
	movePrompt:
		'De app op je beginscherm begint leeg; wat hier staat gaat niet vanzelf mee. Maak eerst een code bij Gegevens, en voer die daar in. Of log op allebei in.',
	deviceIos: 'iPhone of iPad',
	deviceAndroid: 'Android',

	iosStep1: { before: 'Open', bold: 'blaadje.app', after: 'in Safari of Chrome.' },
	iosStep2:
		'Tik op de deelknop: het vierkantje met het pijltje omhoog. In Safari staat die onderin, in Chrome in de adresbalk.',
	iosStep3: { before: 'Scrol naar', bold: 'Zet op beginscherm', middle: 'en tik op', bold2: 'Voeg toe', after: '.' },

	androidOffer: 'Je browser kan het meteen doen:',
	androidButton: 'Op mijn beginscherm zetten',
	androidStep1: { before: 'Open', bold: 'blaadje.app', after: 'in Chrome.' },
	androidStep2: 'Tik rechtsboven op de drie puntjes.',
	androidStep3: {
		before: 'Kies',
		bold: 'App installeren',
		middle: 'of',
		bold2: 'Toevoegen aan startscherm',
		after: '.'
	}
} as const;

/**
 * De landingspagina.
 *
 * Dit is verkooptekst en geen interface, maar hij staat hier om dezelfde reden:
 * bij de vertaalslag zijn er ook hier Engelse woorden midden in de zinnen
 * beland. Wat één alinea is, staat als één sleutel — behalve waar er vet of een
 * link middenin zit; dat zijn de enige stukjes die opgeknipt zijn.
 */
const landing = {
	/* Ook in app.html, want een link die je in een groepsapp plakt moet meteen een
	   titel hebben. Twee plekken, dus bij een wijziging allebei aanpassen. */
	pageTitle: 'Blaadje — wedstrijdapp voor jeugdtrainers',
	pageDescription:
		'Je opstelling, je wissels en de speeltijd, bijgehouden terwijl je coacht. Werkt zonder bereik en zonder account, gewoon op je telefoon.',

	openShort: 'Openen',
	openLong: 'Blaadje openen',
	getStarted: 'Aan de slag',

	heroLine1: 'Het blaadje in je hand,',
	heroLine2: 'maar dan op je telefoon',
	heroLead:
		'Blaadje houdt je opstelling, je wissels en de speeltijd bij terwijl jij coacht. Een wissel kost twee tikken, en na afloop weet je precies wie hoe lang heeft gespeeld.',
	heroSmall: 'Gratis proberen · geen account nodig · werkt zonder bereik',

	shotMatchAlt: 'Het wedstrijdscherm met de opstelling op een veld en de bank ernaast',
	shotPlayersAlt: 'Het spelersoverzicht met speeltijd en presentie per speler',
	shotPlayersCaption:
		'Na een paar weken staat het allemaal in één lijst: gespeelde minuten per speler, en hoe vaak ze op de training waren.',

	blocks: {
		substitutions: {
			heading: 'Wisselen in twee tikken',
			body: 'Tik wie eruit gaat, tik wie erin komt. De bank staat naast het veld, in dezelfde volgorde als de linies, en bovenaan staat wie tot nu toe het minst heeft gespeeld. Twee spelers van plek laten ruilen kan ook, zonder dat er iemand van de bank hoeft te komen.'
		},
		playingTime: {
			heading: 'Speeltijd zonder invoeren',
			body: 'De minuten volgen uit je wissels, dus je hoeft niets bij te houden. Onder elke naam op het veld staat de speeltijd tot nu toe. Minuten in het doel tellen apart, want een helft keepen is geen halve wedstrijd voetballen.'
		},
		parts: {
			heading: 'Helften of kwarten',
			body: 'Van 11 tegen 11 tot 4 tegen 4, in twee helften of in vier kwarten. Het aantal spelers ligt nergens vast, dus bij de kleinsten werkt het net zo goed als bij de grote elftallen.'
		},
		attendance: {
			heading: 'Presentie op de training',
			body: 'Aanwezig, afgemeld of niet gekomen: één tik per speler. Wie de laatste keren weinig kwam, zie je terug op het moment dat je je opstelling maakt. De app zet het er alleen bij; wat je ermee doet is aan jou.'
		},
		report: {
			heading: 'Een verslagje voor de groepsapp',
			body: 'Na afloop ligt er een kant-en-klaar bericht: de uitslag, wie er scoorden, en de paar regels die je er zelf bij schrijft. De wissels blijven eruit, want daar hoeven de ouders niets van te vinden.'
		},
		touchline: {
			heading: 'Langs de lijn, niet achter een bureau',
			body: 'Het scherm blijft aan zolang de klok loopt, je hoeft nergens te scrollen, en zonder bereik gaat alles gewoon door. Wat je invult blijft op je eigen telefoon staan.'
		}
	},

	privacyHeading: 'Waar je gegevens blijven',
	privacy1:
		'Alles staat op je eigen toestel. Inloggen hoeft niet, en zolang jij dat niet wilt gaat er niets naar een server. Neem je wel een account, dan gaan je gegevens over een beveiligde verbinding en bepaal jij wie erbij kan.',
	privacyShare:
		'Deel je je team met een tweede trainer, dan ziet hij alles wat jij ziet: de spelers, de trainingen en het archief. Jullie zien ook elkaars e-mailadres, zodat iedereen kan nagaan wie er bij de gegevens van die kinderen kan. Uitnodigen gaat op adres en niet met een deelbare code, en je kunt iemand er ook weer uit halen.',
	privacy2:
		'Namen van kinderen zijn geen bijzaak. Daarom bewaart Blaadje alleen wat het echt nodig heeft: een voornaam, een linie, en de minuten die uit je wissels volgen. Geen beoordelingen, geen dossier.',
	privacy3: {
		bold: 'Daar zit ook een keerzijde aan.',
		after:
			'Staat je seizoen alleen op je telefoon, dan is het weg zodra die telefoon weg is: gestolen, in het water, of een browser die opruimt omdat je een tijd niet hebt gekeken. Maak dus af en toe een back-up — dat is één knop en één bestand — of neem een account, dan gebeurt het vanzelf.'
	},

	priceHeading: 'Wat het kost',
	price1:
		'Zonder account is Blaadje gratis, en dat blijft zo. Alles werkt: opstellen, wisselen, speeltijd, presentie, het archief. Het enige wat je mist is een vangnet, want alles staat alleen op dat ene toestel. Zo kun je een paar wedstrijden uitproberen zonder ergens aan vast te zitten.',
	price2:
		"Wordt het je vaste gereedschap, dan wil je een account. Je seizoen staat dan veilig als je telefoon kwijtraakt, en je werkt op meer dan één toestel: thuis de opstelling maken, langs de lijn wisselen. Dat kost € 30 per seizoen, zo'n zeventig cent per speelweek.",
	price3:
		'Zolang Blaadje in ontwikkeling is hoeft dat nog helemaal niet. Wie er nu bij komt, gebruikt dit seizoen alles gratis.',
	price4: {
		before:
			'Clubs kunnen het in één keer voor al hun jeugdtrainers regelen. Eén factuur, en de trainers hoeven zelf niets te doen. Neem contact op via',
		after: '.'
	},

	originHeading: 'Waar het vandaan komt',
	origin1:
		'Blaadje is gemaakt door een ouder-trainer voor zijn eigen O14. Alles wat er al was bleek een tactiekbord, terwijl je langs de lijn juist een wisselschriftje nodig hebt. Het wordt elke week bij een echte wedstrijd gebruikt, en dat verklaart waarom het doet wat het doet en niet meer dan dat.',
	origin2: {
		before:
			'Het is nog volop in ontwikkeling en op dit moment gratis te gebruiken. Loop je ergens tegenaan of mis je iets, mail dan naar',
		after: '. Ik lees alles.'
	},

	email: 'tjaco@blaadje.app',
	footerBefore: 'Blaadje · gemaakt in Nederland ·',
	footerLink: 'naar de app',
	footerDot: '·'
} as const;

export const text = {
	common,
	attendance,
	afterMatch,
	trainings,
	team,
	match,
	shell,
	errorPage,
	home,
	archivedMatch,
	season,
	players,
	lineupScreen,
	setup,
	data,
	install,
	landing
} as const;
