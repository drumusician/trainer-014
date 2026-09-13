import { describe, expect, it } from 'vitest';
import { momentenVan } from './momenten';
import type { ArchivedMatch, Player } from './types';

/*
 * Terugkijken na een wedstrijd die iemand anders deed. De wissels staan er wel,
 * maar wie er begon niet — en dat is juist wat je als eerste wilt zien.
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

/* Eindigt met Mees op SP en Isa op CM; Gijs en Cas gingen eruit. */
const WEDSTRIJD: ArchivedMatch = {
	date: '2026-09-13',
	opponent: 'Buitenboys',
	home: true,
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

describe('de opstelling terugkijken', () => {
	it('rekent terug wie er begon, ook al is alleen het eind bewaard', () => {
		const momenten = momentenVan(WEDSTRIJD, SPELERS);
		expect(momenten[0].t).toBe(0);
		expect(momenten[0].lineup).toEqual({ K: 'k1', LV: 'v1', RV: 'v2', CM: 'm1', SP: 'a1' });
	});

	it('zet wie niet begon op de bank, en laat wie is afgemeld weg', () => {
		const momenten = momentenVan(WEDSTRIJD, SPELERS);
		expect(momenten[0].bench.sort()).toEqual(['b1', 'b2']);
		/* Siem was afgemeld: die stond niet op de bank */
		expect(momenten[0].bench).not.toContain('w1');
	});

	/* In de rust gaan er vier tegelijk; dan wil je niet vier keer tikken. */
	it('maakt van wissels op dezelfde seconde één moment', () => {
		const momenten = momentenVan(WEDSTRIJD, SPELERS);
		expect(momenten.map((m) => m.t)).toEqual([0, 1200, 1800]);
	});

	it('laat per moment zien hoe de opstelling er dan bij staat', () => {
		const momenten = momentenVan(WEDSTRIJD, SPELERS);
		expect(momenten[1].lineup).toEqual({ K: 'k1', LV: 'v1', RV: 'v2', CM: 'b2', SP: 'b1' });
		expect(momenten[2].lineup).toEqual(WEDSTRIJD.lineup);
	});

	it('benoemt elk moment met de woorden uit het verloop', () => {
		const momenten = momentenVan(WEDSTRIJD, SPELERS);
		expect(momenten[0].tekst).toBe('Aftrap');
		expect(momenten[1].tekst).toContain('Mees');
		expect(momenten[1].tekst).toContain('Luuk');
		expect(momenten[2].tekst).toContain('Cas');
	});

	/*
	 * Wedstrijden van voordat de eindopstelling meeging zijn niet terug te rekenen.
	 * Dan hoort er niets te staan, want iets verzinnen is erger dan niets tonen.
	 */
	it('geeft niets terug als de eindopstelling niet bewaard is', () => {
		expect(momentenVan({ ...WEDSTRIJD, lineup: undefined }, SPELERS)).toEqual([]);
		expect(momentenVan({ ...WEDSTRIJD, lineup: {} }, SPELERS)).toEqual([]);
	});
});
