import { describe, expect, it } from 'vitest';
import { emptyState } from '$lib/domain/types';
import * as p from './program';
import { archiveMatch } from './match';

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
	/* zonder de open taken waarmee een wedstrijd begint: die hebben hun eigen test */
	t.tasks = [];
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

describe('wie deed wat', () => {
	it('de vereniging die fluit staat niet open, en een ouder in de plaats ervan wel gewoon', () => {
		const { t, id } = metProgramma();
		p.zet(t, id, 'fluiten', p.VERENIGING, () => 't4');
		const fluiten = p.taken(t, id).find((x) => x.kind === 'fluiten')!;
		expect(fluiten).toMatchObject({ club: true });
		expect(fluiten.player).toBeUndefined();
		expect(p.isOpen(fluiten)).toBe(false);
		p.zet(t, id, 'fluiten', 'p1');
		expect(p.taken(t, id).find((x) => x.kind === 'fluiten')).toMatchObject({ player: 'p1' });
		expect(p.taken(t, id).find((x) => x.kind === 'fluiten')!.club).toBeUndefined();
	});

	it('van oud naar nieuw, met hoe vaak elke familie aan de beurt was', () => {
		const { t, id } = metProgramma();
		t.players.push({ id: 'p3', name: 'Luuk', line: '' });
		p.zet(t, id, 'fluiten', 'p1');
		p.zet(t, 'w-18', 'fluiten', p.VERENIGING);
		expect(p.uitProgramma(t, 'w-18')).toBe(true);
		archiveMatch(t, 1_000_000);

		const lijst = p.beurten(t, 'fluiten');
		expect(lijst.map((b) => b.wedstrijd)).toEqual(['w-18', id]);
		expect(lijst[0]).toMatchObject({ club: true, geweest: true });
		expect(lijst[1]).toMatchObject({ speler: 'p1', geweest: false });
		expect(p.telling(t, 'fluiten').map((r) => r.speler.name + ' ' + r.keer)).toEqual(['Luuk 0', 'Noah 0', 'Sem 1']);
		/* een rijplek waar nog niemand voor is, telt niet */
		expect(p.beurten(t, 'rijden').map((b) => b.speler)).toEqual(['p1']);
	});

	it('vat per wedstrijd samen wie wat regelt', () => {
		const { t, id } = metProgramma();
		p.zet(t, id, 'fluiten', p.VERENIGING);
		const naam = (x: string) => t.players.find((s) => s.id === x)?.name;
		expect(p.samenvatting(t, id, naam)).toBe('Limonade Noah · Rijden Sem, nog 1 open · Fluiten vereniging');
		expect(p.samenvatting(t, 'w-18', naam)).toBe('');
	});

	it('thuis begint met de limonade open, uit zonder taken', () => {
		const t = emptyState();
		let n = 0;
		const thuis = p.voegToe(
			t,
			'2026-11-01',
			undefined,
			'TABA',
			true,
			() => 'thuis',
			() => 't' + ++n
		);
		const uit = p.voegToe(
			t,
			'2026-11-08',
			undefined,
			'Waterwijk',
			false,
			() => 'uit',
			() => 't' + ++n
		);
		expect(p.taken(t, thuis).map((x) => x.kind)).toEqual(['limonade']);
		expect(p.taken(t, uit)).toEqual([]); // wie rijdt, zegt een ouder zelf
		expect(t.tasks!.every(p.isOpen)).toBe(true);
		expect(p.soorten(false)).toEqual(['rijden', 'vlaggen', 'teamtas']);
	});

	it('van thuis naar uit gaat weg wat niet past, en een taak kan open', () => {
		const t = emptyState();
		const id = p.voegToe(t, '2026-11-01', undefined, 'TABA', true, () => 'w');
		p.zet(t, id, 'fluiten', 'p1');
		p.zet(t, id, 'vlaggen', 'p2');
		p.zet(t, id, 'teamtas', p.OPEN);
		expect(p.isOpen(p.taken(t, id).find((x) => x.kind === 'teamtas')!)).toBe(true);
		p.wijzig(t, id, { thuis: false });
		expect(
			p
				.taken(t, id)
				.map((x) => x.kind)
				.sort()
		).toEqual(['teamtas', 'vlaggen']);
	});

	it('wie zich afmeldt, staat op de dag zelf op afwezig', () => {
		const t = emptyState();
		t.players = [
			{ id: 'p1', name: 'Sem', line: '' },
			{ id: 'p2', name: 'Noah', line: '' }
		];
		const id = p.voegToe(t, '2026-11-01', undefined, 'TABA', true, () => 'w');
		t.program![0].absent = ['p2', 'weg-uit-het-team'];
		expect(p.kanNiet(t, id).map((x) => x.id)).toEqual(['p2']);
		expect(p.uitProgramma(t, id)).toBe(true);
		expect(t.match?.absent).toEqual(['p2']);
		t.match!.absent = ['p2', 'p1'];
		p.terugInProgramma(t);
		expect(t.program?.find((x) => x.id === id)?.absent).toEqual(['p2', 'p1']);
	});
});
