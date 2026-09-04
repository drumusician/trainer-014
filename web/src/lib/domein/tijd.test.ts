import { describe, expect, it } from 'vitest';
import { keepertijden, speeltijden, veldIntervallen } from './tijd';
import { FORMATIES } from './formaties';
import type { Speler, Wedstrijd } from './types';

const NAMEN = ['Gijs', 'Jack', 'Maher', 'Daan', 'Mirza', 'Siem', 'Kasper', 'Daanish', 'Mauro', 'Max', 'Simon', 'Amir'];
const spelers: Speler[] = NAMEN.map((naam) => ({ id: 'p' + naam, naam, linie: '' }));

function wedstrijd(): Wedstrijd {
	const opstelling: Record<string, string | null> = {};
	FORMATIES['4-3-3'].forEach((p, i) => (opstelling[p[0]] = spelers[i].id));
	return {
		datum: '2026-09-06', tegenstander: 'Test', thuis: true, formatie: '4-3-3',
		opstelling, bank: ['pAmir'],
		gebeurtenissen: [{ type: 'start', t: 0 }],
		verstreken: 4200, sinds: null, loopt: false, helft: 2, afgelopen: true
	};
}

describe('speeltijd', () => {
	it('telt een wedstrijd zonder wissels als elf keer de speelduur', () => {
		const w = wedstrijd();
		w.gebeurtenissen.push({ type: 'eind', t: 4200 });
		const t = speeltijden(w, spelers);
		expect(t['pGijs']).toBe(4200);
		expect(t['pAmir']).toBe(0);
		expect(Object.values(t).reduce((a, b) => a + b, 0)).toBe(11 * 4200);
	});

	it('verdeelt de tijd over een wissel', () => {
		const w = wedstrijd();
		w.opstelling['SP'] = 'pAmir';
		w.bank = ['pMax'];
		w.gebeurtenissen.push({ type: 'wissel', t: 1200, eruit: 'pMax', erin: 'pAmir', plek: 'SP' });
		w.gebeurtenissen.push({ type: 'eind', t: 4200 });
		const t = speeltijden(w, spelers);
		expect(t['pMax']).toBe(1200);
		expect(t['pAmir']).toBe(3000);
		expect(Object.values(t).reduce((a, b) => a + b, 0)).toBe(11 * 4200);
	});

	it('houdt keeperminuten apart als er bij rust gedraaid wordt', () => {
		/* Gijs keept de eerste helft, gaat daarna linksback spelen.
		   Amir komt in het doel. Jouw regel: wie keept, speelt de rest volledig. */
		const w = wedstrijd();
		w.opstelling['K'] = 'pAmir';
		w.opstelling['LV'] = 'pGijs';
		w.bank = ['pMirza'];
		w.gebeurtenissen.push(
			{ type: 'rust', t: 2100 },
			{ type: 'wissel', t: 2100, eruit: 'pGijs', erin: 'pAmir', plek: 'K' },
			{ type: 'wissel', t: 2100, eruit: 'pMirza', erin: 'pGijs', plek: 'LV' },
			{ type: 'eind', t: 4200 }
		);
		const t = speeltijden(w, spelers);
		const k = keepertijden(w);
		expect(t['pGijs']).toBe(4200);
		expect(k['pGijs']).toBe(2100);
		expect(t['pAmir']).toBe(2100);
		expect(k['pAmir']).toBe(2100);
		expect(t['pMirza']).toBe(2100);
		expect(k['pMirza']).toBeUndefined();
		expect(Object.values(t).reduce((a, b) => a + b, 0)).toBe(11 * 4200);
	});

	it('laat geen plek onbezet als een wissel geen plek meekreeg', () => {
		const w = wedstrijd();
		w.opstelling['SP'] = 'pAmir';
		w.bank = ['pMax'];
		w.gebeurtenissen.push({ type: 'wissel', t: 2000, eruit: 'pMax', erin: 'pAmir' });
		w.gebeurtenissen.push({ type: 'eind', t: 4200 });
		expect(veldIntervallen(w)).toHaveLength(12);
		expect(Object.values(speeltijden(w, spelers)).reduce((a, b) => a + b, 0)).toBe(11 * 4200);
	});
});

