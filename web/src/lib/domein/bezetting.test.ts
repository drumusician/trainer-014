import { describe, expect, it } from 'vitest';
import { bezetting, gedrang, tekort } from './bezetting';
import type { Speler } from './types';

/** De selectie zoals die op 4 september 2026 in de app stond. */
const selectie: Speler[] = [
	{ id: '1', naam: 'Casper', linie: 'M', keept: true },
	{ id: '2', naam: 'Maher', linie: 'V', keept: true },
	{ id: '3', naam: 'Daan', linie: 'V', keept: true },
	{ id: '4', naam: 'Max', linie: 'A' },
	{ id: '5', naam: 'Kasper', linie: 'M', keept: true },
	{ id: '6', naam: 'Mauro', linie: 'M' },
	{ id: '7', naam: 'Yassir', linie: 'A' },
	{ id: '8', naam: 'Zenith', linie: 'M' },
	{ id: '9', naam: 'Amir', linie: 'M' },
	{ id: '10', naam: 'Mirza', linie: 'V' },
	{ id: '11', naam: 'Simon', linie: 'A' },
	{ id: '12', naam: 'Alain', linie: 'A' },
	{ id: '13', naam: 'Daanish', linie: 'M' },
	{ id: '14', naam: 'Siem', linie: 'M' },
	{ id: '15', naam: 'Jack', linie: 'V' },
	{ id: '16', naam: 'Gijs', linie: 'V' }
];

describe('bezetting per linie', () => {
	it('telt spelers tegen plekken in 4-3-3', () => {
		const b = bezetting(selectie, '4-3-3');
		expect(b.map((x) => [x.naam, x.spelers, x.plekken])).toEqual([
			['Aanval', 4, 3],
			['Middenveld', 7, 3],
			['Verdediging', 5, 4],
			['Keeper', 4, 1]
		]);
	});

	it('ziet het gedrang op het middenveld, en dat 4-4-2 beter past', () => {
		const middenveld = (f: string) => bezetting(selectie, f).find((x) => x.linie === 'M')!;
		expect(gedrang(middenveld('4-3-3'))).toBe(true);
		expect(gedrang(middenveld('4-4-2'))).toBe(false);
	});

	it('waarschuwt als een linie niet vol te krijgen is', () => {
		const zonderVerdedigers = selectie.filter((p) => p.linie !== 'V');
		const b = bezetting(zonderVerdedigers, '4-3-3').find((x) => x.linie === 'V')!;
		expect(tekort(b)).toBe(true);
	});

	it('laat de keeper weg bij 4 tegen 4', () => {
		expect(bezetting(selectie, '2-2').map((x) => x.linie)).toEqual(['A', 'V']);
	});
});
