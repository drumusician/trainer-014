import { beforeEach, describe, expect, it } from 'vitest';
import { app } from './toestand.svelte';
import { legeToestand } from './domein/types';

beforeEach(() => {
	localStorage.clear();
	app.toestand = legeToestand();
	app.toestand.spelers = [
		{ id: 'p1', naam: 'Daanish', linie: 'M' },
		{ id: 'p2', naam: 'Gijs', linie: '', keept: true }
	];
});

describe('trainingen', () => {
	/* Deze ging mis: de winkel gaf het kale object terug, maar in de toestand
	   staat een proxy. indexOf() vond hem dus niet en je landde op een leeg
	   scherm. Sindsdien zoeken we op id. */
	it('geeft een nieuwe training terug die je meteen kunt opzoeken', () => {
		const t = app.nieuweTraining();
		expect(t.id).toBeTruthy();
		expect(app.trainingMetId(t.id)).toBeDefined();
		expect(app.trainingMetId(t.id)!.datum).toBe(t.datum);
	});

	it('zet iedereen op aanwezig en laat je langs de standen tikken', () => {
		const t = app.trainingMetId(app.nieuweTraining().id)!;
		expect(t.status.p1).toBe('ja');
		app.tikPresentie(t, 'p1');
		expect(app.trainingMetId(t.id)!.status.p1).toBe('af');
		app.tikPresentie(t, 'p1');
		expect(app.trainingMetId(t.id)!.status.p1).toBe('nee');
		app.tikPresentie(t, 'p1');
		expect(app.trainingMetId(t.id)!.status.p1).toBe('ja');
	});

	it('houdt het adres kloppend als een datum de volgorde omgooit', () => {
		const eerste = app.nieuweTraining();
		const tweede = app.nieuweTraining();
		app.zetTrainingDatum(app.trainingMetId(tweede.id)!, '2020-01-01');
		expect(app.toestand.trainingen[1].id).toBe(tweede.id); /* naar achteren gesorteerd */
		expect(app.trainingMetId(eerste.id)).toBeDefined();
		expect(app.trainingMetId(tweede.id)!.datum).toBe('2020-01-01');
	});

	it('verwijdert alleen de training die je aanwijst', () => {
		const eerste = app.nieuweTraining();
		const tweede = app.nieuweTraining();
		app.verwijderTraining(app.trainingMetId(eerste.id)!);
		expect(app.trainingMetId(eerste.id)).toBeUndefined();
		expect(app.trainingMetId(tweede.id)).toBeDefined();
	});

	it('geeft oude trainingen zonder id er alsnog een bij het laden', () => {
		localStorage.setItem(
			'o14-app-v1',
			JSON.stringify({ ...legeToestand(), spelers: app.toestand.spelers, trainingen: [{ datum: '2026-09-02', status: {} }] })
		);
		app.laad();
		expect(app.toestand.trainingen[0].id).toBeTruthy();
	});
});

