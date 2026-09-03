import { describe, expect, it } from 'vitest';
import { makers, seizoenStand, seizoenTotalen, topscorers } from './seizoen';
import type { ArchiefWedstrijd, Speler } from './types';

const spelers: Speler[] = [
	{ id: 'p1', naam: 'Aad', linie: 'A' },
	{ id: 'p2', naam: 'Bram', linie: 'V' }
];

const archief: ArchiefWedstrijd[] = [
	{
		datum: '2026-09-05', tegenstander: 'Ajax', thuis: true, stand: [2, 0], formatie: '4-3-3', duur: 4200,
		namen: { p1: 'Aad', p2: 'Bram' },
		gebeurtenissen: [{ type: 'goal', t: 600, speler: 'p1' }, { type: 'goal', t: 1800, speler: null }],
		speeltijd: [
			{ id: 'p1', naam: 'Aad', seconden: 4200, keeper: 2100 },
			{ id: 'p2', naam: 'Bram', seconden: 2100, keeper: 0 }
		]
	},
	{
		datum: '2026-08-29', tegenstander: 'Sparta', thuis: false, stand: [1, 3], formatie: '4-3-3', duur: 4200,
		namen: { p1: 'Aad', p2: 'Bram' },
		gebeurtenissen: [{ type: 'goal', t: 900, speler: 'p2' }],
		speeltijd: [
			{ id: 'p1', naam: 'Aad', seconden: 0, keeper: 0 },
			{ id: 'p2', naam: 'Bram', seconden: 4200, keeper: 0 }
		]
	}
];

describe('seizoen', () => {
	it('telt winst, verlies en doelpunten', () => {
		const st = seizoenStand(archief);
		expect(st).toMatchObject({ wedstrijden: 2, gewonnen: 1, verloren: 1, gelijk: 0, voor: 3, tegen: 3 });
	});

	it('telt speeltijd op en houdt keeperminuten apart', () => {
		const rijen = seizoenTotalen(archief, spelers);
		const aad = rijen.find((r) => r.naam === 'Aad')!;
		expect(aad.seconden).toBe(4200);
		expect(aad.keeper).toBe(2100);
		expect(aad.wedstrijden).toBe(1); /* die tweede zat op de bank */
	});

	it('houdt iemand die hernoemd is als één speler', () => {
		const hernoemd: Speler[] = [{ ...spelers[0], naam: 'Aad de Jong' }, spelers[1]];
		const rijen = seizoenTotalen(archief, hernoemd);
		expect(rijen.filter((r) => r.naam.startsWith('Aad'))).toHaveLength(1);
		expect(rijen.find((r) => r.naam === 'Aad de Jong')!.seconden).toBe(4200);
	});

	it('vertelt bij elke maker in welke wedstrijden hij scoorde', () => {
		const rijen = makers(archief, spelers);
		expect(rijen.map((r) => r.naam)).toEqual(['Aad', 'Bram']);
		expect(rijen[0].wedstrijden).toEqual([{ datum: '2026-09-05', tegenstander: 'Ajax', aantal: 1 }]);
		/* het doelpunt zonder maker telt wel in de stand, niet in deze lijst */
		expect(rijen.reduce((a, r) => a + r.doelpunten, 0)).toBe(2);
	});

	it('zet de topscorer bovenaan en laat onbekende makers weg', () => {
		const t = topscorers(seizoenTotalen(archief, spelers));
		/* gelijk aantal doelpunten: dan telt de speeltijd, en Bram speelde meer */
		expect(t.map((r) => r.naam)).toEqual(['Bram', 'Aad']);
		expect(t.reduce((a, r) => a + r.doelpunten, 0)).toBe(2); /* van de 3 doelpunten */
	});
});
