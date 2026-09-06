import { describe, expect, it } from 'vitest';
import { describePackage, readTransferCode, makeTransferCode } from './transfer';
import { emptyState, type State } from './types';

function volleToestand(): State {
	const t = emptyState();
	t.players = [
		{ id: 'p1', name: 'Daanish', line: 'M' },
		{ id: 'p2', name: 'Zoë', line: '', keeper: true }
	];
	t.trainings = [{ id: 't1', date: '2026-09-02', status: { p1: 'present', p2: 'absent' } }];
	t.archive = [
		{
			date: '2026-08-30',
			opponent: 'Ajax',
			home: true,
			score: [1, 0],
			formation: '4-3-3',
			duration: 4200,
			events: [],
			playingTime: [{ id: 'p1', name: 'Daanish', seconds: 4200 }]
		}
	];
	t.defaultLineup = { formation: '4-3-3', lineup: { K: 'p2' }, bench: ['p1'] };
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

describe('overzetten', () => {
	it('neemt alles mee behalve de wedstrijd die loopt', () => {
		const p = readTransferCode(makeTransferCode(volleToestand()));
		expect(p.players).toHaveLength(2);
		expect(p.trainings).toHaveLength(1);
		expect(p.archive).toHaveLength(1);
		expect(p.defaultLineup).not.toBeNull();
		expect(p).not.toHaveProperty('wedstrijd');
	});

	it('overleeft accenten in namen', () => {
		expect(readTransferCode(makeTransferCode(volleToestand())).players![1].name).toBe('Zoë');
	});

	it('slikt ook een back-up, die is immers hetzelfde', () => {
		const backup = JSON.stringify({ blaadje: 1, toestand: { players: [{ id: 'p1', name: 'Aad', line: 'V' }] } });
		expect(readTransferCode(backup).players![0].name).toBe('Aad');
	});

	it('laat weg wat er niet in staat, in plaats van het te wissen', () => {
		const oud = btoa(JSON.stringify({ v: 1, players: [{ id: 'p1', name: 'Aad', line: 'V' }], formation: '4-4-2' }));
		const p = readTransferCode(oud);
		expect(p.trainings).toBeUndefined();
		expect(p.archive).toBeUndefined();
	});

	it('vertelt wat erin zit', () => {
		expect(describePackage(readTransferCode(makeTransferCode(volleToestand())))).toBe(
			'2 spelers, 1 wedstrijd, 1 training, een standaardopstelling'
		);
	});

	it('klaagt over een code zonder selectie', () => {
		expect(() => readTransferCode('geen geldige code')).toThrow();
		expect(() => readTransferCode(btoa(JSON.stringify({ v: 2, players: [] })))).toThrow();
	});
});