describe('wie is er vandaag', () => {
	it('haalt een afwezige uit veld en bank, en zet hem daarna op de bank', () => {
		app.nieuweWedstrijd('Sparta', true);
		app.toestand.wedstrijd!.opstelling = { K: 'p2', SP: 'p1' };
		app.herzetBank();
		expect(app.toestand.wedstrijd!.bank).toEqual([]);

		app.zetAfwezig('p2', true);
		expect(app.toestand.wedstrijd!.opstelling.K).toBeNull();
		expect(app.toestand.wedstrijd!.bank).not.toContain('p2');

		app.zetAfwezig('p2', false);
		expect(app.toestand.wedstrijd!.bank).toContain('p2');
	});

	/* Dit ging mis: de speeltijd wordt teruggerekend vanaf de opstelling van nu,
	   dus wie je daar tijdens de wedstrijd uithaalt heeft volgens die berekening
	   nooit gespeeld. Een hele wedstrijd werd stilletjes nul minuten. */
	it('laat het veld met rust zodra de wedstrijd loopt', () => {
		app.nieuweWedstrijd('Sparta', true);
		app.toestand.wedstrijd!.opstelling = { K: 'p2', SP: 'p1' };
		app.herzetBank();
		app.toestand.wedstrijd!.gebeurtenissen = [{ type: 'start', t: 0 }];

		app.zetAfwezig('p2', true);
		expect(app.toestand.wedstrijd!.opstelling.K).toBe('p2');
		expect(app.toestand.wedstrijd!.afwezig ?? []).not.toContain('p2');
	});

	it('laat wie op de bank zit ook na de aftrap afmelden', () => {
		app.nieuweWedstrijd('Sparta', true);
		app.toestand.wedstrijd!.opstelling = { K: 'p2' };
		app.herzetBank();
		app.toestand.wedstrijd!.gebeurtenissen = [{ type: 'start', t: 0 }];
		expect(app.toestand.wedstrijd!.bank).toContain('p1');

		app.zetAfwezig('p1', true);
		expect(app.toestand.wedstrijd!.bank).not.toContain('p1');
		expect(app.toestand.wedstrijd!.afwezig).toContain('p1');
	});
});

describe('de klok', () => {
	it('schuift met minuten maar nooit onder nul', () => {
		app.nieuweWedstrijd('Sparta', true);
		app.toestand.wedstrijd!.verstreken = 100;
		app.verschuifKlok(60);
		expect(app.toestand.wedstrijd!.verstreken).toBe(160);
		app.verschuifKlok(-600);
		expect(app.toestand.wedstrijd!.verstreken).toBe(0);
	});
});

describe('een bewaarde wedstrijd bijwerken', () => {
	function metArchief() {
		app.toestand.archief = [
			{
				datum: '2026-08-30', tegenstander: 'Ajx', thuis: true, stand: [1, 1], formatie: '4-3-3', duur: 4200,
				namen: { p1: 'Daanish', p2: 'Gijs' },
				gebeurtenissen: [
					{ type: 'start', t: 0 },
					{ type: 'goal', t: 900, speler: 'p1' },
					{ type: 'wissel', t: 1200, eruit: 'p1', erin: 'p2', plek: 'SP' },
					{ type: 'tegen', t: 1800 },
					{ type: 'eind', t: 4200 }
				],
				speeltijd: [{ id: 'p1', naam: 'Daanish', seconden: 1200, keeper: 0 }]
			}
		];
	}

	it('verbetert de naam van de tegenstander', () => {
		metArchief();
		app.wijzigArchief(0, { tegenstander: 'Ajax', thuis: false });
		expect(app.toestand.archief[0].tegenstander).toBe('Ajax');
		expect(app.toestand.archief[0].thuis).toBe(false);
	});

	it('haalt een doelpunt weg en telt de stand opnieuw', () => {
		metArchief();
		app.verwijderDoelpunt(0, 1);
		expect(app.toestand.archief[0].stand).toEqual([0, 1]);
		expect(app.toestand.archief[0].gebeurtenissen).toHaveLength(4);
	});

	it('laat wissels met rust, want daar hangt de speeltijd aan', () => {
		metArchief();
		app.verwijderDoelpunt(0, 2); /* de wissel */
		expect(app.toestand.archief[0].gebeurtenissen).toHaveLength(5);
	});

	it('zet een vergeten doelpunt op de goede plek in het verloop', () => {
		metArchief();
		app.voegDoelpuntToe(0, 20, 'p2');
		const g = app.toestand.archief[0].gebeurtenissen;
		expect(g.map((x) => x.t)).toEqual([0, 900, 1200, 1200, 1800, 4200]);
		expect(app.toestand.archief[0].stand).toEqual([2, 1]);
		app.voegDoelpuntToe(0, 55, null, true);
		expect(app.toestand.archief[0].stand).toEqual([2, 2]);
	});
});

