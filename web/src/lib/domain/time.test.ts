import { describe, expect, it } from 'vitest';
import { keeperTimes, positionText, positionTimes, playingTimes, fieldIntervals } from './time';
import { FORMATIONS } from './formations';
import type { Player, Match } from './types';

const NAMEN = ['Gijs', 'Jack', 'Maher', 'Daan', 'Mirza', 'Siem', 'Kasper', 'Daanish', 'Mauro', 'Max', 'Simon', 'Amir'];
const players: Player[] = NAMEN.map((name) => ({ id: 'p' + name, name, line: '' }));

function match(): Match {
	const lineup: Record<string, string | null> = {};
	FORMATIONS['4-3-3'].forEach((p, i) => (lineup[p[0]] = players[i].id));
	return {
		date: '2026-09-06',
		opponent: 'Test',
		home: true,
		formation: '4-3-3',
		lineup,
		bench: ['pAmir'],
		events: [{ type: 'start', t: 0 }],
		elapsed: 4200,
		since: null,
		running: false,
		parts: 2,
		part: 2,
		inBreak: false,
		finished: true
	};
}

describe('speeltijd', () => {
	it('telt een wedstrijd zonder wissels als elf keer de speelduur', () => {
		const w = match();
		w.events.push({ type: 'end', t: 4200 });
		const t = playingTimes(w, players);
		expect(t['pGijs']).toBe(4200);
		expect(t['pAmir']).toBe(0);
		expect(Object.values(t).reduce((a, b) => a + b, 0)).toBe(11 * 4200);
	});

	it('verdeelt de tijd over een wissel', () => {
		const w = match();
		w.lineup['SP'] = 'pAmir';
		w.bench = ['pMax'];
		w.events.push({ type: 'substitution', t: 1200, off: 'pMax', on: 'pAmir', position: 'SP' });
		w.events.push({ type: 'end', t: 4200 });
		const t = playingTimes(w, players);
		expect(t['pMax']).toBe(1200);
		expect(t['pAmir']).toBe(3000);
		expect(Object.values(t).reduce((a, b) => a + b, 0)).toBe(11 * 4200);
	});

	it('houdt keeperminuten apart als er bij rust gedraaid wordt', () => {
		/* Gijs keept de eerste helft, gaat daarna linksback spelen.
		   Amir komt in het doel. Jouw regel: wie keept, speelt de rest volledig. */
		const w = match();
		w.lineup['K'] = 'pAmir';
		w.lineup['LV'] = 'pGijs';
		w.bench = ['pMirza'];
		w.events.push(
			{ type: 'break', t: 2100 },
			{ type: 'substitution', t: 2100, off: 'pGijs', on: 'pAmir', position: 'K' },
			{ type: 'substitution', t: 2100, off: 'pMirza', on: 'pGijs', position: 'LV' },
			{ type: 'end', t: 4200 }
		);
		const t = playingTimes(w, players);
		const k = keeperTimes(w);
		expect(t['pGijs']).toBe(4200);
		expect(k['pGijs']).toBe(2100);
		expect(t['pAmir']).toBe(2100);
		expect(k['pAmir']).toBe(2100);
		expect(t['pMirza']).toBe(2100);
		expect(k['pMirza']).toBeUndefined();
		expect(Object.values(t).reduce((a, b) => a + b, 0)).toBe(11 * 4200);
	});

	it('laat geen plek onbezet als een wissel geen plek meekreeg', () => {
		const w = match();
		w.lineup['SP'] = 'pAmir';
		w.bench = ['pMax'];
		w.events.push({ type: 'substitution', t: 2000, off: 'pMax', on: 'pAmir' });
		w.events.push({ type: 'end', t: 4200 });
		expect(fieldIntervals(w)).toHaveLength(12);
		expect(Object.values(playingTimes(w, players)).reduce((a, b) => a + b, 0)).toBe(11 * 4200);
	});
});

