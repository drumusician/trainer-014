import { describe, expect, it } from 'vitest';
import { leesCode, maakCode } from './overzetten';

describe('overzetten', () => {
	const pakket = {
		v: 1 as const,
		spelers: [{ id: 'p1', naam: 'Daanish', linie: 'M' as const }, { id: 'p2', naam: 'Zoë', linie: '' as const, keept: true }],
		formatie: '4-3-3',
		helftMinuten: 35,
		standaard: null
	};

	it('overleeft de reis heen en terug, ook met accenten', () => {
		expect(leesCode(maakCode(pakket))).toEqual(pakket);
	});

	it('klaagt over een code zonder selectie', () => {
		expect(() => leesCode(maakCode({ ...pakket, spelers: [] }))).toThrow();
		expect(() => leesCode('geen geldige code')).toThrow();
	});
});
