/**
 * Bringing older storage up to the current format.
 *
 * The field names in storage used to be Dutch. They sit in every user's
 * localStorage, in the Supabase column, and in every backup file anyone ever
 * exported. That last one is why this code can never be removed: a backup made
 * today must still open three seasons from now.
 *
 * The conversion runs one way. What comes in is converted; what we store is
 * English from here on. So there is no layer translating back and forth on every
 * save — that would be a second place where things can go wrong.
 *
 * We recognise the old format by the fields themselves rather than a version
 * number, because the files already out there do not carry one.
 */

/** Field names, grouped by kind of object. Anything absent stays as it is. */
const VELDEN: Record<string, string> = {
	/* the state as a whole */
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

/** Event kinds: those are stored as text. */
const GEBEURTENISSEN: Record<string, string> = {
	rust: 'break',
	eind: 'end',
	tegen: 'conceded',
	wissel: 'substitution',
	ruil: 'swap'
};

/** Attendance at a training session. */
const AANWEZIGHEID: Record<string, string> = {
	ja: 'present',
	af: 'excused',
	nee: 'absent'
};

/** The only position whose code was Dutch; the rest is football notation. */
const PLEKKEN: Record<string, string> = { TIEN: 'TEN' };

/** Formations with a Dutch word in them. */
const FORMATIES: Record<string, string> = { '4-4-2 ruit': '4-4-2 diamond' };

function nieuwePlek(position: string): string {
	return PLEKKEN[position] ?? position;
}

/** Is this still the old format? One unmistakable field is enough. */
export function isOudFormaat(d: unknown): boolean {
	if (!d || typeof d !== 'object') return false;
	const o = d as Record<string, unknown>;
	return 'spelers' in o || 'teamnaam' in o || 'archief' in o || 'verslagWissels' in o;
}

/**
 * Convert everything we come across.
 *
 * Walks the whole tree rather than working per type. That is deliberate: the
 * fields mean the same thing everywhere, and a per-type conversion sooner or
 * later forgets a place where the same object also appears.
 */
export function migreerOpslag(waarde: unknown, sleutel?: string): unknown {
	if (Array.isArray(waarde)) return waarde.map((x) => migreerOpslag(x, sleutel));

	if (waarde && typeof waarde === 'object') {
		const uit: Record<string, unknown> = {};
		for (const [k, v] of Object.entries(waarde as Record<string, unknown>)) {
			/* A lineup and the minutes played per position use position codes as keys,
			   not field names. */
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
		/* Attendance per player is keyed by that player's own id. */
		if (waarde in AANWEZIGHEID && (sleutel === 'status' || sleutel === undefined)) return AANWEZIGHEID[waarde];
	}

	return waarde;
}

/**
 * A session's attendance is stored as {playerId: 'ja'}, so the key is an id and
 * says nothing. Hence handled separately.
 */
export function migreerTrainingstatus(waarde: unknown): unknown {
	if (!waarde || typeof waarde !== 'object') return waarde;
	const uit: Record<string, unknown> = {};
	for (const [k, v] of Object.entries(waarde as Record<string, unknown>)) {
		uit[k] = typeof v === 'string' ? (AANWEZIGHEID[v] ?? v) : v;
	}
	return uit;
}

/** Convert a whole stored state, sessions included. */
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
