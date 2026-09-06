import { describe, expect, it } from 'vitest';
import { timelineRows, eventText, reportText } from './report';
import type { MatchEvent, Player } from './types';

const players: Player[] = [
	{ id: 'p1', name: 'Aad', line: 'A' },
	{ id: 'p2', name: 'Bram', line: 'M' }
];
const bron = {
	date: '2026-09-06',
	opponent: 'Ajax',
	home: true,
	teamName: 'JO11-2',
	score: [2, 1] as [number, number],
	formation: '4-3-3',
	duration: 4200,
	events: [
		{ type: 'substitution' as const, t: 1200, off: 'p1', on: 'p2', position: 'SP' },
		{ type: 'goal' as const, t: 900, player: 'p1' },
		{ type: 'conceded' as const, t: 1800 },
		{ type: 'goal' as const, t: 3000, player: null }
	]
};

describe('verslag', () => {
	it('laat de wissels weg en zet de stand op volgorde van de klok', () => {
		const tekst = reportText(bron, players);
		expect(tekst).toContain('JO11-2 – Ajax 2–1');
		expect(tekst).not.toContain('voor');
		expect(tekst.split('\n').slice(3)).toEqual(['15′  1–0  Aad', '30′  1–1  tegendoelpunt', '50′  2–1  doelpunt']);
	});

	it('zet de wissels erbij als je dat wilt', () => {
		const tekst = reportText(bron, players, true);
		expect(tekst).toContain('Bram voor Aad');
		expect(tekst.indexOf('15′')).toBeLessThan(tekst.indexOf('20′'));
	});

	it('draait de stand om bij een uitwedstrijd', () => {
		expect(reportText({ ...bron, home: false }, players)).toContain('Ajax – JO11-2 1–2');
	});

	it('valt terug op een neutrale naam als er geen teamnaam is', () => {
		expect(reportText({ ...bron, teamName: undefined }, players)).toContain('Ons team – Ajax');
		expect(reportText({ ...bron, teamName: '  ' }, players)).toContain('Ons team – Ajax');
	});
});

describe('kwarten en een notitie', () => {
	it('benoemt de pauzes naar het deel', () => {
		const g = { type: 'break' as const, t: 900, part: 1 };
		expect(eventText(g, players, undefined, 4)).toBe('Pauze — 1e kwart voorbij');
		expect(eventText({ ...g, part: 2 }, players, undefined, 4)).toBe('Rust — 2e kwart voorbij');
		expect(eventText({ ...g, part: 1 }, players, undefined, 2)).toBe('Rust — 1e helft voorbij');
	});

	it('zet de notitie onderaan het verslag', () => {
		const tekst = reportText({ ...bron, note: '  Sterk begin.  ' }, players);
		expect(tekst.endsWith('\n\nSterk begin.')).toBe(true);
	});

	it('laat het verslag met rust als er niets geschreven is', () => {
		expect(reportText({ ...bron, note: '   ' }, players).endsWith('doelpunt')).toBe(true);
	});
});

describe('van plek ruilen in het verloop', () => {
	/* Waar ze naartoe gingen zegt meer dan dat er iets wisselde. */
	it('noemt wie waar naartoe ging', () => {
		const g = { type: 'swap' as const, t: 800, positionA: 'K', positionB: 'SP', playerA: 'p1', playerB: 'p2' };
		expect(eventText(g, players, undefined, 2, '4-3-3')).toBe('Aad naar SP, Bram naar K');
	});

	it('gebruikt de leesbare naam van de plek', () => {
		const g = { type: 'swap' as const, t: 800, positionA: 'CVl', positionB: 'TEN', playerA: 'p1', playerB: 'p2' };
		expect(eventText(g, players, undefined, 2, '4-4-2 diamond')).toBe('Aad naar 10, Bram naar CV');
	});

	it('houdt oude wedstrijden zonder namen leesbaar', () => {
		const g = { type: 'swap' as const, t: 800, positionA: 'K', positionB: 'SP' };
		expect(eventText(g, players, undefined, 2, '4-3-3')).toBe('Van plek gewisseld: K en SP');
	});
});

describe('een wissel in het verloop', () => {
	it('zegt er ook bij op welke plek', () => {
		const g = { type: 'substitution' as const, t: 800, position: 'TEN', off: 'p1', on: 'p2' };
		expect(eventText(g, players, undefined, 2, '4-4-2 diamond')).toBe('Bram voor Aad op 10');
	});
});

describe('ruilen op hetzelfde moment samenvatten', () => {
	/* Een rondje van vier kan niet in minder dan drie paarsgewijze ruilen. Zonder
	   samenvatten lijkt iemand in dezelfde seconde twee keer te verhuizen. */
	it('maakt van een rondje van vier één regel met de netto verhuizing', () => {
		const vier: Player[] = [
			{ id: 'a', name: 'Maher', line: '' },
			{ id: 'b', name: 'Kasper', line: '' },
			{ id: 'c', name: 'Jack', line: '' },
			{ id: 'd', name: 'Zenith', line: '' }
		];
		/* voor: K=Maher, VM=Kasper, CVr=Jack, RV=Zenith */
		const g: MatchEvent[] = [
			{ type: 'swap', t: 2110, positionA: 'K', positionB: 'VM', playerA: 'a', playerB: 'b' },
			{ type: 'swap', t: 2110, positionA: 'CVr', positionB: 'RV', playerA: 'c', playerB: 'd' },
			{ type: 'swap', t: 2110, positionA: 'VM', positionB: 'CVr', playerA: 'a', playerB: 'd' }
		];
		const regels = timelineRows(g, vier, undefined, 2, '4-4-2 diamond');
		expect(regels).toHaveLength(1);
		expect(regels[0].tekst).toBe('Maher naar CV, Kasper naar K, Jack naar RV, Zenith naar VM');
	});

	it('laat ruilen op verschillende tijdstippen apart staan', () => {
		const g: MatchEvent[] = [
			{ type: 'swap', t: 100, positionA: 'K', positionB: 'SP', playerA: 'p1', playerB: 'p2' },
			{ type: 'swap', t: 200, positionA: 'K', positionB: 'SP', playerA: 'p2', playerB: 'p1' }
		];
		expect(timelineRows(g, players, undefined, 2, '4-3-3')).toHaveLength(2);
	});

	it('houdt de plek in de lijst kloppend, zodat een doelpunt te wissen blijft', () => {
		const g: MatchEvent[] = [
			{ type: 'swap', t: 100, positionA: 'K', positionB: 'SP', playerA: 'p1', playerB: 'p2' },
			{ type: 'swap', t: 100, positionA: 'SP', positionB: 'K', playerA: 'p1', playerB: 'p2' },
			{ type: 'goal', t: 300, player: 'p1' }
		];
		const regels = timelineRows(g, players, undefined, 2, '4-3-3');
		const goal = regels.find((r) => r.type === 'goal');
		expect(goal?.index).toBe(2);
	});
});
