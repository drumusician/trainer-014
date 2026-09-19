import { describe, expect, it } from 'vitest';
import { benchOverview } from './bench';
import type { ArchivedMatch, Player, Training } from './types';

/*
 * Bij het maken van de opstelling: wie zat er al veel op de bank? Het doel is
 * dat niet elke week dezelfde jongens op de bank beginnen.
 */
const SPELERS: Player[] = [
	{ id: 'k1', name: 'Bram', line: '', keeper: true },
	{ id: 'v1', name: 'Cas', line: 'V' },
	{ id: 'v2', name: 'Dirk', line: 'V' },
	{ id: 'm1', name: 'Gijs', line: 'M' },
	{ id: 'a1', name: 'Luuk', line: 'A' },
	{ id: 'b1', name: 'Mees', line: 'A' },
	{ id: 'b2', name: 'Isa', line: 'M' },
	{ id: 'w1', name: 'Siem', line: 'M' }
];

/* Mees en Isa beginnen op de bank en komen er na twintig minuten in. Siem is afgemeld. */
const WEDSTRIJD: ArchivedMatch = {
	date: '2026-09-13',
	opponent: 'Buitenboys',
	home: false,
	score: [1, 0],
	formation: '1-2-1-1',
	duration: 2400,
	parts: 2,
	absent: ['w1'],
	events: [
		{ type: 'start', t: 0 },
		{ type: 'substitution', t: 1200, position: 'SP', off: 'a1', on: 'b1' },
		{ type: 'substitution', t: 1200, position: 'CM', off: 'm1', on: 'b2' },
		{ type: 'substitution', t: 1800, position: 'LV', off: 'v1', on: 'a1' }
	] as never,
	lineup: { K: 'k1', LV: 'a1', RV: 'v2', CM: 'b2', SP: 'b1' },
	bench: ['m1', 'v1'],
	playingTime: [
		{ id: 'k1', name: 'Bram', seconds: 2400, keeper: 2400 },
		{ id: 'v1', name: 'Cas', seconds: 1800 },
		{ id: 'v2', name: 'Dirk', seconds: 2400 },
		{ id: 'm1', name: 'Gijs', seconds: 1200 },
		{ id: 'a1', name: 'Luuk', seconds: 1800 },
		{ id: 'b1', name: 'Mees', seconds: 1200 },
		{ id: 'b2', name: 'Isa', seconds: 1200 },
		{ id: 'w1', name: 'Siem', seconds: 0 }
	] as never
};

const TRAININGEN: Training[] = [
	{ id: 't2', date: '2026-09-18', status: { b1: 'present', w1: 'absent' } },
	{ id: 't1', date: '2026-09-11', status: { b1: 'excused', w1: 'present' } }
];

const rij = (rijen: ReturnType<typeof benchOverview>, id: string) => rijen.find((r) => r.id === id)!;

describe('wie zat er op de bank', () => {
	it('telt de minuten op de bank en of hij daar begon', () => {
		const rijen = benchOverview(SPELERS, [WEDSTRIJD], []);
		expect(rij(rijen, 'b1')).toMatchObject({ matches: 1, benchSeconds: 1200, startedOnBench: 1, startsKnown: 1 });
		/* Gijs begon wel, maar ging er na twintig minuten uit */
		expect(rij(rijen, 'm1')).toMatchObject({ benchSeconds: 1200, startedOnBench: 0, startsKnown: 1 });
		expect(rij(rijen, 'k1')).toMatchObject({ benchSeconds: 0, startedOnBench: 0 });
	});

	/* Afgemeld is geen bankzitten: anders staat wie ziek was bovenaan. */
	it('telt een wedstrijd waarbij hij er niet was niet mee', () => {
		expect(rij(benchOverview(SPELERS, [WEDSTRIJD], []), 'w1')).toMatchObject({
			matches: 0,
			benchSeconds: 0,
			startsKnown: 0
		});
	});

	it('telt over meer wedstrijden op', () => {
		const rijen = benchOverview(SPELERS, [WEDSTRIJD, { ...WEDSTRIJD, date: '2026-09-06' }], []);
		expect(rij(rijen, 'b2')).toMatchObject({ matches: 2, benchSeconds: 2400, startedOnBench: 2, startsKnown: 2 });
	});

	it('zet wie het meest op de bank zat bovenaan', () => {
		const rijen = benchOverview(SPELERS, [WEDSTRIJD], []);
		/* Isa, Mees en Gijs twintig minuten; wie op de bank begon eerst, dan op naam */
		expect(rijen.slice(0, 3).map((r) => r.name)).toEqual(['Isa', 'Mees', 'Gijs']);
	});

	/* Zonder bewaarde eindopstelling is niet terug te rekenen wie er begon. De
	   bankminuten kloppen dan nog wel, dus die tellen gewoon. */
	it('gokt niet wie er begon bij een wedstrijd zonder opstelling', () => {
		const oud = { ...WEDSTRIJD, lineup: undefined, bench: undefined };
		expect(rij(benchOverview(SPELERS, [oud], []), 'b1')).toMatchObject({
			matches: 1,
			benchSeconds: 1200,
			startedOnBench: 0,
			startsKnown: 0
		});
	});

	it('zet de trainingsopkomst van het hele seizoen erbij', () => {
		const rijen = benchOverview(SPELERS, [], TRAININGEN);
		expect(rij(rijen, 'b1').attendance).toEqual({ er: 1, totaal: 2 });
		expect(rij(rijen, 'w1').attendance).toEqual({ er: 1, totaal: 2 });
		expect(rij(rijen, 'k1').attendance).toEqual({ er: 0, totaal: 0 });
	});

	it('geeft precies één regel per speler uit de selectie', () => {
		const rijen = benchOverview(SPELERS, [WEDSTRIJD], []);
		expect(rijen).toHaveLength(SPELERS.length);
	});
});
