import { describe, expect, it } from 'vitest';
import { verloopRegels, gebeurtenisTekst, verslagTekst } from './verslag';
import type { Gebeurtenis, Speler } from './types';

const spelers: Speler[] = [{ id: 'p1', naam: 'Aad', linie: 'A' }, { id: 'p2', naam: 'Bram', linie: 'M' }];
const bron = {
	datum: '2026-09-06', tegenstander: 'Ajax', thuis: true, teamnaam: 'JO11-2', stand: [2, 1] as [number, number],
	formatie: '4-3-3', duur: 4200,
	gebeurtenissen: [
		{ type: 'wissel' as const, t: 1200, eruit: 'p1', erin: 'p2', plek: 'SP' },
		{ type: 'goal' as const, t: 900, speler: 'p1' },
		{ type: 'tegen' as const, t: 1800 },
		{ type: 'goal' as const, t: 3000, speler: null }
	]
};

describe('verslag', () => {
	it('laat de wissels weg en zet de stand op volgorde van de klok', () => {
		const tekst = verslagTekst(bron, spelers);
		expect(tekst).toContain('JO11-2 – Ajax 2–1');
		expect(tekst).not.toContain('voor');
		expect(tekst.split('\n').slice(3)).toEqual([
			"15′  1–0  Aad",
			"30′  1–1  tegendoelpunt",
			"50′  2–1  doelpunt"
		]);
	});

	it('zet de wissels erbij als je dat wilt', () => {
		const tekst = verslagTekst(bron, spelers, true);
		expect(tekst).toContain('Bram voor Aad');
		expect(tekst.indexOf('15′')).toBeLessThan(tekst.indexOf('20′'));
	});

	it('draait de stand om bij een uitwedstrijd', () => {
		expect(verslagTekst({ ...bron, thuis: false }, spelers)).toContain('Ajax – JO11-2 1–2');
	});

	it('valt terug op een neutrale naam als er geen teamnaam is', () => {
		expect(verslagTekst({ ...bron, teamnaam: undefined }, spelers)).toContain('Ons team – Ajax');
		expect(verslagTekst({ ...bron, teamnaam: '  ' }, spelers)).toContain('Ons team – Ajax');
	});
});

describe('kwarten en een notitie', () => {
	it('benoemt de pauzes naar het deel', () => {
		const g = { type: 'rust' as const, t: 900, deel: 1 };
		expect(gebeurtenisTekst(g, spelers, undefined, 4)).toBe('Pauze — 1e kwart voorbij');
		expect(gebeurtenisTekst({ ...g, deel: 2 }, spelers, undefined, 4)).toBe('Rust — 2e kwart voorbij');
		expect(gebeurtenisTekst({ ...g, deel: 1 }, spelers, undefined, 2)).toBe('Rust — 1e helft voorbij');
	});

	it('zet de notitie onderaan het verslag', () => {
		const tekst = verslagTekst({ ...bron, notitie: '  Sterk begin.  ' }, spelers);
		expect(tekst.endsWith('\n\nSterk begin.')).toBe(true);
	});

	it('laat het verslag met rust als er niets geschreven is', () => {
		expect(verslagTekst({ ...bron, notitie: '   ' }, spelers).endsWith('doelpunt')).toBe(true);
	});
});

describe('van plek ruilen in het verloop', () => {
	/* Waar ze naartoe gingen zegt meer dan dat er iets wisselde. */
	it('noemt wie waar naartoe ging', () => {
		const g = { type: 'ruil' as const, t: 800, plekA: 'K', plekB: 'SP', spelerA: 'p1', spelerB: 'p2' };
		expect(gebeurtenisTekst(g, spelers, undefined, 2, '4-3-3')).toBe('Aad naar SP, Bram naar K');
	});

	it('gebruikt de leesbare naam van de plek', () => {
		const g = { type: 'ruil' as const, t: 800, plekA: 'CVl', plekB: 'TIEN', spelerA: 'p1', spelerB: 'p2' };
		expect(gebeurtenisTekst(g, spelers, undefined, 2, '4-4-2 ruit')).toBe('Aad naar 10, Bram naar CV');
	});

	it('houdt oude wedstrijden zonder namen leesbaar', () => {
		const g = { type: 'ruil' as const, t: 800, plekA: 'K', plekB: 'SP' };
		expect(gebeurtenisTekst(g, spelers, undefined, 2, '4-3-3')).toBe('Van plek gewisseld: K en SP');
	});
});

describe('een wissel in het verloop', () => {
	it('zegt er ook bij op welke plek', () => {
		const g = { type: 'wissel' as const, t: 800, plek: 'TIEN', eruit: 'p1', erin: 'p2' };
		expect(gebeurtenisTekst(g, spelers, undefined, 2, '4-4-2 ruit')).toBe('Bram voor Aad op 10');
	});
});

describe('ruilen op hetzelfde moment samenvatten', () => {
	/* Een rondje van vier kan niet in minder dan drie paarsgewijze ruilen. Zonder
	   samenvatten lijkt iemand in dezelfde seconde twee keer te verhuizen. */
	it('maakt van een rondje van vier één regel met de netto verhuizing', () => {
		const vier: Speler[] = [
			{ id: 'a', naam: 'Maher', linie: '' },
			{ id: 'b', naam: 'Kasper', linie: '' },
			{ id: 'c', naam: 'Jack', linie: '' },
			{ id: 'd', naam: 'Zenith', linie: '' }
		];
		/* voor: K=Maher, VM=Kasper, CVr=Jack, RV=Zenith */
		const g: Gebeurtenis[] = [
			{ type: 'ruil', t: 2110, plekA: 'K', plekB: 'VM', spelerA: 'a', spelerB: 'b' },
			{ type: 'ruil', t: 2110, plekA: 'CVr', plekB: 'RV', spelerA: 'c', spelerB: 'd' },
			{ type: 'ruil', t: 2110, plekA: 'VM', plekB: 'CVr', spelerA: 'a', spelerB: 'd' }
		];
		const regels = verloopRegels(g, vier, undefined, 2, '4-4-2 ruit');
		expect(regels).toHaveLength(1);
		expect(regels[0].tekst).toBe('Maher naar CV, Kasper naar K, Jack naar RV, Zenith naar VM');
	});

	it('laat ruilen op verschillende tijdstippen apart staan', () => {
		const g: Gebeurtenis[] = [
			{ type: 'ruil', t: 100, plekA: 'K', plekB: 'SP', spelerA: 'p1', spelerB: 'p2' },
			{ type: 'ruil', t: 200, plekA: 'K', plekB: 'SP', spelerA: 'p2', spelerB: 'p1' }
		];
		expect(verloopRegels(g, spelers, undefined, 2, '4-3-3')).toHaveLength(2);
	});

	it('houdt de plek in de lijst kloppend, zodat een doelpunt te wissen blijft', () => {
		const g: Gebeurtenis[] = [
			{ type: 'ruil', t: 100, plekA: 'K', plekB: 'SP', spelerA: 'p1', spelerB: 'p2' },
			{ type: 'ruil', t: 100, plekA: 'SP', plekB: 'K', spelerA: 'p1', spelerB: 'p2' },
			{ type: 'goal', t: 300, speler: 'p1' }
		];
		const regels = verloopRegels(g, spelers, undefined, 2, '4-3-3');
		const doelpunt = regels.find((r) => r.type === 'goal');
		expect(doelpunt?.index).toBe(2);
	});
});
