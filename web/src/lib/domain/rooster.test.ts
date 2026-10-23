import { describe, expect, it } from 'vitest';
import { rooster, roosterBlokken } from './rooster';
import * as plan from '$lib/actions/plan';
import type { Match, Player } from './types';

/* Dezelfde regels als RoosterTests.swift in de iPhone-app. */
const spelers: Player[] = ['kasper', 'gijs', 'jack', 'zenith', 'daanish', 'max', 'maher', 'alain'].map((id) => ({
	id,
	name: id,
	line: ''
}));

function wedstrijd(afgetrapt?: number): Match {
	return {
		date: '2026-11-08',
		opponent: 'Waterwijk',
		home: false,
		formation: '1-2-2-1',
		lineup: { K: 'kasper', LV: 'gijs', RV: 'jack', ML: 'zenith', MR: 'daanish', SP: 'max' },
		bench: ['maher', 'alain'],
		absent: ['siem'],
		events: afgetrapt === undefined ? [] : [{ type: 'start', t: 0 }],
		elapsed: (afgetrapt ?? 0) * 60,
		since: null,
		running: false,
		parts: 2,
		part: 1,
		inBreak: false,
		finished: false
	};
}

describe('het rooster', () => {
	it('hakt een wedstrijd in vieren: helften in tweeën, kwarten elk een blok', () => {
		expect(roosterBlokken(2, 30)).toEqual([{ start: 0 }, { start: 15 }, { start: 30, naDeel: 1 }, { start: 45 }]);
		expect(roosterBlokken(4, 15).map((b) => b.naDeel)).toEqual([undefined, 1, 2, 3]);
	});

	it('laat zonder plan zien wie de hele wedstrijd op de bank zit', () => {
		const r = rooster(wedstrijd(), spelers, 30, 0);
		expect(r.blokken).toHaveLength(4);
		expect(r.regels.map((x) => x.id)).toEqual(['kasper', 'gijs', 'jack', 'zenith', 'daanish', 'max', 'maher', 'alain']);
		expect(r.regels[1]).toMatchObject({ plekken: ['LV', 'LV', 'LV', 'LV'], minuten: 60, weinig: false });
		expect(r.regels[6]).toMatchObject({ plekken: [null, null, null, null], minuten: 0, weinig: true });
		expect(r.eerlijk).toBe(45);
	});

	it('een wissel op de grens van een blok, en dezelfde tik andersom maakt hem ongedaan', () => {
		const w = wedstrijd();
		const r = rooster(w, spelers, 30, 0);
		expect(plan.wisselInRooster(w, r.blokken[1], 'gijs', 'maher')).toBe(true);
		expect(w.plan?.[0]).toMatchObject({ minuut: 15, on: 'maher', off: 'gijs' });
		expect(w.plan?.[0].naDeel).toBeUndefined();
		let na = rooster(w, spelers, 30, 0);
		expect(na.regels[1]).toMatchObject({ plekken: ['LV', null, null, null], minuten: 15 });
		expect(na.regels[6]).toMatchObject({ plekken: [null, 'LV', 'LV', 'LV'], minuten: 45 });

		/* In de rust komt Gijs terug, voor Maher: een pauzewissel. */
		expect(plan.wisselInRooster(w, na.blokken[2], 'maher', 'gijs')).toBe(true);
		expect(w.plan?.at(-1)?.naDeel).toBe(1);
		na = rooster(w, spelers, 30, 0);
		expect(na.regels[1].minuten).toBe(45);
		expect(na.regels[6].minuten).toBe(15);

		/* Nog eens dezelfde tik in de rust: weg. */
		const eerste = w.plan![0].id;
		expect(plan.wisselInRooster(w, na.blokken[2], 'gijs', 'maher')).toBe(true);
		expect(w.plan?.map((s) => s.id)).toEqual([eerste]);
	});

	it('twee uit het veld, of het begin, is geen wissel', () => {
		const w = wedstrijd();
		const r = rooster(w, spelers, 30, 0);
		expect(plan.wisselInRooster(w, r.blokken[1], 'gijs', 'jack')).toBe(false);
		expect(plan.wisselInRooster(w, r.blokken[0], 'gijs', 'maher')).toBe(false);
		expect(w.plan).toBeUndefined();
	});

	it('na de aftrap telt wat gespeeld is, en wat voorbij is valt weg', () => {
		const w = wedstrijd(20);
		plan.voegToe(w, 30, 'maher', 'gijs', 1);
		const r = rooster(w, spelers, 30, 0);
		expect(r.blokken.map((b) => b.start)).toEqual([15, 30, 45]);
		expect(r.blokken.map((b) => b.teVeranderen)).toEqual([false, true, true]);
		expect(r.regels[1].minuten).toBe(30);
		expect(r.regels[6].minuten).toBe(30);
	});
});