describe('schuiven in de opstelling', () => {
	beforeEach(() => {
		app.toestand.standaard = {
			formatie: '4-3-3',
			opstelling: { K: 'p2', SP: 'p1', LV: null },
			bank: []
		};
	});

	it('wisselt twee spelers van plek', () => {
		app.ruilPlekken('standaard', 'K', 'SP');
		expect(app.toestand.standaard!.opstelling).toMatchObject({ K: 'p1', SP: 'p2' });
	});

	it('verhuist iemand naar een lege plek', () => {
		app.ruilPlekken('standaard', 'SP', 'LV');
		expect(app.toestand.standaard!.opstelling.SP).toBeNull();
		expect(app.toestand.standaard!.opstelling.LV).toBe('p1');
	});

	it('doet niets als je twee lege plekken ruilt', () => {
		app.toestand.standaard!.opstelling = { LV: null, RV: null };
		app.ruilPlekken('standaard', 'LV', 'RV');
		expect(app.toestand.standaard!.opstelling).toMatchObject({ LV: null, RV: null });
	});

	it('haalt iemand van het veld naar de bank en laat de plek leeg', () => {
		app.haalVanVeld('standaard', 'SP');
		expect(app.toestand.standaard!.opstelling.SP).toBeNull();
		expect(app.toestand.standaard!.bank).toContain('p1');
	});

	it('zet niemand dubbel op de bank', () => {
		app.toestand.standaard!.bank = ['p1'];
		app.haalVanVeld('standaard', 'SP');
		expect(app.toestand.standaard!.bank.filter((id) => id === 'p1')).toHaveLength(1);
	});
});

describe('ruilen tijdens de wedstrijd', () => {
	it('legt de ruil vast in het verloop', () => {
		app.nieuweWedstrijd('Sparta', true);
		app.toestand.wedstrijd!.opstelling = { K: 'p2', SP: 'p1' };
		app.toestand.wedstrijd!.gebeurtenissen = [{ type: 'start', t: 0 }];
		app.ruilInWedstrijd('K', 'SP');
		const w = app.toestand.wedstrijd!;
		expect(w.opstelling).toMatchObject({ K: 'p1', SP: 'p2' });
		expect(w.gebeurtenissen.at(-1)).toMatchObject({ type: 'ruil', plekA: 'K', plekB: 'SP' });
	});
});

describe('klaarstaan of bezig', () => {
	it('is pas begonnen als de klok gelopen heeft', () => {
		app.nieuweWedstrijd('Sparta', true);
		app.toestand.wedstrijd!.opstelling = { K: 'p2', SP: 'p1' };
		expect(app.gestart).toBe(false);
		app.loopToggle();
		expect(app.gestart).toBe(true);
	});

	it('legt een ruil voor de aftrap niet vast als gebeurtenis', () => {
		app.nieuweWedstrijd('Sparta', true);
		app.toestand.wedstrijd!.opstelling = { K: 'p2', SP: 'p1' };
		app.ruilInWedstrijd('K', 'SP');
		expect(app.toestand.wedstrijd!.gebeurtenissen).toHaveLength(0);
		expect(app.toestand.wedstrijd!.opstelling).toMatchObject({ K: 'p1', SP: 'p2' });
	});

	it('legt een ruil ná de aftrap wel vast', () => {
		app.nieuweWedstrijd('Sparta', true);
		app.toestand.wedstrijd!.opstelling = { K: 'p2', SP: 'p1' };
		app.loopToggle();
		app.ruilInWedstrijd('K', 'SP');
		expect(app.toestand.wedstrijd!.gebeurtenissen.at(-1)).toMatchObject({ type: 'ruil' });
	});
});

