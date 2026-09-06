import { describe, expect, it } from 'vitest';
import { bezetting, dunneKeepersbezetting, gedrang, tekort } from './coverage';
import { groupOf, canKeep } from './formations';
import type { Player } from './types';

/** The squad exactly as it stood in the app on 4 September 2026. */
const selectie: Player[] = [
	{ id: '1', name: 'Casper', line: 'M', keeper: true },
	{ id: '2', name: 'Maher', line: 'V', keeper: true },
	{ id: '3', name: 'Daan', line: 'V', keeper: true },
	{ id: '4', name: 'Max', line: 'A' },
	{ id: '5', name: 'Kasper', line: 'M', keeper: true },
	{ id: '6', name: 'Mauro', line: 'M' },
	{ id: '7', name: 'Yassir', line: 'A' },
	{ id: '8', name: 'Zenith', line: 'M' },
	{ id: '9', name: 'Amir', line: 'M' },
	{ id: '10', name: 'Mirza', line: 'V' },
	{ id: '11', name: 'Simon', line: 'A' },
	{ id: '12', name: 'Alain', line: 'A' },
	{ id: '13', name: 'Daanish', line: 'M' },
	{ id: '14', name: 'Siem', line: 'M' },
	{ id: '15', name: 'Jack', line: 'V' },
	{ id: '16', name: 'Gijs', line: 'V' }
];

describe('bezetting per linie', () => {
	it('telt spelers tegen plekken in 4-3-3', () => {
		const b = bezetting(selectie, '4-3-3');
		expect(b.map((x) => [x.name, x.players, x.positionsOf])).toEqual([
			['Aanval', 4, 3],
			['Middenveld', 7, 3],
			['Verdediging', 5, 4],
			['Keeper', 4, 1]
		]);
	});

	it('ziet het gedrang op het middenveld, en dat 4-4-2 beter past', () => {
		const middenveld = (f: string) => bezetting(selectie, f).find((x) => x.line === 'M')!;
		expect(gedrang(middenveld('4-3-3'))).toBe(true);
		expect(gedrang(middenveld('4-4-2'))).toBe(false);
	});

	it('waarschuwt als een linie niet vol te krijgen is', () => {
		const zonderVerdedigers = selectie.filter((p) => p.line !== 'V');
		const b = bezetting(zonderVerdedigers, '4-3-3').find((x) => x.line === 'V')!;
		expect(tekort(b)).toBe(true);
	});

	it('ziet vier keepers niet als gedrang, want keepen is een kunnen', () => {
		const keeper = bezetting(selectie, '4-3-3').find((x) => x.line === 'K')!;
		expect(keeper.players).toBe(4);
		expect(gedrang(keeper)).toBe(false);
		expect(tekort(keeper)).toBe(false);
	});

	it('merkt op als er maar één kan keepen', () => {
		const een = selectie.map((p) => ({ ...p, keeper: p.name === 'Maher' }));
		expect(dunneKeepersbezetting(bezetting(een, '4-3-3'))).toBe(true);
		expect(dunneKeepersbezetting(bezetting(selectie, '4-3-3'))).toBe(false);
	});

	it('laat de keeper weg bij 4 tegen 4', () => {
		expect(bezetting(selectie, '2-2').map((x) => x.line)).toEqual(['A', 'V']);
	});
});

describe('iemand die alleen keeper is', () => {
	const alleenKeeper: Player = { id: '99', name: 'Vaste keeper', line: '', keeper: true };
	const metVaste = [...selectie, alleenKeeper];

	it('telt alleen mee bij de keepers, niet in een veldlinie', () => {
		const b = bezetting(metVaste, '4-3-3');
		expect(b.find((x) => x.line === 'K')!.players).toBe(5);
		expect(b.find((x) => x.line === 'V')!.players).toBe(5); /* onveranderd */
		expect(b.find((x) => x.line === 'M')!.players).toBe(7);
		expect(b.find((x) => x.line === 'A')!.players).toBe(4);
	});

	it('staat op de bank in het keepersgroepje', () => {
		expect(groupOf(alleenKeeper)).toBe('K');
	});

	it('licht op bij de keeperplek en niet bij een veldplek', () => {
		expect(canKeep(alleenKeeper)).toBe(true);
		expect(alleenKeeper.line).toBe(''); /* so no field line claims him */
	});

	it('valt zonder K-vinkje in "zonder linie", niet stilletjes ergens anders', () => {
		expect(groupOf({ id: 'x', name: 'Nieuw', line: '' })).toBe('');
	});
});
