import { describe, expect, it } from 'vitest';
import { coachVraag, controleerVoorstel, uniekeNamen, type CoachDoel, type CoachVoorstel } from './coach';
import { emptyState, type ArchivedMatch, type Player, type State } from './types';

/*
 * Wat er naar de assistent gaat en wat er terugkomt. Het denkwerk zit op de
 * server; hier ligt vast dat er alleen heen gaat wat nodig is, en dat er alleen
 * een opstelling terugkomt die ook echt kan.
 */
const SPELERS: Player[] = [
	{ id: 'k1', name: 'Bram', line: 'V', keeper: true },
	{ id: 'v1', name: 'Cas', line: 'V' },
	{ id: 'v2', name: 'Dirk', line: 'V' },
	{ id: 'm1', name: 'Eef', line: 'M' },
	{ id: 'a1', name: 'Finn', line: 'A' },
	{ id: 'b1', name: 'Gijs', line: 'A' },
	{ id: 'h1', name: 'Hugo', line: 'M' },
	{ id: 'w1', name: 'Siem', line: 'M' }
];

/* Gijs begon op de bank en kwam er na twintig minuten in voor Finn. */
const VORIGE: ArchivedMatch = {
	date: '2026-09-13',
	opponent: 'Buitenboys',
	home: false,
	score: [5, 3],
	formation: '1-2-2-1',
	duration: 2400,
	parts: 2,
	absent: ['w1'],
	note: 'Gijs speelde sterk.',
	events: [
		{ type: 'start', t: 0 },
		{ type: 'goal', t: 300, player: 'a1', assist: 'm1' },
		{ type: 'substitution', t: 1200, position: 'SP', off: 'a1', on: 'b1' }
	] as never,
	lineup: { K: 'k1', LV: 'v1', RV: 'v2', MR: 'm1', ML: 'h1', SP: 'b1' },
	bench: ['a1'],
	playingTime: [
		{ id: 'k1', name: 'Bram', seconds: 2400, keeper: 2400, positions: { K: 2400 } },
		{ id: 'v1', name: 'Cas', seconds: 2400, positions: { LV: 2400 } },
		{ id: 'v2', name: 'Dirk', seconds: 2400, positions: { RV: 2400 } },
		{ id: 'm1', name: 'Eef', seconds: 2400, positions: { MR: 2400 } },
		{ id: 'h1', name: 'Hugo', seconds: 2400, positions: { ML: 2400 } },
		{ id: 'a1', name: 'Finn', seconds: 1200, positions: { SP: 1200 } },
		{ id: 'b1', name: 'Gijs', seconds: 1200, positions: { SP: 1200 } }
	],
	teamName: 'Geheim team',
	names: { k1: 'Bram' }
};

function toestand(): State {
	const t = emptyState();
	t.teamName = 'Geheim team';
	t.players = SPELERS.map((p) => ({ ...p }));
	t.archive = [VORIGE];
	t.trainings = [
		{ id: 't2', date: '2026-09-18', status: { b1: 'present', a1: 'absent' } },
		{ id: 't1', date: '2026-09-11', status: { b1: 'excused', a1: 'present' } }
	];
	return t;
}

const DOEL: CoachDoel = {
	formation: '1-2-2-1',
	lineup: { K: 'k1', LV: 'v1', RV: 'v2', MR: 'm1', ML: 'h1', SP: 'a1' },
	bench: ['b1'],
	absent: ['w1']
};

describe('wat er naar de assistent gaat', () => {
	it('stuurt de vraag, de formatie en de plekken mee', () => {
		const v = coachVraag(toestand(), DOEL, '  Morgen tegen de nummer 1.  ');
		expect(v.vraag).toBe('Morgen tegen de nummer 1.');
		expect(v.formatie).toBe('1-2-2-1');
		expect(v.plekken.map((p) => p.code)).toEqual(['K', 'RV', 'LV', 'MR', 'ML', 'SP']);
		expect(v.plekken[0].linie).toBe('Keeper');
	});

	it('zet bank, training en doelpunten per speler erbij', () => {
		const gijs = coachVraag(toestand(), DOEL, '').spelers.find((s) => s.naam === 'Gijs')!;
		expect(gijs.bank).toEqual({ wedstrijden: 1, bankMinuten: 20, begonOpBank: 1, beginBekend: 1 });
		expect(gijs.training).toEqual({ aanwezig: 1, van: 2, laatste: ['aanwezig', 'afgemeld'] });
		const finn = coachVraag(toestand(), DOEL, '').spelers.find((s) => s.naam === 'Finn')!;
		expect(finn.doelpunten).toBe(1);
		expect(finn.training.laatste).toEqual(['niet gekomen', 'aanwezig']);
	});

	it('zegt wie er vandaag niet is', () => {
		const v = coachVraag(toestand(), DOEL, '');
		expect(v.spelers.find((s) => s.naam === 'Siem')!.afwezig).toBe(true);
		expect(v.spelers.find((s) => s.naam === 'Gijs')!.afwezig).toBe(false);
	});

	it('beschrijft een gespeelde wedstrijd zoals je hem vertelt', () => {
		const [w] = coachVraag(toestand(), DOEL, '').wedstrijden;
		expect(w.uitslag).toBe('3-5 (uit, gewonnen)');
		expect(w.basis).toEqual({ K: 'Bram', LV: 'Cas', RV: 'Dirk', MR: 'Eef', ML: 'Hugo', SP: 'Finn' });
		expect(w.afwezig).toEqual(['Siem']);
		expect(w.notitie).toBe('Gijs speelde sterk.');
		expect(w.verloop).toContain('5′ Doelpunt — Finn (assist Eef)');
		expect(w.verloop.some((r) => r.startsWith('20′ Gijs voor Finn'))).toBe(true);
		expect(w.speeltijd.find((r) => r.naam === 'Bram')).toEqual({
			naam: 'Bram',
			minuten: 40,
			keeperMinuten: 40,
			perPlek: { K: 40 }
		});
	});

	it('stuurt de opstelling zoals hij nu staat op naam mee', () => {
		expect(coachVraag(toestand(), DOEL, '').opstellingNu).toEqual({
			plekken: { K: 'Bram', RV: 'Dirk', LV: 'Cas', MR: 'Eef', ML: 'Hugo', SP: 'Finn' },
			bank: ['Gijs']
		});
	});

	it('stuurt bij het bijsturen het vorige voorstel en de wensen mee', () => {
		const vorige = {
			voorstel: {
				samenvatting: 'Gijs op de bank.',
				opstelling: [],
				bank: ['Gijs'],
				wisselplan: [],
				redenen: [],
				aandachtspunten: []
			},
			bijsturingen: ['Gijs moet beginnen.']
		};
		expect(coachVraag(toestand(), DOEL, 'Morgen.', vorige).vorige).toEqual(vorige);
		expect('vorige' in coachVraag(toestand(), DOEL, 'Morgen.')).toBe(false);
	});

	/* Alleen wat nodig is voor een opstelling. */
	it('stuurt geen teamnaam, id of e-mailadres mee', () => {
		const t = toestand();
		const tekst = JSON.stringify(coachVraag(t, DOEL, ''));
		expect(tekst).not.toContain('Geheim team');
		for (const p of SPELERS) expect(tekst).not.toContain(`"${p.id}"`);
		expect(tekst).not.toContain('@');
	});
});