describe('wie er die dag was, bewaren', () => {
	it('legt de afwezigen vast bij de wedstrijd', () => {
		app.nieuweWedstrijd('Sparta', true);
		app.toestand.wedstrijd!.opstelling = { K: 'p1' };
		app.zetAfwezig('p2', true);
		app.beeindig();
		app.bewaarInArchief();
		const a = app.toestand.archief[0];
		expect(a.afwezig).toEqual(['p2']);
		/* nul minuten betekent nu iets anders voor wie er wel was */
		expect(a.speeltijd.find((r) => r.id === 'p2')!.seconden).toBe(0);
	});

	it('bewaart een lege lijst als iedereen er was', () => {
		app.nieuweWedstrijd('Sparta', true);
		app.toestand.wedstrijd!.opstelling = { K: 'p1' };
		app.beeindig();
		app.bewaarInArchief();
		expect(app.toestand.archief[0].afwezig).toEqual([]);
	});
});

describe('kwarten spelen', () => {
	function metKwarten() {
		app.toestand.delen = 4;
		app.nieuweWedstrijd('Sparta', true);
		app.toestand.wedstrijd!.opstelling = { K: 'p1' };
		return app.toestand.wedstrijd!;
	}

	it('neemt de speelwijze over van de instelling', () => {
		expect(metKwarten().delen).toBe(4);
	});

	it('loopt door vier kwarten met een pauze ertussen', () => {
		const w = metKwarten();
		app.loopToggle();
		expect(w.deel).toBe(1);

		app.deelToggle(); /* einde 1e kwart */
		expect(w.pauze).toBe(true);
		expect(w.loopt).toBe(false);
		expect(w.gebeurtenissen.at(-1)).toMatchObject({ type: 'rust', deel: 1 });

		app.deelToggle(); /* 2e kwart begint */
		expect(w.deel).toBe(2);
		expect(w.pauze).toBe(false);
		expect(w.loopt).toBe(true);

		app.deelToggle();
		app.deelToggle();
		app.deelToggle();
		app.deelToggle();
		expect(w.deel).toBe(4);
		expect(app.magVolgendDeel).toBe(false); /* na het laatste kwart houdt het op */
	});

	it('houdt twee helften gewoon zoals het was', () => {
		app.toestand.delen = 2;
		app.nieuweWedstrijd('Sparta', true);
		const w = app.toestand.wedstrijd!;
		app.loopToggle();
		app.deelToggle();
		expect(w.pauze).toBe(true);
		app.deelToggle();
		expect(w.deel).toBe(2);
		expect(app.magVolgendDeel).toBe(false);
	});

	it('bewaart de speelwijze en de notitie in het archief', () => {
		const w = metKwarten();
		app.zetNotitie('Sterk begin, na rust weggezakt.');
		app.beeindig();
		app.bewaarInArchief();
		expect(app.toestand.archief[0].delen).toBe(4);
		expect(app.toestand.archief[0].notitie).toBe('Sterk begin, na rust weggezakt.');
	});

	it('vertaalt een oude wedstrijd met helften naar de nieuwe vorm', () => {
		localStorage.setItem(
			'o14-app-v1',
			JSON.stringify({
				...legeToestand(),
				spelers: app.toestand.spelers,
				wedstrijd: {
					datum: '2026-09-06', tegenstander: 'Oud', thuis: true, formatie: '4-3-3', opstelling: {},
					bank: [], gebeurtenissen: [], verstreken: 0, sinds: null, loopt: false, helft: 2, afgelopen: false
				}
			})
		);
		app.laad();
		expect(app.toestand.wedstrijd).toMatchObject({ delen: 2, deel: 2, pauze: false });
	});
});

