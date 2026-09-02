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
