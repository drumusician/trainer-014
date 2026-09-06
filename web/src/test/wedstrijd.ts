/*
 * Gedeelde opzet voor de schermtests: een elftal en een wedstrijd die er
 * uitzien zoals ze op zaterdag ook zouden staan. Elk scherm dat je test begint
 * bij dezelfde ploeg, zodat de namen in de tests herkenbaar blijven.
 */
import { app } from '$lib/store.svelte';
import { emptyState, type Match, type Player } from '$lib/domain/types';

export const SPELERS: Player[] = [
	{ id: 'k1', name: 'Bram', line: '', keeper: true },
	{ id: 'v1', name: 'Cas', line: 'V' },
	{ id: 'v2', name: 'Dirk', line: 'V' },
	{ id: 'm1', name: 'Eef', line: 'M' },
	{ id: 'a1', name: 'Finn', line: 'A' },
	{ id: 'b1', name: 'Gijs', line: 'A' }
];

export const OPSTELLING = { K: 'k1', LV: 'v1', RV: 'v2', CM: 'm1', SP: 'a1' };

export function metSelectie(): void {
	app.toestand = emptyState();
	app.toestand.teamName = 'O14-3';
	app.toestand.players = SPELERS.map((p) => ({ ...p }));
	app.chosenPosition = null;
	app.nu = Date.now();
}

/** Een wedstrijd in de gevraagde staat. Zonder gebeurtenissen is er niet afgetrapt. */
export function metWedstrijd(overschrijf: Partial<Match> = {}): Match {
	metSelectie();
	app.toestand.match = {
		opponent: 'Kampong',
		home: true,
		date: '2026-09-07',
		formation: '1-2-1-1',
		lineup: { ...OPSTELLING },
		bench: ['b1'],
		absent: [],
		events: [],
		running: false,
		since: 0,
		elapsed: 0,
		part: 1,
		parts: 4,
		inBreak: false,
		finished: false,
		...overschrijf
	} as Match;
	return app.toestand.match as Match;
}

/** Afgetrapt en lopend, met de klok een aantal seconden onderweg. */
export function lopendeWedstrijd(seconden = 0, overschrijf: Partial<Match> = {}): Match {
	return metWedstrijd({
		events: [{ type: 'start', t: 0 }],
		running: true,
		since: Date.now() - seconden * 1000,
		...overschrijf
	});
}
