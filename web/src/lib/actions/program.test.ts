import { describe, expect, it } from 'vitest';
import { emptyState } from '$lib/domain/types';
import * as p from './program';

/* Dezelfde regels als ProgramTests.swift in de iPhone-app. */
function metProgramma() {
	const t = emptyState();
	t.players = [
		{ id: 'p1', name: 'Sem', line: '' },
		{ id: 'p2', name: 'Noah', line: '' }
	];
	let n = 0;
	const id = p.voegToe(t, '2026-10-25', '10:30', ' Sparta ', true, () => 'w-25');
	p.voegToe(t, '2026-10-18', '9:00', '', false, () => 'w-18');
	p.zet(t, id, 'limonade', 'p2', () => 't' + ++n);
	p.voegTaakToe(t, id, 'rijden', 'p1', () => 't' + ++n);
	p.voegTaakToe(t, id, 'rijden', null, () => 't' + ++n);
	return { t, id };
}

describe('het programma', () => {
	it('staat op volgorde, met alleen echte tijden', () => {
		const { t } = metProgramma();
		expect(t.program!.map((x) => x.id)).toEqual(['w-18', 'w-25']);
		expect(t.program![1]).toMatchObject({ opponent: 'Sparta', time: '10:30' });
		expect(t.program![0].opponent).toBe('Tegenstander');
		expect(t.program![0].time).toBeUndefined();
	});

	it('wordt op de dag zelf de wedstrijd, met dezelfde taken', () => {
		const { t, id } = metProgramma();
		expect(p.uitProgramma(t, id)).toBe(true);
		expect(t.match).toMatchObject({ id, opponent: 'Sparta', time: '10:30', date: '2026-10-25', fromProgram: true });
		expect(t.program!.map((x) => x.id)).toEqual(['w-18']);
		expect(p.taken(t, id)).toHaveLength(3);
		expect(p.uitProgramma(t, 'w-18')).toBe(false);
	});

	it('gaat terug in het programma als je hem weggooit', () => {
		const { t, id } = metProgramma();
		p.uitProgramma(t, id);
		p.terugInProgramma(t);
		t.match = null;
		expect(t.program!.map((x) => x.id)).toEqual(['w-18', 'w-25']);
	});

	it('wijzigt en haalt weg, met de taken', () => {
		const { t, id } = metProgramma();
		p.wijzig(t, id, { datum: '2026-10-01', aanvang: null, tegenstander: 'Ajax', thuis: false });
		expect(t.program![0]).toEqual({ id, date: '2026-10-01', opponent: 'Ajax', home: false });
		expect(p.wijzig(t, 'bestaat-niet', {})).toBe(false);
		p.haalWeg(t, id);
		expect(t.tasks).toHaveLength(0);
		expect(p.haalWeg(t, id)).toBe(false);
	});
});

describe('de taken', () => {
	it('heeft er één per soort, en niemand haalt hem weg', () => {
		const { t, id } = metProgramma();
		t.tasks![0].declinedBy = 'p1';
		p.zet(t, id, 'limonade', 'p1');
		expect(p.taken(t, id).filter((x) => x.kind === 'limonade')).toEqual([
			{ id: 't1', matchId: id, kind: 'limonade', player: 'p1' }
		]);
		p.zet(t, id, 'limonade', null);
		expect(p.taken(t, id).some((x) => x.kind === 'limonade')).toBe(false);
	});

	it('wijst een rijder toe en haalt hem weer weg', () => {
		const { t } = metProgramma();
		p.wijs(t, 't3', 'p2');
		expect(t.tasks!.find((x) => x.id === 't3')!.player).toBe('p2');
		p.wijs(t, 't3', null);
		expect(t.tasks!.find((x) => x.id === 't3')!.player).toBeUndefined();
		p.haalTaakWeg(t, 't3');
		expect(t.tasks).toHaveLength(2);
	});

	it('kent alleen een tijd als tijd', () => {
		expect(p.tijd('10:30')).toBe('10:30');
		expect(p.tijd('24:00')).toBeUndefined();
		expect(p.tijd('9:30')).toBeUndefined();
		expect(p.woord('teamtas')).toBe('Teamtas');
	});
});
