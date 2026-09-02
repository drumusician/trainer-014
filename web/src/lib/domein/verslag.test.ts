import { describe, expect, it } from 'vitest';
import { verslagTekst } from './verslag';
import type { Speler } from './types';

const spelers: Speler[] = [{ id: 'p1', naam: 'Aad', linie: 'A' }, { id: 'p2', naam: 'Bram', linie: 'M' }];
const bron = {
	datum: '2026-09-06', tegenstander: 'Ajax', thuis: true, stand: [2, 1] as [number, number],
	formatie: '4-3-3', duur: 4200,
	gebeurtenissen: [
		{ type: 'wissel' as const, t: 1200, eruit: 'p1', erin: 'p2', plek: 'SP' },
		{ type: 'goal' as const, t: 900, speler: 'p1' },
		{ type: 'tegen' as const, t: 1800 },
		{ type: 'goal' as const, t: 3000, speler: null }
	]
};

describe('verslag', () => {
	it('laat de wissels weg en zet de stand op volgorde van de klok', () => {
		const tekst = verslagTekst(bron, spelers);
		expect(tekst).toContain('O14 – Ajax 2–1');
		expect(tekst).not.toContain('voor');
		expect(tekst.split('\n').slice(3)).toEqual([
			"15′  1–0  Aad",
			"30′  1–1  tegendoelpunt",
			"50′  2–1  doelpunt"
		]);
	});

	it('zet de wissels erbij als je dat wilt', () => {
		const tekst = verslagTekst(bron, spelers, true);
		expect(tekst).toContain('Bram voor Aad');
		expect(tekst.indexOf('15′')).toBeLessThan(tekst.indexOf('20′'));
	});

	it('draait de stand om bij een uitwedstrijd', () => {
		expect(verslagTekst({ ...bron, thuis: false }, spelers)).toContain('Ajax – O14 1–2');
	});
});
