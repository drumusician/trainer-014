import { describe, expect, it } from 'vitest';
import { positionCount, alleFormaties, FORMATIONS, linesIn, positionsOf, FORMATS, formatOf } from './formations';

describe('formaties', () => {
	it('heeft precies zoveel plekken als de speelvorm zegt', () => {
		const verwacht: Record<string, number> = {
			'11 tegen 11': 11,
			'8 tegen 8': 8,
			'6 tegen 6': 6,
			'4 tegen 4': 4
		};
		FORMATS.forEach((s) =>
			s.formaties.forEach((f) => expect(positionCount(f.sleutel), f.sleutel).toBe(verwacht[s.name]))
		);
	});

	it('kent elke formatie uit het menu, en geen enkele blijft ongenoemd', () => {
		const inMenu = alleFormaties();
		expect(new Set(inMenu).size).toBe(inMenu.length);
		expect([...inMenu].sort()).toEqual(Object.keys(FORMATIONS).sort());
	});

	it('geeft elke plek een eigen id', () => {
		Object.entries(FORMATIONS).forEach(([name, lijst]) => {
			const ids = lijst.map((p) => p[0]);
			expect(new Set(ids).size, name).toBe(ids.length);
		});
	});

	it('zet iedereen binnen het veld', () => {
		Object.entries(FORMATIONS).forEach(([name, lijst]) =>
			lijst.forEach(([id, , x, y]) => {
				expect(x, name + ' ' + id).toBeGreaterThanOrEqual(10);
				expect(x, name + ' ' + id).toBeLessThanOrEqual(90);
				expect(y, name + ' ' + id).toBeGreaterThanOrEqual(10);
				expect(y, name + ' ' + id).toBeLessThanOrEqual(95);
			})
		);
	});

	it('heeft een keeper, behalve bij 4 tegen 4', () => {
		FORMATS.forEach((s) =>
			s.formaties.forEach(({ sleutel }) => {
				const heeftKeeper = positionsOf(sleutel).some((p) => p[4] === 'K');
				expect(heeftKeeper, sleutel).toBe(s.name !== '4 tegen 4');
				expect(linesIn(sleutel).includes('K'), sleutel).toBe(s.name !== '4 tegen 4');
			})
		);
	});

	it('weet bij welke speelvorm een formatie hoort', () => {
		expect(formatOf('4-4-2 diamond')).toBe('11 tegen 11');
		expect(formatOf('1-3-3-1')).toBe('8 tegen 8');
		expect(formatOf('1-2-2-1')).toBe('6 tegen 6');
		expect(formatOf('4-3-3')).toBe('11 tegen 11');
		expect(formatOf('bestaat-niet')).toBe('');
	});
});
