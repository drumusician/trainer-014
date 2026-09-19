import { describe, expect, it } from 'vitest';
import { planStappen, volgendeStap, nogOpen, standOp, wanneer, kanNietOpMoment } from './plan';
import * as plan from '$lib/actions/plan';
import { undoLast } from '$lib/actions/match-events';
import type { Match } from './types';

/*
 * Het wisselplan is een spiekbriefje. Wat er echt gebeurde blijft de waarheid:
 * een stap is gedaan als die wissel in het verloop staat, ook als je hem met de
 * hand deed, en weer open als je hem ongedaan maakt.
 */
const NU = 1_000_000;

function wedstrijd(minuten = 0): Match {
	return {
		date: '2026-09-20',
		opponent: 'De nummer 1',
		home: false,
		formation: '1-2-2-1',
		lineup: { K: 'kasper', LV: 'gijs', RV: 'jack', ML: 'zenith', MR: 'daanish', SP: 'max' },
		bench: ['maher', 'alain'],
		absent: ['siem'],
		events: [{ type: 'start', t: 0 }],
		elapsed: minuten * 60,
		since: null,
		running: false,
		parts: 2,
		part: 1,
		inBreak: false,
		finished: false
	};
}

describe('het wisselplan', () => {
	it('zet de stappen op volgorde van minuut', () => {
		const w = wedstrijd();
		plan.voegToe(w, 35, 'maher', 'kasper');
		plan.voegToe(w, 25, 'alain', 'max');
		expect(planStappen(w, NU).map((s) => s.stap.minuut)).toEqual([25, 35]);
		expect(volgendeStap(w, NU)!.stap.on).toBe('alain');
	});

	it('weet waar hij erin komt: op de plek waar de ander nu staat', () => {
		const w = wedstrijd();
		plan.voegToe(w, 25, 'alain', 'max');
		expect(volgendeStap(w, NU)!.positie).toBe('SP');
		/* Max is intussen naar links geschoven: dan komt Alain daar */
		w.lineup = { ...w.lineup, SP: 'zenith', ML: 'max' };
		expect(volgendeStap(w, NU)!.positie).toBe('ML');
	});

	it('zegt wanneer hij aan de beurt is, maar dwingt niets af', () => {
		const w = wedstrijd(20);
		plan.voegToe(w, 25, 'alain', 'max');
		expect(volgendeStap(w, NU)!.aanDeBeurt).toBe(false);
		w.elapsed = 27 * 60;
		expect(volgendeStap(w, NU)!.aanDeBeurt).toBe(true);
		/* en er is niets gewisseld */
		expect(w.lineup.SP).toBe('max');
	});

	it('voert een stap door als een gewone wissel, met verloop en al', () => {
		const w = wedstrijd(26);
		plan.voegToe(w, 25, 'alain', 'max');
		expect(plan.voerUit(w, NU, w.plan![0].id)).toBe(true);
		expect(w.lineup.SP).toBe('alain');
		expect(w.bench).toContain('max');
		expect(w.events.at(-1)).toMatchObject({
			type: 'substitution',
			on: 'alain',
			off: 'max',
			position: 'SP',
			t: 26 * 60
		});
		expect(volgendeStap(w, NU)).toBeNull();
		expect(planStappen(w, NU)[0].status).toBe('gedaan');
	});

	it('telt een wissel die je met de hand deed ook als gedaan', () => {
		const w = wedstrijd(26);
		plan.voegToe(w, 25, 'alain', 'max');
		w.lineup.SP = 'alain';
		w.events.push({ type: 'substitution', t: 1500, on: 'alain', off: 'max', position: 'SP' });
		expect(planStappen(w, NU)[0].status).toBe('gedaan');
	});

	it('zet een stap weer open als je de wissel ongedaan maakt', () => {
		const w = wedstrijd(26);
		plan.voegToe(w, 25, 'alain', 'max');
		plan.voerUit(w, NU, w.plan![0].id);
		undoLast(w);
		expect(volgendeStap(w, NU)!.stap.on).toBe('alain');
		expect(w.lineup.SP).toBe('max');
	});

	/* De keeperwissel in de rust: eerst Maher in het doel, dan Kasper het veld in. */
	it('kan een tweede stap pas doen als de eerste gedaan is', () => {
		const w = wedstrijd(35);
		plan.voegToe(w, 35, 'maher', 'kasper');
		plan.voegToe(w, 35, 'kasper', 'zenith');
		const [eerste, tweede] = planStappen(w, NU);
		expect(eerste.kanNiet).toBeNull();
		expect(tweede.kanNiet).toBe('alInHetVeld');
		plan.voerUit(w, NU, eerste.stap.id);
		expect(volgendeStap(w, NU)!.kanNiet).toBeNull();
		plan.voerUit(w, NU, tweede.stap.id);
		expect(w.lineup).toMatchObject({ K: 'maher', ML: 'kasper' });
		expect(w.bench).toContain('zenith');
	});

	it('zegt waarom een stap niet kan', () => {
		const w = wedstrijd(30);
		plan.voegToe(w, 25, 'siem', 'max');
		plan.voegToe(w, 26, 'alain', 'maher');
		const [afwezig, weg] = planStappen(w, NU);
		expect(afwezig.kanNiet).toBe('afwezig');
		/* Maher staat niet in het veld, dus voor hem kan niemand erin */
		expect(weg.kanNiet).toBe('nietInHetVeld');
		expect(plan.voerUit(w, NU, afwezig.stap.id)).toBe(false);
		expect(w.lineup.SP).toBe('max');
	});

	it('slaat een stap over, en kan dat terugdraaien', () => {
		const w = wedstrijd();
		plan.voegToe(w, 25, 'alain', 'max');
		plan.voegToe(w, 30, 'maher', 'gijs');
		plan.slaOver(w, w.plan![0].id);
		expect(volgendeStap(w, NU)!.stap.on).toBe('maher');
		expect(nogOpen(w, NU)).toBe(1);
		plan.slaOver(w, w.plan![0].id, false);
		expect(nogOpen(w, NU)).toBe(2);
	});

	it('wisselt nooit vóór de aftrap', () => {
		const w = wedstrijd();
		w.events = [];
		plan.voegToe(w, 0, 'alain', 'max');
		expect(plan.voerUit(w, NU, w.plan![0].id)).toBe(false);
		expect(w.lineup.SP).toBe('max');
	});

	it('weigert een stap zonder zin', () => {
		const w = wedstrijd();
		expect(plan.voegToe(w, 25, 'max', 'max')).toBe(false);
		expect(plan.voegToe(w, -1, 'alain', 'max')).toBe(false);
		expect(plan.voegToe(w, 25, '', 'max')).toBe(false);
		expect(w.plan ?? []).toEqual([]);
	});

	it('haalt een stap weg en vervangt het hele plan', () => {
		const w = wedstrijd();
		plan.voegToe(w, 25, 'alain', 'max');
		plan.haalWeg(w, w.plan![0].id);
		expect(w.plan).toEqual([]);
		plan.vervang(w, [
			{ minuut: 35, on: 'maher', off: 'kasper' },
			{ minuut: 50, on: 'alain', off: 'max' }
		]);
		expect(w.plan!.map((s) => s.on)).toEqual(['maher', 'alain']);
		expect(new Set(w.plan!.map((s) => s.id)).size).toBe(2);
	});

	it('is leeg zonder plan', () => {
		expect(planStappen(wedstrijd(), NU)).toEqual([]);
		expect(volgendeStap(null, NU)).toBeNull();
	});
});

