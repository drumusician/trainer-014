import { describe, expect, it } from 'vitest';
import { makers, seizoenStand, seasonTotals, topscorers } from './season';
import type { ArchivedMatch, Player } from './types';

const players: Player[] = [
	{ id: 'p1', name: 'Aad', line: 'A' },
	{ id: 'p2', name: 'Bram', line: 'V' }
];

const archive: ArchivedMatch[] = [
	{
		date: '2026-09-05',
		opponent: 'Ajax',
		home: true,
		score: [2, 0],
		formation: '4-3-3',
		duration: 4200,
		names: { p1: 'Aad', p2: 'Bram' },
		events: [
			{ type: 'goal', t: 600, player: 'p1' },
			{ type: 'goal', t: 1800, player: null }
		],
		playingTime: [
			{ id: 'p1', name: 'Aad', seconds: 4200, keeper: 2100 },
			{ id: 'p2', name: 'Bram', seconds: 2100, keeper: 0 }
		]
	},
	{
		date: '2026-08-29',
		opponent: 'Sparta',
		home: false,
		score: [1, 3],
		formation: '4-3-3',
		duration: 4200,
		names: { p1: 'Aad', p2: 'Bram' },
		events: [{ type: 'goal', t: 900, player: 'p2' }],
		playingTime: [
			{ id: 'p1', name: 'Aad', seconds: 0, keeper: 0 },
			{ id: 'p2', name: 'Bram', seconds: 4200, keeper: 0 }
		]
	}
];

describe('seizoen', () => {
	it('telt winst, verlies en doelpunten', () => {
		const st = seizoenStand(archive);
		expect(st).toMatchObject({ wedstrijden: 2, gewonnen: 1, verloren: 1, gelijk: 0, voor: 3, tegen: 3 });
	});

	it('telt speeltijd op en houdt keeperminuten apart', () => {
		const rijen = seasonTotals(archive, players);
		const aad = rijen.find((r) => r.name === 'Aad')!;
		expect(aad.seconds).toBe(4200);
		expect(aad.keeper).toBe(2100);
		expect(aad.wedstrijden).toBe(1); /* that second one was on the bench */
	});

	it('houdt iemand die hernoemd is als één speler', () => {
		const hernoemd: Player[] = [{ ...players[0], name: 'Aad de Jong' }, players[1]];
		const rijen = seasonTotals(archive, hernoemd);
		expect(rijen.filter((r) => r.name.startsWith('Aad'))).toHaveLength(1);
		expect(rijen.find((r) => r.name === 'Aad de Jong')!.seconds).toBe(4200);
	});

	it('vertelt bij elke maker in welke wedstrijden hij scoorde', () => {
		const rijen = makers(archive, players);
		expect(rijen.map((r) => r.name)).toEqual(['Aad', 'Bram']);
		expect(rijen[0].wedstrijden).toEqual([{ date: '2026-09-05', opponent: 'Ajax', aantal: 1 }]);
		/* the goal without a scorer counts towards the score, not in this list */
		expect(rijen.reduce((a, r) => a + r.doelpunten, 0)).toBe(2);
	});

	it('zet de topscorer bovenaan en laat onbekende makers weg', () => {
		const t = topscorers(seasonTotals(archive, players));
		/* equal goals: then playing time decides, and Bram played more */
		expect(t.map((r) => r.name)).toEqual(['Bram', 'Aad']);
		expect(t.reduce((a, r) => a + r.doelpunten, 0)).toBe(2); /* van de 3 doelpunten */
	});
});
