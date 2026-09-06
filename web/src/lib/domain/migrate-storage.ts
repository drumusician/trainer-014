/**
 * Oude opslag naar het nieuwe formaat brengen.
 *
 * De veldnamen in de opslag waren Nederlands. Ze staan in de localStorage van
 * elke gebruiker, in de kolom van Supabase, en in elk back-upbestand dat iemand
 * ooit heeft geëxporteerd. Dat laatste is de reden dat deze code nooit meer weg
 * kan: een back-up van vandaag moet over drie seizoenen nog te openen zijn.
 *
 * De omzetting is eenrichtingsverkeer. Wat binnenkomt wordt omgezet; wat we
 * opslaan is voortaan Engels. Er is dus geen laag die bij elk opslaan heen en
 * weer vertaalt — dat zou een tweede plek zijn waar het mis kan gaan.
 *
 * Herkennen doen we aan de velden zelf en niet aan een versienummer, want de
 * bestanden die er al zijn hebben dat nummer niet.
 */

/** Veldnamen, per soort object. Wat er niet in staat blijft zoals het is. */
const VELDEN: Record<string, string> = {
	/* de toestand als geheel */
	teamnaam: 'teamName',
	spelers: 'players',
	formatie: 'formation',
	helftMinuten: 'minutesPerPart',
	delen: 'parts',
	wedstrijd: 'match',
	standaard: 'defaultLineup',
	archief: 'archive',
	trainingen: 'trainings',
	verslagWissels: 'reportSubs',

	/* speler */
	naam: 'name',
	linie: 'line',
	keept: 'keeper',

	/* wedstrijd */
	datum: 'date',
	tegenstander: 'opponent',
	thuis: 'home',
	opstelling: 'lineup',
	bank: 'bench',
	gebeurtenissen: 'events',
	verstreken: 'elapsed',
	sinds: 'since',
	loopt: 'running',
	deel: 'part',
	pauze: 'inBreak',
	afgelopen: 'finished',
	notitie: 'note',
	bewaard: 'archived',
	afwezig: 'absent',

	/* gebeurtenis */
	speler: 'player',
	eruit: 'off',
	erin: 'on',
	plek: 'position',
	plekA: 'positionA',
	plekB: 'positionB',
	spelerA: 'playerA',
	spelerB: 'playerB',

	/* bewaarde wedstrijd */
	stand: 'score',
	duur: 'duration',
	namen: 'names',
	speeltijd: 'playingTime',
	seconden: 'seconds',
	posities: 'positions',

	/* logboekje van problemen */
	wanneer: 'when',
	wat: 'what',
	message: 'message'
};

/** Soorten gebeurtenissen: die staan als tekst in de opslag. */
const GEBEURTENISSEN: Record<string, string> = {
	rust: 'break',
	eind: 'end',
	tegen: 'conceded',
	wissel: 'substitution',
	ruil: 'swap'
};

/** Aanwezigheid op een training. */
const AANWEZIGHEID: Record<string, string> = {
	ja: 'present',
	af: 'excused',
	nee: 'absent'
};

/** De enige plek waarvan de code Nederlands was; de rest is voetbalnotatie. */
const PLEKKEN: Record<string, string> = { TIEN: 'TEN' };

/** Formaties met een Nederlands woord erin. */
const FORMATIES: Record<string, string> = { '4-4-2 ruit': '4-4-2 diamond' };

function nieuwePlek(position: string): string {
	return PLEKKEN[position] ?? position;
}

/** Is dit nog het oude formaat? Eén onmiskenbaar veld is genoeg. */
export function isOudFormaat(d: unknown): boolean {
	if (!d || typeof d !== 'object') return false;
	const o = d as Record<string, unknown>;
	return 'spelers' in o || 'teamnaam' in o || 'archief' in o || 'verslagWissels' in o;
}

/**
 * Alles omzetten wat we tegenkomen.
 *
 * Loopt door de hele boom in plaats van per type te werken. Dat is met opzet:
 * de velden hebben overal dezelfde betekenis, en een omzetting die per type
 * werkt vergeet vroeg of laat een plek waar hetzelfde object ook staat.
 */
export function migreerOpslag(waarde: unknown, sleutel?: string): unknown {
	if (Array.isArray(waarde)) return waarde.map((x) => migreerOpslag(x, sleutel));

	if (waarde && typeof waarde === 'object') {
		const uit: Record<string, unknown> = {};
		for (const [k, v] of Object.entries(waarde as Record<string, unknown>)) {
			/* Een opstelling en de gespeelde minuten per plek hebben plekcodes als
			   sleutel, geen veldnamen. */
			const opPlek = sleutel === 'lineup' || sleutel === 'positions';
			const nieuweSleutel = opPlek ? nieuwePlek(k) : (VELDEN[k] ?? k);
			uit[nieuweSleutel] = migreerOpslag(v, nieuweSleutel);
		}
		return uit;
	}

	if (typeof waarde === 'string') {
		if (sleutel === 'type') return GEBEURTENISSEN[waarde] ?? waarde;
		if (sleutel === 'formation') return FORMATIES[waarde] ?? waarde;
		if (sleutel === 'position' || sleutel === 'positionA' || sleutel === 'positionB') return nieuwePlek(waarde);
		/* De status per speler op een training staat onder zijn eigen id. */
		if (waarde in AANWEZIGHEID && (sleutel === 'status' || sleutel === undefined)) return AANWEZIGHEID[waarde];
	}

	return waarde;
}

/**
 * De status van een training staat als {spelerId: 'ja'} in de opslag, dus de
 * sleutel is een id en zegt niets. Daarom apart.
 */
export function migreerTrainingstatus(waarde: unknown): unknown {
	if (!waarde || typeof waarde !== 'object') return waarde;
	const uit: Record<string, unknown> = {};
	for (const [k, v] of Object.entries(waarde as Record<string, unknown>)) {
		uit[k] = typeof v === 'string' ? (AANWEZIGHEID[v] ?? v) : v;
	}
	return uit;
}

/** Een hele bewaarde toestand omzetten, met de trainingen erbij. */
export function migreerToestand(d: unknown): unknown {
	if (!isOudFormaat(d)) return d;
	const uit = migreerOpslag(d) as Record<string, unknown>;
	if (Array.isArray(uit.trainings)) {
		uit.trainings = uit.trainings.map((t) => {
			const training = t as Record<string, unknown>;
			return { ...training, status: migreerTrainingstatus(training.status) };
		});
	}
	return uit;
}