describe('wie er rond een minuut staat', () => {
	it('is bij minuut 0 de opstelling van nu', () => {
		const w = wedstrijd();
		w.events = [];
		const s = standOp(w, 0);
		expect(s.bank).toEqual(['maher', 'alain']);
		expect(s.veld.find((r) => r.plek === 'K')!.id).toBe('kasper');
	});

	it('past de geplande stappen tot en met die minuut toe', () => {
		const w = wedstrijd();
		w.events = [];
		plan.voegToe(w, 25, 'alain', 'max');
		plan.voegToe(w, 50, 'max', 'jack');
		expect(standOp(w, 20).bank).toContain('alain');
		expect(standOp(w, 25).bank).toEqual(['maher', 'max']);
		expect(standOp(w, 25).veld.find((r) => r.plek === 'SP')!.id).toBe('alain');
		expect(standOp(w, 50).veld.find((r) => r.plek === 'RV')!.id).toBe('max');
	});

	/* De keeperwissel in de rust: daarna staat Kasper op de bank en kan hij weer het veld in. */
	it('rekent stappen in dezelfde minuut na elkaar door', () => {
		const w = wedstrijd();
		w.events = [];
		plan.voegToe(w, 35, 'maher', 'kasper');
		const s = standOp(w, 35);
		expect(s.bank).toContain('kasper');
		expect(s.veld.find((r) => r.plek === 'K')!.id).toBe('maher');
	});

	it('telt een overgeslagen stap niet, en een gedane zit al in de opstelling', () => {
		const w = wedstrijd(30);
		plan.voegToe(w, 25, 'alain', 'max');
		plan.voegToe(w, 26, 'maher', 'gijs');
		plan.voerUit(w, NU, w.plan![0].id);
		plan.slaOver(w, w.plan![1].id);
		const s = standOp(w, 40);
		expect(s.veld.find((r) => r.plek === 'SP')!.id).toBe('alain');
		expect(s.veld.find((r) => r.plek === 'LV')!.id).toBe('gijs');
	});

	it('slaat een stap die niet kan over in plaats van te gokken', () => {
		const w = wedstrijd();
		w.events = [];
		plan.voegToe(w, 25, 'alain', 'maher');
		expect(standOp(w, 30).bank).toEqual(['maher', 'alain']);
	});
});

