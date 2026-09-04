import { describe, expect, it } from 'vitest';
import { backupNaam, leesBackup, maakBackup } from './backup';
import { legeToestand } from './types';

function volleToestand() {
	const t = legeToestand();
	t.spelers = [{ id: 'p1', naam: 'Daanish', linie: 'M' }, { id: 'p2', naam: 'Gijs', linie: '', keept: true }];
	t.trainingen = [{ id: 't1', datum: '2026-09-02', status: { p1: 'ja', p2: 'nee' } }];
	t.archief = [{
		datum: '2026-08-30', tegenstander: 'Ajax', thuis: true, stand: [2, 1], formatie: '4-3-3',
		duur: 4200, gebeurtenissen: [], speeltijd: [{ id: 'p1', naam: 'Daanish', seconden: 4200, keeper: 0 }]
	}];
	t.wedstrijd = {
		datum: '2026-09-06', tegenstander: 'Sparta', thuis: true, formatie: '4-3-3', opstelling: {},
		bank: [], gebeurtenissen: [], verstreken: 100, sinds: null, loopt: true, delen: 2, deel: 1, pauze: false, afgelopen: false
	};
	return t;
}

describe('back-up', () => {
	it('houdt selectie, trainingen en archief vast, maar niet de lopende wedstrijd', () => {
		const terug = leesBackup(maakBackup(volleToestand(), '2026-09-03T10:00:00.000Z'));
		expect(terug.spelers).toHaveLength(2);
		expect(terug.trainingen[0].status.p2).toBe('nee');
		expect(terug.archief[0].tegenstander).toBe('Ajax');
		expect(terug).not.toHaveProperty('wedstrijd');
	});

	it('slikt ook een kale toestand, zoals een oude export', () => {
		const oud = JSON.stringify({ spelers: [{ id: 'p1', naam: 'Aad', linie: 'V' }], archief: [] });
		expect(leesBackup(oud).spelers[0].naam).toBe('Aad');
	});

	it('weigert wat geen back-up is', () => {
		expect(() => leesBackup('{}')).toThrow();
		expect(() => leesBackup('geen json')).toThrow();
		expect(() => leesBackup(JSON.stringify({ spelers: [] }))).toThrow();
	});

	it('noemt het bestand naar de dag', () => {
		expect(backupNaam('2026-09-03T10:00:00.000Z')).toBe('blaadje-2026-09-03.json');
	});
});
