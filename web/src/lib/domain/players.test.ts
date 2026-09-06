import { describe, expect, it } from 'vitest';
import { percentage, sorteer, spelersOverzicht } from './players';
import type { ArchivedMatch, Player, Training } from './types';

const players: Player[] = [
	{ id: 'p1', name: 'Daanish', line: 'M' },
	{ id: 'p2', name: 'Gijs', line: '', keeper: true },
	{ id: 'p3', name: 'Nieuw', line: 'A' }
];

const archive: ArchivedMatch[] = [
	{
		date: '2026-08-30',
		opponent: 'Ajax',
		home: true,
		score: [1, 0],
		formation: '4-3-3',
		duration: 4200,
		names: { p1: 'Daanish', p2: 'Gijs' },
		events: [{ type: 'goal', t: 900, player: 'p1' }],
		playingTime: [
			{ id: 'p1', name: 'Daanish', seconds: 4200, keeper: 0 },
			{ id: 'p2', name: 'Gijs', seconds: 2100, keeper: 2100 }
		]
	}
];

const trainings: Training[] = [
	{ id: 't1', date: '2026-09-02', status: { p1: 'present', p2: 'absent' } },
	{ id: 't2', date: '2026-08-26', status: { p1: 'present', p2: 'present' } }
];

describe('spelersoverzicht', () => {
	it('zet minuten, doelpunten en presentie op één regel', () => {
		const rijen = spelersOverzicht(players, archive, trainings);
		const daanish = rijen.find((r) => r.name === 'Daanish')!;
		expect(daanish).toMatchObject({ seconds: 4200, matches: 1, goals: 1 });
		expect(daanish.attendance).toEqual({ er: 2, totaal: 2 });
		const gijs = rijen.find((r) => r.name === 'Gijs')!;
		expect(gijs.keeperSeconds).toBe(2100);
		expect(percentage(gijs.attendance)).toBe(50);
	});

	it('laat iemand die nog niets deed gewoon op nul staan', () => {
		const nieuw = spelersOverzicht(players, archive, trainings).find((r) => r.name === 'Nieuw')!;
		expect(nieuw.seconds).toBe(0);
		expect(percentage(nieuw.attendance)).toBeNull();
	});

	it('zet de makers bovenaan als je op doelpunten sorteert', () => {
		const rijen = spelersOverzicht(players, archive, trainings);
		expect(sorteer(rijen, 'doelpunten').map((r) => r.name)).toEqual(['Daanish', 'Gijs', 'Nieuw']);
	});

	it('sorteert op naam, minuten of presentie', () => {
		const rijen = spelersOverzicht(players, archive, trainings);
		expect(sorteer(rijen, 'naam').map((r) => r.name)).toEqual(['Daanish', 'Gijs', 'Nieuw']);
		expect(sorteer(rijen, 'minuten').map((r) => r.name)).toEqual(['Daanish', 'Gijs', 'Nieuw']);
		/* whoever came least at the top; whoever never had a session at the bottom */
		expect(sorteer(rijen, 'presentie').map((r) => r.name)).toEqual(['Gijs', 'Daanish', 'Nieuw']);
	});
});

describe('assists', () => {
	it('telt ze mee per speler', () => {
		const metAssist: ArchivedMatch[] = [
			{
				...archive[0],
				events: [{ type: 'goal', t: 900, player: 'p1', assist: 'p2' }]
			}
		];
		const rijen = spelersOverzicht(players, metAssist, trainings);
		expect(rijen.find((r) => r.name === 'Gijs')!.assists).toBe(1);
		expect(rijen.find((r) => r.name === 'Daanish')!.assists).toBe(0);
	});
});