describe('een wissel in de pauze', () => {
	/* De rust valt zelden op 35:00 precies. Hij is aan de beurt als je de rust aantikt. */
	it('is aan de beurt zodra de pauze er is, niet op de klok', () => {
		const w = wedstrijd(36);
		plan.voegToe(w, 35, 'maher', 'kasper', 1);
		expect(volgendeStap(w, NU)!.aanDeBeurt).toBe(false);
		w.inBreak = true;
		expect(volgendeStap(w, NU)!.aanDeBeurt).toBe(true);
		/* en ook als het volgende deel al begonnen is */
		w.inBreak = false;
		w.part = 2;
		expect(volgendeStap(w, NU)!.aanDeBeurt).toBe(true);
	});

	it('zegt wanneer, zoals je het zegt', () => {
		expect(wanneer({ id: 'x', minuut: 25, on: 'a', off: 'b' }, 2)).toBe('25′');
		expect(wanneer({ id: 'x', minuut: 35, naDeel: 1, on: 'a', off: 'b' }, 2)).toBe('Rust');
		expect(wanneer({ id: 'x', minuut: 15, naDeel: 1, on: 'a', off: 'b' }, 4)).toBe('Pauze na 1e kwart');
		expect(wanneer({ id: 'x', minuut: 30, naDeel: 2, on: 'a', off: 'b' }, 4)).toBe('Rust');
	});
});

/* De keeperwissel met een veldspeler: geen wissel met de bank, maar ruilen. */
describe('twee spelers die van plek ruilen', () => {
	it('ruilt ze als het moment er is, met een ruil in het verloop', () => {
		const w = wedstrijd(35);
		plan.voegToe(w, 35, 'zenith', 'kasper', 1, 'ruil');
		const stap = volgendeStap(w, NU)!;
		expect(stap.kanNiet).toBeNull();
		expect(plan.voerUit(w, NU, stap.stap.id)).toBe(true);
		expect(w.lineup).toMatchObject({ K: 'zenith', ML: 'kasper' });
		expect(w.bench).toEqual(['maher', 'alain']);
		expect(w.events.at(-1)).toMatchObject({ type: 'swap', playerA: 'zenith', playerB: 'kasper' });
		expect(volgendeStap(w, NU)).toBeNull();
	});

	it('telt een ruil die je met de hand deed ook, in welke volgorde ook', () => {
		const w = wedstrijd(35);
		plan.voegToe(w, 35, 'zenith', 'kasper', 1, 'ruil');
		w.events.push({ type: 'swap', t: 2100, positionA: 'K', positionB: 'ML', playerA: 'kasper', playerB: 'zenith' });
		expect(planStappen(w, NU)[0].status).toBe('gedaan');
	});

	it('kan niet als een van beiden niet in het veld staat', () => {
		const w = wedstrijd(35);
		plan.voegToe(w, 35, 'maher', 'kasper', 1, 'ruil');
		expect(planStappen(w, NU)[0].kanNiet).toBe('nietBeideInHetVeld');
		expect(plan.voerUit(w, NU, w.plan![0].id)).toBe(false);
	});

	it('rekent de ruil mee in wie er daarna waar staat', () => {
		const w = wedstrijd();
		w.events = [];
		plan.voegToe(w, 35, 'zenith', 'kasper', 1, 'ruil');
		const s = standOp(w, 35);
		expect(s.veld.find((r) => r.plek === 'K')!.id).toBe('zenith');
		expect(s.veld.find((r) => r.plek === 'ML')!.id).toBe('kasper');
		expect(s.bank).toEqual(['maher', 'alain']);
	});
});

