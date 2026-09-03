import { describe, expect, it } from 'vitest';
import { percentage, sorteer, spelersOverzicht } from './spelers';
import type { ArchiefWedstrijd, Speler, Training } from './types';

const spelers: Speler[] = [
	{ id: 'p1', naam: 'Daanish', linie: 'M' },
	{ id: 'p2', naam: 'Gijs', linie: '', keept: true },
	{ id: 'p3', naam: 'Nieuw', linie: 'A' }
];

const archief: ArchiefWedstrijd[] = [
	{
		datum: '2026-08-30', tegenstander: 'Ajax', thuis: true, stand: [1, 0], formatie: '4-3-3', duur: 4200,
		namen: { p1: 'Daanish', p2: 'Gijs' },
		gebeurtenissen: [{ type: 'goal', t: 900, speler: 'p1' }],
		speeltijd: [
			{ id: 'p1', naam: 'Daanish', seconden: 4200, keeper: 0 },
			{ id: 'p2', naam: 'Gijs', seconden: 2100, keeper: 2100 }
		]
	}
];

const trainingen: Training[] = [
	{ id: 't1', datum: '2026-09-02', status: { p1: 'ja', p2: 'nee' } },
	{ id: 't2', datum: '2026-08-26', status: { p1: 'ja', p2: 'ja' } }
];

describe('spelersoverzicht', () => {
	it('zet minuten, doelpunten en presentie op één regel', () => {
		const rijen = spelersOverzicht(spelers, archief, trainingen);
		const daanish = rijen.find((r) => r.naam === 'Daanish')!;
		expect(daanish).toMatchObject({ seconden: 4200, wedstrijden: 1, doelpunten: 1 });
		expect(daanish.presentie).toEqual({ er: 2, totaal: 2 });
		const gijs = rijen.find((r) => r.naam === 'Gijs')!;
		expect(gijs.keeper).toBe(2100);
		expect(percentage(gijs.presentie)).toBe(50);
	});

	it('laat iemand die nog niets deed gewoon op nul staan', () => {
		const nieuw = spelersOverzicht(spelers, archief, trainingen).find((r) => r.naam === 'Nieuw')!;
		expect(nieuw.seconden).toBe(0);
		expect(percentage(nieuw.presentie)).toBeNull();
	});

	it('sorteert op naam, minuten of presentie', () => {
		const rijen = spelersOverzicht(spelers, archief, trainingen);
		expect(sorteer(rijen, 'naam').map((r) => r.naam)).toEqual(['Daanish', 'Gijs', 'Nieuw']);
		expect(sorteer(rijen, 'minuten').map((r) => r.naam)).toEqual(['Daanish', 'Gijs', 'Nieuw']);
		/* wie het minst kwam bovenaan; wie nog nooit een training had onderaan */
		expect(sorteer(rijen, 'presentie').map((r) => r.naam)).toEqual(['Gijs', 'Daanish', 'Nieuw']);
	});
});