describe('namen die maar één keer voorkomen', () => {
	it('nummert een tweede speler met dezelfde naam', () => {
		const namen = uniekeNamen([
			{ id: 'x', name: 'Daan', line: 'V' },
			{ id: 'y', name: 'Daan', line: 'M' },
			{ id: 'z', name: 'Daanish', line: 'M' }
		]);
		expect([...namen.values()]).toEqual(['Daan', 'Daan (2)', 'Daanish']);
	});
});

describe('wat er terugkomt', () => {
	const voorstel = (opstelling: CoachVoorstel['opstelling']): CoachVoorstel => ({
		samenvatting: '',
		opstelling,
		bank: [],
		wisselplan: [],
		redenen: [],
		aandachtspunten: []
	});
	const GOED = [
		{ plek: 'K', speler: 'Bram' },
		{ plek: 'LV', speler: 'Cas' },
		{ plek: 'RV', speler: 'Dirk' },
		{ plek: 'MR', speler: 'Eef' },
		{ plek: 'ML', speler: 'Hugo' },
		{ plek: 'SP', speler: 'Gijs' }
	];

	it('vertaalt een goed voorstel naar een opstelling met wie er over is op de bank', () => {
		const c = controleerVoorstel(voorstel(GOED), SPELERS, DOEL);
		expect(c.problemen).toEqual([]);
		expect(c.lineup).toEqual({ K: 'k1', LV: 'v1', RV: 'v2', MR: 'm1', ML: 'h1', SP: 'b1' });
		/* Siem is afgemeld: die hoort ook niet op de bank */
		expect(c.bench).toEqual(['a1']);
	});

	it('houdt een speler die twee keer op het veld staat tegen', () => {
		const c = controleerVoorstel(voorstel([...GOED.slice(0, 5), { plek: 'SP', speler: 'Eef' }]), SPELERS, DOEL);
		expect(c.problemen).toContain('Eef staat twee keer op het veld.');
	});

	it('houdt een lege plek tegen', () => {
		expect(controleerVoorstel(voorstel(GOED.slice(0, 5)), SPELERS, DOEL).problemen).toContain(
			'Er staat niemand op SP.'
		);
	});

	it('houdt een afgemelde of onbekende speler tegen', () => {
		const c = controleerVoorstel(
			voorstel([...GOED.slice(0, 4), { plek: 'ML', speler: 'Siem' }, { plek: 'SP', speler: 'Zlatan' }]),
			SPELERS,
			DOEL
		);
		expect(c.problemen).toContain('Siem is vandaag afgemeld.');
		expect(c.problemen).toContain('Zlatan staat niet in de selectie.');
	});

	it('houdt een plek die niet in de formatie zit tegen', () => {
		expect(controleerVoorstel(voorstel([...GOED, { plek: 'TEN', speler: 'Finn' }]), SPELERS, DOEL).problemen).toContain(
			'Plek TEN bestaat niet in 1-2-2-1.'
		);
	});

	/* Een veldspeler in het doel kan een keuze zijn. Zeggen, niet tegenhouden. */
	it('zegt het als er iemand keept die dat normaal niet doet', () => {
		const c = controleerVoorstel(
			voorstel([{ plek: 'K', speler: 'Cas' }, { plek: 'LV', speler: 'Bram' }, ...GOED.slice(2)]),
			SPELERS,
			DOEL
		);
		expect(c.problemen).toEqual([]);
		expect(c.opmerkingen).toEqual(['Cas staat in het doel, maar keept normaal niet.']);
	});
});