describe('van plek ruilen tijdens de wedstrijd', () => {
	/* Jouw regel: wie een helft keept, speelt de andere helft in het veld. Vaak
	   ruil je bij rust met iemand die al op het veld staat. */
	it('houdt de totale tijd gelijk en telt alleen het doel apart', () => {
		const w = wedstrijd();
		/* Gijs keepte de eerste helft; bij rust ruilt hij met Kasper (middenveld) */
		w.opstelling['K'] = 'pKasper';
		w.opstelling['MC'] = 'pGijs';
		w.gebeurtenissen.push(
			{ type: 'rust', t: 2100 },
			{ type: 'ruil', t: 2100, plekA: 'K', plekB: 'MC' },
			{ type: 'eind', t: 4200 }
		);
		const t = speeltijden(w, spelers);
		const k = keepertijden(w);
		expect(t['pGijs']).toBe(4200);
		expect(t['pKasper']).toBe(4200);
		expect(k['pGijs']).toBe(2100);
		expect(k['pKasper']).toBe(2100);
		expect(Object.values(t).reduce((a, b) => a + b, 0)).toBe(11 * 4200);
	});

	it('werkt ook als er daarna nog gewisseld wordt', () => {
		const w = wedstrijd();
		w.opstelling['K'] = 'pKasper';
		w.opstelling['MC'] = 'pAmir';
		w.bank = ['pGijs'];
		w.gebeurtenissen.push(
			{ type: 'ruil', t: 2100, plekA: 'K', plekB: 'MC' },
			{ type: 'wissel', t: 3000, eruit: 'pGijs', erin: 'pAmir', plek: 'MC' },
			{ type: 'eind', t: 4200 }
		);
		const t = speeltijden(w, spelers);
		const k = keepertijden(w);
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
		const kort: Speler[] = NAMEN.slice(0, 10).map((naam) => ({ id: 'p' + naam, naam, linie: '' }));
		const opstelling: Record<string, string | null> = {};
		FORMATIES['1-3-3-1'].forEach((p, i) => (opstelling[p[0]] = kort[i].id));
		const w: Wedstrijd = {
			datum: '2026-09-06', tegenstander: 'Test', thuis: true, formatie: '1-3-3-1',
			opstelling, bank: [kort[8].id, kort[9].id],
			gebeurtenissen: [
				{ type: 'start', t: 0 },
				{ type: 'wissel', t: 1200, eruit: kort[7].id, erin: kort[8].id, plek: 'SP' },
				{ type: 'ruil', t: 1800, plekA: 'K', plekB: 'MC' },
				{ type: 'eind', t: 3600 }
			],
			verstreken: 3600, sinds: null, loopt: false, helft: 2, afgelopen: true
		};
		const t = speeltijden(w, kort);
		const k = keepertijden(w);
		expect(Object.values(t).reduce((a, b) => a + b, 0)).toBe(8 * 3600);
		expect(t['p' + NAMEN[7]]).toBe(1200);
		expect(k['p' + NAMEN[0]]).toBe(1800); /* keepte tot de ruil */
	});

	it('werkt ook zonder keeper, bij 4 tegen 4', () => {
		const kort: Speler[] = NAMEN.slice(0, 5).map((naam) => ({ id: 'p' + naam, naam, linie: '' }));
		const opstelling: Record<string, string | null> = {};
		FORMATIES['2-2'].forEach((p, i) => (opstelling[p[0]] = kort[i].id));
		const w: Wedstrijd = {
			datum: '2026-09-06', tegenstander: 'Test', thuis: true, formatie: '2-2',
			opstelling, bank: [kort[4].id],
			gebeurtenissen: [{ type: 'start', t: 0 }, { type: 'eind', t: 1800 }],
			verstreken: 1800, sinds: null, loopt: false, helft: 2, afgelopen: true
		};
		expect(Object.values(speeltijden(w, kort)).reduce((a, b) => a + b, 0)).toBe(4 * 1800);
		expect(keepertijden(w)).toEqual({});
	});
});
