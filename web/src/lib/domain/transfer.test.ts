import { describe, expect, it } from 'vitest';
import { describePackage, readTransferCode, makeTransferCode } from './transfer';
import { emptyState, type State } from './types';

function volleToestand(): State {
	const t = emptyState();
	t.spelers = [
		{ id: 'p1', naam: 'Daanish', linie: 'M' },
		{ id: 'p2', naam: 'Zoë', linie: '', keept: true }
	];
	t.trainingen = [{ id: 't1', datum: '2026-09-02', status: { p1: 'ja', p2: 'nee' } }];
	t.archief = [
		{
			datum: '2026-08-30',
			tegenstander: 'Ajax',
			thuis: true,
			stand: [1, 0],
			formatie: '4-3-3',
			duur: 4200,
			gebeurtenissen: [],
			speeltijd: [{ id: 'p1', naam: 'Daanish', seconden: 4200 }]
		}
	];
	t.standaard = { formatie: '4-3-3', opstelling: { K: 'p2' }, bank: ['p1'] };
	t.wedstrijd = {
		datum: '2026-09-06',
		tegenstander: 'Sparta',
		thuis: true,
		formatie: '4-3-3',
		opstelling: {},
		bank: [],
		gebeurtenissen: [],
		verstreken: 100,
		sinds: null,
		loopt: true,
		delen: 2,
		deel: 1,
		pauze: false,
		afgelopen: false
	};
	return t;
}

describe('overzetten', () => {
	it('neemt alles mee behalve de wedstrijd die loopt', () => {
		const p = readTransferCode(makeTransferCode(volleToestand()));
		expect(p.spelers).toHaveLength(2);
		expect(p.trainingen).toHaveLength(1);
		expect(p.archief).toHaveLength(1);
		expect(p.standaard).not.toBeNull();
		expect(p).not.toHaveProperty('wedstrijd');
	});

	it('overleeft accenten in namen', () => {
		expect(readTransferCode(makeTransferCode(volleToestand())).spelers![1].naam).toBe('Zoë');
	});

	it('slikt ook een back-up, die is immers hetzelfde', () => {
		const backup = JSON.stringify({ blaadje: 1, toestand: { spelers: [{ id: 'p1', naam: 'Aad', linie: 'V' }] } });
		expect(readTransferCode(backup).spelers![0].naam).toBe('Aad');
	});

	it('laat weg wat er niet in staat, in plaats van het te wissen', () => {
		const oud = btoa(JSON.stringify({ v: 1, spelers: [{ id: 'p1', naam: 'Aad', linie: 'V' }], formatie: '4-4-2' }));
		const p = readTransferCode(oud);
		expect(p.trainingen).toBeUndefined();
		expect(p.archief).toBeUndefined();
	});

	it('vertelt wat erin zit', () => {
		expect(describePackage(readTransferCode(makeTransferCode(volleToestand())))).toBe(
			'2 spelers, 1 wedstrijd, 1 training, een standaardopstelling'
		);
	});

	it('klaagt over een code zonder selectie', () => {
		expect(() => readTransferCode('geen geldige code')).toThrow();
		expect(() => readTransferCode(btoa(JSON.stringify({ v: 2, spelers: [] })))).toThrow();
	});
});