describe('van plek ruilen tijdens de wedstrijd', () => {
	/* The rule here: whoever keeps one half plays the other half outfield. At
	   half-time you usually swap with someone already on the pitch. */
	it('houdt de totale tijd gelijk en telt alleen het doel apart', () => {
		const w = match();
		/* Gijs kept the first half; at half-time he swaps with Kasper (midfield) */
		w.lineup['K'] = 'pKasper';
		w.lineup['MC'] = 'pGijs';
		w.events.push(
			{ type: 'break', t: 2100 },
			{ type: 'swap', t: 2100, positionA: 'K', positionB: 'MC' },
			{ type: 'end', t: 4200 }
		);
		const t = playingTimes(w, players);
		const k = keeperTimes(w);
		expect(t['pGijs']).toBe(4200);
		expect(t['pKasper']).toBe(4200);
		expect(k['pGijs']).toBe(2100);
		expect(k['pKasper']).toBe(2100);
		expect(Object.values(t).reduce((a, b) => a + b, 0)).toBe(11 * 4200);
	});

	it('werkt ook als er daarna nog gewisseld wordt', () => {
		const w = match();
		w.lineup['K'] = 'pKasper';
		w.lineup['MC'] = 'pAmir';
		w.bench = ['pGijs'];
		w.events.push(
			{ type: 'swap', t: 2100, positionA: 'K', positionB: 'MC' },
			{ type: 'substitution', t: 3000, off: 'pGijs', on: 'pAmir', position: 'MC' },
			{ type: 'end', t: 4200 }
		);
		const t = playingTimes(w, players);
		const k = keeperTimes(w);
		expect(k['pGijs']).toBe(2100); /* eerste helft in het doel */
		expect(t['pGijs']).toBe(3000); /* daarna middenveld tot minuut 50 */
		expect(t['pAmir']).toBe(1200);
		expect(k['pKasper']).toBe(2100);
		expect(Object.values(t).reduce((a, b) => a + b, 0)).toBe(11 * 4200);
	});
});

describe('kleinere speelvormen', () => {
	/* De rekenkern telt nergens tot elf: hij volgt de plekken uit de formatie. */
	it('rekent 8 tegen 8 net zo goed door', () => {
		const kort: Player[] = NAMEN.slice(0, 10).map((name) => ({ id: 'p' + name, name, line: '' }));
		const lineup: Record<string, string | null> = {};
		FORMATIONS['1-3-3-1'].forEach((p, i) => (lineup[p[0]] = kort[i].id));
		const w: Match = {
			date: '2026-09-06',
			opponent: 'Test',
			home: true,
			formation: '1-3-3-1',
			lineup,
			bench: [kort[8].id, kort[9].id],
			events: [
				{ type: 'start', t: 0 },
				{ type: 'substitution', t: 1200, off: kort[7].id, on: kort[8].id, position: 'SP' },
				{ type: 'swap', t: 1800, positionA: 'K', positionB: 'MC' },
				{ type: 'end', t: 3600 }
			],
			elapsed: 3600,
			since: null,
			running: false,
			parts: 2,
			part: 2,
			inBreak: false,
			finished: true
		};
		const t = playingTimes(w, kort);
		const k = keeperTimes(w);
		expect(Object.values(t).reduce((a, b) => a + b, 0)).toBe(8 * 3600);
		expect(t['p' + NAMEN[7]]).toBe(1200);
		expect(k['p' + NAMEN[0]]).toBe(1800); /* keepte tot de ruil */
	});

	it('werkt ook zonder keeper, bij 4 tegen 4', () => {
		const kort: Player[] = NAMEN.slice(0, 5).map((name) => ({ id: 'p' + name, name, line: '' }));
		const lineup: Record<string, string | null> = {};
		FORMATIONS['2-2'].forEach((p, i) => (lineup[p[0]] = kort[i].id));
		const w: Match = {
			date: '2026-09-06',
			opponent: 'Test',
			home: true,
			formation: '2-2',
			lineup,
			bench: [kort[4].id],
			events: [
				{ type: 'start', t: 0 },
				{ type: 'end', t: 1800 }
			],
			elapsed: 1800,
			since: null,
			running: false,
			parts: 2,
			part: 2,
			inBreak: false,
			finished: true
		};
		expect(Object.values(playingTimes(w, kort)).reduce((a, b) => a + b, 0)).toBe(4 * 1800);
		expect(keeperTimes(w)).toEqual({});
	});
});

describe('wie waar stond', () => {
	it('telt de minuten per plek', () => {
		const w = match();
		w.lineup['K'] = 'pAmir';
		w.lineup['LV'] = 'pGijs';
		w.bench = ['pMirza'];
		w.events.push(
			{ type: 'substitution', t: 2100, off: 'pGijs', on: 'pAmir', position: 'K' },
			{ type: 'substitution', t: 2100, off: 'pMirza', on: 'pGijs', position: 'LV' },
			{ type: 'end', t: 4200 }
		);
		const p = positionTimes(w);
		expect(p['pGijs']).toEqual({ K: 2100, LV: 2100 });
		expect(p['pMirza']).toEqual({ LV: 2100 });
	});

	it('schrijft het leesbaar op, langste plek eerst', () => {
		expect(positionText({ LV: 2100, K: 900 }, '4-3-3')).toBe('35 min LV · 15 min K');
		expect(positionText({}, '4-3-3')).toBe('');
		expect(positionText(undefined, '4-3-3')).toBe('');
	});

	it('vat samen als iemand overal gestaan heeft', () => {
		const tekst = positionText({ K: 600, LV: 500, MC: 400, SP: 300, RV: 200 }, '4-3-3');
		expect(tekst).toBe('10 min K · 8 min LV · 7 min M · 8 min overig');
	});
});
