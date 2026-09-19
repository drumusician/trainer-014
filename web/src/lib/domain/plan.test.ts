import { describe, expect, it } from 'vitest';
import { planStappen, volgendeStap, nogOpen } from './plan';
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