describe('van formatie wisselen met een standaardopstelling', () => {
	beforeEach(() => {
		app.toestand.spelers = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l'].map((n, i) => ({
			id: 'p' + n,
			naam: n.toUpperCase(),
			linie: i === 0 ? '' : i <= 4 ? 'V' : i <= 7 ? 'M' : 'A',
			keept: i === 0
		}));
		app.toestand.formatie = '4-3-3';
		app.toestand.standaard = {
			formatie: '4-3-3',
			opstelling: {
				K: 'pa', RV: 'pb', CVr: 'pc', CVl: 'pd', LV: 'pe',
				MR: 'pf', MC: 'pg', ML: 'ph', RB: 'pi', SP: 'pj', LB: 'pk'
			},
			bank: ['pl']
		};
	});

	it('neemt de opstelling mee naar de nieuwe formatie', () => {
		app.zetStandaardInFormatie('4-4-2');
		const st = app.toestand.standaard!;
		expect(st.formatie).toBe('4-4-2');
		expect(st.opstelling.K).toBe('pa');
		expect(st.opstelling.CVr).toBe('pc');
		expect(Object.values(st.opstelling).filter(Boolean)).toHaveLength(10);
		expect(st.bank).toHaveLength(2); /* de bankzitter plus de aanvaller die niet past */
	});

	it('raakt niemand kwijt', () => {
		app.zetStandaardInFormatie('1-3-3-1');
		const st = app.toestand.standaard!;
		const inVeld = Object.values(st.opstelling).filter(Boolean) as string[];
		expect(new Set([...inVeld, ...st.bank]).size).toBe(12);
	});

	it('doet niets als de formatie al klopt', () => {
		const voor = JSON.stringify(app.toestand.standaard);
		app.zetStandaardInFormatie('4-3-3');
		expect(JSON.stringify(app.toestand.standaard)).toBe(voor);
	});

	it('zet hem ook om als je het standaardscherm opent', () => {
		app.toestand.formatie = '4-4-2 ruit';
		app.zorgVoorStandaard();
		expect(app.toestand.standaard!.formatie).toBe('4-4-2 ruit');
	});
});

describe('één formatie voor het team', () => {
	it('zet de formatie én de standaardopstelling om, waar je hem ook kiest', () => {
		app.toestand.formatie = '4-3-3';
		app.toestand.standaard = {
			formatie: '4-3-3',
			opstelling: { K: 'p1', SP: 'p2' },
			bank: []
		};
		app.kiesFormatie('4-4-2 ruit');
		expect(app.toestand.formatie).toBe('4-4-2 ruit');
		expect(app.toestand.standaard!.formatie).toBe('4-4-2 ruit');
		expect(app.toestand.standaard!.opstelling.K).toBe('p1');
	});

	it('negeert een formatie die niet bestaat', () => {
		app.toestand.formatie = '4-3-3';
		app.kiesFormatie('bestaat-niet');
		expect(app.toestand.formatie).toBe('4-3-3');
	});

	it('werkt ook zonder standaardopstelling', () => {
		app.toestand.standaard = null;
		app.kiesFormatie('1-2-2-1');
		expect(app.toestand.formatie).toBe('1-2-2-1');
	});
});

describe('de naam van je team', () => {
	it('begint neutraal en niet met het team van de maker', () => {
		expect(legeToestand().teamnaam).toBe('Ons team');
	});

	it('onthoudt wat je invult, en weigert leeg', () => {
		app.zetTeamnaam('JO11-2');
		expect(app.toestand.teamnaam).toBe('JO11-2');
		app.zetTeamnaam('   ');
		expect(app.toestand.teamnaam).toBe('Ons team');
	});

	it('bewaart de naam bij de wedstrijd, zodat een hernoeming het archief niet omschrijft', () => {
		app.zetTeamnaam('JO11-2');
		app.nieuweWedstrijd('Sparta', true);
		app.toestand.wedstrijd!.opstelling = { K: 'p1' };
		app.beeindig();
		app.bewaarInArchief();
		app.zetTeamnaam('JO12-1');
		expect(app.toestand.archief[0].teamnaam).toBe('JO11-2');
	});

	it('geeft oude opslag zonder teamnaam er alsnog een', () => {
		const oud = { ...legeToestand(), spelers: app.toestand.spelers } as Record<string, unknown>;
		delete oud.teamnaam;
		localStorage.setItem('o14-app-v1', JSON.stringify(oud));
		app.laad();
		expect(app.toestand.teamnaam).toBe('Ons team');
	});
});
