import { describe, expect, it } from 'vitest';
import { backupName, readBackup, makeBackup } from './backup';
import { describePackage } from './transfer';
import { emptyState } from './types';

function volleToestand() {
	const t = emptyState();
	t.players = [
		{ id: 'p1', name: 'Daanish', line: 'M' },
		{ id: 'p2', name: 'Gijs', line: '', keeper: true }
	];
	t.trainings = [{ id: 't1', date: '2026-09-02', status: { p1: 'present', p2: 'absent' } }];
	t.archive = [
		{
			date: '2026-08-30',
			opponent: 'Ajax',
			home: true,
			score: [2, 1],
			formation: '4-3-3',
			duration: 4200,
			events: [],
			playingTime: [{ id: 'p1', name: 'Daanish', seconds: 4200, keeper: 0 }]
		}
	];
	t.match = {
		date: '2026-09-06',
		opponent: 'Sparta',
		home: true,
		formation: '4-3-3',
		lineup: {},
		bench: [],
		events: [],
		elapsed: 100,
		since: null,
		running: true,
		parts: 2,
		part: 1,
		inBreak: false,
		finished: false
	};
	return t;
}

describe('back-up', () => {
	it('houdt selectie, trainingen en archief vast, maar niet de lopende wedstrijd', () => {
		const terug = readBackup(makeBackup(volleToestand(), '2026-09-03T10:00:00.000Z'));
		expect(terug.players).toHaveLength(2);
		expect(terug.trainings[0].status.p2).toBe('absent');
		expect(terug.archive[0].opponent).toBe('Ajax');
		expect(terug).not.toHaveProperty('wedstrijd');
	});

	it('slikt ook een kale toestand, zoals een oude export', () => {
		const oud = JSON.stringify({ players: [{ id: 'p1', name: 'Aad', line: 'V' }], archive: [] });
		expect(readBackup(oud).players[0].name).toBe('Aad');
	});

	it('weigert wat geen back-up is', () => {
		expect(() => readBackup('{}')).toThrow();
		expect(() => readBackup('geen json')).toThrow();
		expect(() => readBackup(JSON.stringify({ players: [] }))).toThrow();
	});

	it('noemt het bestand naar de dag', () => {
		expect(backupName('2026-09-03T10:00:00.000Z')).toBe('blaadje-2026-09-03.json');
	});
});

describe('een bewaard bestand terugzetten', () => {
	/* The 'Bestand openen' button was missing while 'Bestand opslaan' was not.
	   What you save you must also be able to restore. */
	it('leest terug wat maakBackup schreef, met archief en al', () => {
		const heen = makeBackup(volleToestand(), '2026-09-06T10:00:00.000Z');
		const terug = readBackup(heen);
		expect(terug.players.length).toBe(volleToestand().players.length);
		expect(terug.archive.length).toBe(volleToestand().archive.length);
		expect(terug.teamName).toBe(volleToestand().teamName);
	});

	it('beschrijft zowel een back-up als een overzetcode', () => {
		const uitBackup = readBackup(makeBackup(volleToestand(), '2026-09-06T10:00:00.000Z'));
		expect(describePackage(uitBackup)).toContain('speler');
	});
});