/* Na een rommelige wedstrijd met wissels die niet gepland waren. */
describe('als er veel anders ging dan gepland', () => {
	it('schuift een stap die niet meer kan stil opzij', () => {
		const w = wedstrijd(30);
		plan.voegToe(w, 25, 'alain', 'maher'); /* Maher staat niet in het veld */
		plan.voegToe(w, 28, 'alain', 'max');
		expect(volgendeStap(w, NU)!.stap.off).toBe('max');
		expect(nogOpen(w, NU)).toBe(1);
		/* en in het plan staat hij er nog, met de reden */
		expect(planStappen(w, NU)[0]).toMatchObject({ status: 'open', kanNiet: 'nietInHetVeld' });
	});

	it('laat een opzij geschoven stap terugkomen als hij weer kan', () => {
		const w = wedstrijd(30);
		plan.voegToe(w, 25, 'alain', 'maher');
		expect(volgendeStap(w, NU)).toBeNull();
		/* Maher komt alsnog het veld in */
		w.lineup.SP = 'maher';
		w.bench = ['alain', 'max'];
		w.events.push({ type: 'substitution', t: 1800, on: 'maher', off: 'max', position: 'SP' });
		expect(volgendeStap(w, NU)!.stap.on).toBe('alain');
	});

	it('zegt het als wie eruit moet er pas net in kwam', () => {
		const w = wedstrijd(30);
		w.lineup.SP = 'alain';
		w.bench = ['maher', 'max'];
		w.events.push({ type: 'substitution', t: 26 * 60, on: 'alain', off: 'max', position: 'SP' });
		plan.voegToe(w, 28, 'max', 'alain');
		plan.voegToe(w, 29, 'maher', 'gijs');
		const [terug, gewoon] = planStappen(w, NU);
		expect(terug.kanNiet).toBeNull();
		/* Alain kwam 4 minuten geleden in, Max ging er 4 minuten geleden uit */
		expect(terug.pasErin).toBe(4);
		expect(terug.pasEruit).toBe(4);
		expect(gewoon.pasErin).toBeNull();
		expect(gewoon.pasEruit).toBeNull();
	});

	it('vindt tien minuten geleden niet meer opvallend', () => {
		const w = wedstrijd(40);
		w.lineup.SP = 'alain';
		w.bench = ['maher', 'max'];
		w.events.push({ type: 'substitution', t: 30 * 60, on: 'alain', off: 'max', position: 'SP' });
		plan.voegToe(w, 40, 'maher', 'alain');
		expect(planStappen(w, NU)[0].pasErin).toBeNull();
	});

	/* In het plan zelf telt het moment van de stap, niet hoe het nu staat. */
	it('beoordeelt een stap in het plan op zijn eigen moment', () => {
		const w = wedstrijd();
		w.events = [];
		plan.voegToe(w, 35, 'maher', 'kasper', 1);
		plan.voegToe(w, 35, 'kasper', 'zenith', 1);
		plan.voegToe(w, 40, 'siem', 'max');
		const [eerste, tweede, derde] = planStappen(w, NU).map((s) => s.stap);
		expect(kanNietOpMoment(w, eerste)).toBeNull();
		/* nu staat Kasper nog in het doel, maar na de eerste stap zit hij op de bank */
		expect(planStappen(w, NU)[1].kanNiet).toBe('alInHetVeld');
		expect(kanNietOpMoment(w, tweede)).toBeNull();
		expect(kanNietOpMoment(w, derde)).toBe('afwezig');
	});
});

describe('wanneer een stap in beeld komt', () => {
	it('vanaf vijf minuten ervoor, en natuurlijk als hij aan de beurt is', () => {
		const w = wedstrijd(19);
		plan.voegToe(w, 25, 'alain', 'max');
		expect(volgendeStap(w, NU)!.inZicht).toBe(false);
		w.elapsed = 20 * 60;
		expect(volgendeStap(w, NU)!.inZicht).toBe(true);
	});

	it('een pauzewissel zodra de pauze er is, ook als die vroeg valt', () => {
		const w = wedstrijd(10);
		plan.voegToe(w, 35, 'maher', 'kasper', 1);
		expect(volgendeStap(w, NU)!.inZicht).toBe(false);
		w.inBreak = true;
		expect(volgendeStap(w, NU)!.inZicht).toBe(true);
	});
});
