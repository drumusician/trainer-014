import { describe, expect, it } from 'vitest';
import { aantalPlekken, alleFormaties, FORMATIES, liniesIn, plekken, SPEELVORMEN, speelvormVan } from './formaties';

describe('formaties', () => {
	it('heeft precies zoveel plekken als de speelvorm zegt', () => {
		const verwacht: Record<string, number> = {
			'11 tegen 11': 11,
			'8 tegen 8': 8,
			'6 tegen 6': 6,
			'4 tegen 4': 4
		};
		SPEELVORMEN.forEach((s) =>
			s.formaties.forEach((f) => expect(aantalPlekken(f.sleutel), f.sleutel).toBe(verwacht[s.naam]))
		);
	});

	it('kent elke formatie uit het menu, en geen enkele blijft ongenoemd', () => {
		const inMenu = alleFormaties();
		expect(new Set(inMenu).size).toBe(inMenu.length);
		expect([...inMenu].sort()).toEqual(Object.keys(FORMATIES).sort());
	});

	it('geeft elke plek een eigen id', () => {
		Object.entries(FORMATIES).forEach(([naam, lijst]) => {
			const ids = lijst.map((p) => p[0]);
			expect(new Set(ids).size, naam).toBe(ids.length);
		});
	});

	it('zet iedereen binnen het veld', () => {
		Object.entries(FORMATIES).forEach(([naam, lijst]) =>
			lijst.forEach(([id, , x, y]) => {
				expect(x, naam + ' ' + id).toBeGreaterThanOrEqual(10);
				expect(x, naam + ' ' + id).toBeLessThanOrEqual(90);
				expect(y, naam + ' ' + id).toBeGreaterThanOrEqual(10);
				expect(y, naam + ' ' + id).toBeLessThanOrEqual(95);
			})
		);
	});

	it('heeft een keeper, behalve bij 4 tegen 4', () => {
		SPEELVORMEN.forEach((s) =>
			s.formaties.forEach(({ sleutel }) => {
				const heeftKeeper = plekken(sleutel).some((p) => p[4] === 'K');
				expect(heeftKeeper, sleutel).toBe(s.naam !== '4 tegen 4');
				expect(liniesIn(sleutel).includes('K'), sleutel).toBe(s.naam !== '4 tegen 4');
			})
		);
	});

	it('weet bij welke speelvorm een formatie hoort', () => {
		expect(speelvormVan('1-3-3-1')).toBe('8 tegen 8');
		expect(speelvormVan('1-2-2-1')).toBe('6 tegen 6');
		expect(speelvormVan('4-3-3')).toBe('11 tegen 11');
		expect(speelvormVan('bestaat-niet')).toBe('');
	});
});
