import { beforeEach, describe, expect, it } from 'vitest';
import { app } from './store.svelte';
import { emptyState } from './domain/types';
import { issues, clearIssues } from './issues.svelte';
import { playingTimes, elapsed } from './domain/time';

beforeEach(() => {
	localStorage.clear();
	app.toestand = emptyState();
	app.toestand.players = [
		{ id: 'p1', name: 'Daanish', line: 'M' },
		{ id: 'p2', name: 'Gijs', line: '', keeper: true }
	];
});

describe('trainingen', () => {
	/* This one went wrong: the store returned the bare object while the state holds
	   a proxy. indexOf() therefore did not find it and you landed on an empty
	   screen. Since then we look up by id. */
	it('geeft een nieuwe training terug die je meteen kunt opzoeken', () => {
		const t = app.newTraining();
		expect(t.id).toBeTruthy();
		expect(app.trainingById(t.id)).toBeDefined();
		expect(app.trainingById(t.id)!.date).toBe(t.date);
	});

	it('zet iedereen op aanwezig en laat je langs de standen tikken', () => {
		const t = app.trainingById(app.newTraining().id)!;
		expect(t.status.p1).toBe('present');
		app.cycleAttendance(t, 'p1');
		expect(app.trainingById(t.id)!.status.p1).toBe('excused');
		app.cycleAttendance(t, 'p1');
		expect(app.trainingById(t.id)!.status.p1).toBe('absent');
		app.cycleAttendance(t, 'p1');
		expect(app.trainingById(t.id)!.status.p1).toBe('present');
	});

	it('houdt het adres kloppend als een datum de volgorde omgooit', () => {
		const eerste = app.newTraining();
		const tweede = app.newTraining();
		app.setTrainingDate(app.trainingById(tweede.id)!, '2020-01-01');
		expect(app.toestand.trainings[1].id).toBe(tweede.id); /* naar achteren gesorteerd */
		expect(app.trainingById(eerste.id)).toBeDefined();
		expect(app.trainingById(tweede.id)!.date).toBe('2020-01-01');
	});

	it('verwijdert alleen de training die je aanwijst', () => {
		const eerste = app.newTraining();
		const tweede = app.newTraining();
		app.removeTraining(app.trainingById(eerste.id)!);
		expect(app.trainingById(eerste.id)).toBeUndefined();
		expect(app.trainingById(tweede.id)).toBeDefined();
	});

	it('geeft oude trainingen zonder id er alsnog een bij het laden', () => {
		localStorage.setItem(
			'o14-app-v1',
			JSON.stringify({
				...emptyState(),
				players: app.toestand.players,
				trainings: [{ date: '2026-09-02', status: {} }]
			})
		);
		app.load();
		expect(app.toestand.trainings[0].id).toBeTruthy();
	});
});

describe('wie is er vandaag', () => {
	it('haalt een afwezige uit veld en bank, en zet hem daarna op de bank', () => {
		app.newMatch('Sparta', true);
		app.toestand.match!.lineup = { K: 'p2', SP: 'p1' };
		app.rebuildBench();
		expect(app.toestand.match!.bench).toEqual([]);

		app.setAbsent('p2', true);
		expect(app.toestand.match!.lineup.K).toBeNull();
		expect(app.toestand.match!.bench).not.toContain('p2');

		app.setAbsent('p2', false);
		expect(app.toestand.match!.bench).toContain('p2');
	});

	/* This went wrong: playing time is wound back from the lineup as it stands now,
	   so anyone you remove from it during the match never played according to that
	   calculation. A whole match silently became zero minutes. */
	it('laat het veld met rust zodra de wedstrijd loopt', () => {
		app.newMatch('Sparta', true);
		app.toestand.match!.lineup = { K: 'p2', SP: 'p1' };
		app.rebuildBench();
		app.toestand.match!.events = [{ type: 'start', t: 0 }];

		app.setAbsent('p2', true);
		expect(app.toestand.match!.lineup.K).toBe('p2');
		expect(app.toestand.match!.absent ?? []).not.toContain('p2');
	});

	it('laat wie op de bank zit ook na de aftrap afmelden', () => {
		app.newMatch('Sparta', true);
		app.toestand.match!.lineup = { K: 'p2' };
		app.rebuildBench();
		app.toestand.match!.events = [{ type: 'start', t: 0 }];
		expect(app.toestand.match!.bench).toContain('p1');

		app.setAbsent('p1', true);
		expect(app.toestand.match!.bench).not.toContain('p1');
		expect(app.toestand.match!.absent).toContain('p1');
	});
});

describe('de klok', () => {
	it('schuift met minuten maar nooit onder nul', () => {
		app.newMatch('Sparta', true);
		app.toestand.match!.elapsed = 100;
		app.shiftClock(60);
		expect(app.toestand.match!.elapsed).toBe(160);
		app.shiftClock(-600);
		expect(app.toestand.match!.elapsed).toBe(0);
	});
});

describe('een bewaarde wedstrijd bijwerken', () => {
	function metArchief() {
		app.toestand.archive = [
			{
				date: '2026-08-30',
				opponent: 'Ajx',
				home: true,
				score: [1, 1],
				formation: '4-3-3',
				duration: 4200,
				names: { p1: 'Daanish', p2: 'Gijs' },
				events: [
					{ type: 'start', t: 0 },
					{ type: 'goal', t: 900, player: 'p1' },
					{ type: 'substitution', t: 1200, off: 'p1', on: 'p2', position: 'SP' },
					{ type: 'conceded', t: 1800 },
					{ type: 'end', t: 4200 }
				],
				playingTime: [{ id: 'p1', name: 'Daanish', seconds: 1200, keeper: 0 }]
			}
		];
	}

	it('verbetert de naam van de tegenstander', () => {
		metArchief();
		app.updateArchived(0, { opponent: 'Ajax', home: false });
		expect(app.toestand.archive[0].opponent).toBe('Ajax');
		expect(app.toestand.archive[0].home).toBe(false);
	});

	it('haalt een doelpunt weg en telt de stand opnieuw', () => {
		metArchief();
		app.removeGoal(0, 1);
		expect(app.toestand.archive[0].score).toEqual([0, 1]);
		expect(app.toestand.archive[0].events).toHaveLength(4);
	});

	it('laat wissels met rust, want daar hangt de speeltijd aan', () => {
		metArchief();
		app.removeGoal(0, 2); /* de wissel */
		expect(app.toestand.archive[0].events).toHaveLength(5);
	});

	it('zet een vergeten doelpunt op de goede plek in het verloop', () => {
		metArchief();
		app.addGoal(0, 20, 'p2');
		const g = app.toestand.archive[0].events;
		expect(g.map((x) => x.t)).toEqual([0, 900, 1200, 1200, 1800, 4200]);
		expect(app.toestand.archive[0].score).toEqual([2, 1]);
		app.addGoal(0, 55, null, true);
		expect(app.toestand.archive[0].score).toEqual([2, 2]);
	});
});

describe('schuiven in de opstelling', () => {
	beforeEach(() => {
		app.toestand.defaultLineup = {
			formation: '4-3-3',
			lineup: { K: 'p2', SP: 'p1', LV: null },
			bench: []
		};
	});

	it('wisselt twee spelers van plek', () => {
		app.swapPositions('standaard', 'K', 'SP');
		expect(app.toestand.defaultLineup!.lineup).toMatchObject({ K: 'p1', SP: 'p2' });
	});

	it('verhuist iemand naar een lege plek', () => {
		app.swapPositions('standaard', 'SP', 'LV');
		expect(app.toestand.defaultLineup!.lineup.SP).toBeNull();
		expect(app.toestand.defaultLineup!.lineup.LV).toBe('p1');
	});

	it('doet niets als je twee lege plekken ruilt', () => {
		app.toestand.defaultLineup!.lineup = { LV: null, RV: null };
		app.swapPositions('standaard', 'LV', 'RV');
		expect(app.toestand.defaultLineup!.lineup).toMatchObject({ LV: null, RV: null });
	});

	it('haalt iemand van het veld naar de bank en laat de plek leeg', () => {
		app.takeOffPitch('standaard', 'SP');
		expect(app.toestand.defaultLineup!.lineup.SP).toBeNull();
		expect(app.toestand.defaultLineup!.bench).toContain('p1');
	});

	it('zet niemand dubbel op de bank', () => {
		app.toestand.defaultLineup!.bench = ['p1'];
		app.takeOffPitch('standaard', 'SP');
		expect(app.toestand.defaultLineup!.bench.filter((id) => id === 'p1')).toHaveLength(1);
	});
});

describe('ruilen tijdens de wedstrijd', () => {
	it('legt de ruil vast in het verloop', () => {
		app.newMatch('Sparta', true);
		app.toestand.match!.lineup = { K: 'p2', SP: 'p1' };
		app.toestand.match!.events = [{ type: 'start', t: 0 }];
		app.swapDuringMatch('K', 'SP');
		const w = app.toestand.match!;
		expect(w.lineup).toMatchObject({ K: 'p1', SP: 'p2' });
		expect(w.events.at(-1)).toMatchObject({ type: 'swap', positionA: 'K', positionB: 'SP' });
	});
});

describe('klaarstaan of bezig', () => {
	it('is pas begonnen als de klok gelopen heeft', () => {
		app.newMatch('Sparta', true);
		app.toestand.match!.lineup = { K: 'p2', SP: 'p1' };
		expect(app.kickedOff).toBe(false);
		app.toggleRunning();
		expect(app.kickedOff).toBe(true);
	});

	it('legt een ruil voor de aftrap niet vast als gebeurtenis', () => {
		app.newMatch('Sparta', true);
		app.toestand.match!.lineup = { K: 'p2', SP: 'p1' };
		app.swapDuringMatch('K', 'SP');
		expect(app.toestand.match!.events).toHaveLength(0);
		expect(app.toestand.match!.lineup).toMatchObject({ K: 'p1', SP: 'p2' });
	});

	it('legt een ruil ná de aftrap wel vast', () => {
		app.newMatch('Sparta', true);
		app.toestand.match!.lineup = { K: 'p2', SP: 'p1' };
		app.toggleRunning();
		app.swapDuringMatch('K', 'SP');
		expect(app.toestand.match!.events.at(-1)).toMatchObject({ type: 'swap' });
	});
});

describe('wie er die dag was, bewaren', () => {
	it('legt de afwezigen vast bij de wedstrijd', () => {
		app.newMatch('Sparta', true);
		app.toestand.match!.lineup = { K: 'p1' };
		app.setAbsent('p2', true);
		app.finish();
		app.archiveMatch();
		const a = app.toestand.archive[0];
		expect(a.absent).toEqual(['p2']);
		/* zero minutes now means something different for someone who was there */
		expect(a.playingTime.find((r) => r.id === 'p2')!.seconds).toBe(0);
	});

	it('bewaart een lege lijst als iedereen er was', () => {
		app.newMatch('Sparta', true);
		app.toestand.match!.lineup = { K: 'p1' };
		app.finish();
		app.archiveMatch();
		expect(app.toestand.archive[0].absent).toEqual([]);
	});
});

describe('kwarten spelen', () => {
	function metKwarten() {
		app.toestand.parts = 4;
		app.newMatch('Sparta', true);
		app.toestand.match!.lineup = { K: 'p1' };
		return app.toestand.match!;
	}

	it('neemt de speelwijze over van de instelling', () => {
		expect(metKwarten().parts).toBe(4);
	});

	it('loopt door vier kwarten met een pauze ertussen', () => {
		const w = metKwarten();
		app.toggleRunning();
		expect(w.part).toBe(1);

		app.togglePart(); /* einde 1e kwart */
		expect(w.inBreak).toBe(true);
		expect(w.running).toBe(false);
		expect(w.events.at(-1)).toMatchObject({ type: 'break', part: 1 });

		app.togglePart(); /* 2e kwart begint */
		expect(w.part).toBe(2);
		expect(w.inBreak).toBe(false);
		expect(w.running).toBe(true);

		app.togglePart();
		app.togglePart();
		app.togglePart();
		app.togglePart();
		expect(w.part).toBe(4);
		expect(app.canStartNextPart).toBe(false); /* after the last quarter it stops */
	});

	it('houdt twee helften gewoon zoals het was', () => {
		app.toestand.parts = 2;
		app.newMatch('Sparta', true);
		const w = app.toestand.match!;
		app.toggleRunning();
		app.togglePart();
		expect(w.inBreak).toBe(true);
		app.togglePart();
		expect(w.part).toBe(2);
		expect(app.canStartNextPart).toBe(false);
	});

	it('bewaart de speelwijze en de notitie in het archief', () => {
		metKwarten();
		app.setNote('Sterk begin, na rust weggezakt.');
		app.finish();
		app.archiveMatch();
		expect(app.toestand.archive[0].parts).toBe(4);
		expect(app.toestand.archive[0].note).toBe('Sterk begin, na rust weggezakt.');
	});

	it('vertaalt een oude wedstrijd met helften naar de nieuwe vorm', () => {
		localStorage.setItem(
			'o14-app-v1',
			JSON.stringify({
				...emptyState(),
				players: app.toestand.players,
				match: {
					date: '2026-09-06',
					opponent: 'Oud',
					home: true,
					formation: '4-3-3',
					lineup: {},
					bench: [],
					events: [],
					elapsed: 0,
					since: null,
					running: false,
					helft: 2,
					finished: false
				}
			})
		);
		app.load();
		expect(app.toestand.match).toMatchObject({ parts: 2, part: 2, inBreak: false });
	});
});

describe('van formatie wisselen met een standaardopstelling', () => {
	beforeEach(() => {
		app.toestand.players = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l'].map((n, i) => ({
			id: 'p' + n,
			name: n.toUpperCase(),
			line: i === 0 ? '' : i <= 4 ? 'V' : i <= 7 ? 'M' : 'A',
			keeper: i === 0
		}));
		app.toestand.formation = '4-3-3';
		app.toestand.defaultLineup = {
			formation: '4-3-3',
			lineup: {
				K: 'pa',
				RV: 'pb',
				CVr: 'pc',
				CVl: 'pd',
				LV: 'pe',
				MR: 'pf',
				MC: 'pg',
				ML: 'ph',
				RB: 'pi',
				SP: 'pj',
				LB: 'pk'
			},
			bench: ['pl']
		};
	});

	it('neemt de opstelling mee naar de nieuwe formatie', () => {
		app.moveDefaultToFormation('4-4-2');
		const st = app.toestand.defaultLineup!;
		expect(st.formation).toBe('4-4-2');
		expect(st.lineup.K).toBe('pa');
		expect(st.lineup.CVr).toBe('pc');
		expect(Object.values(st.lineup).filter(Boolean)).toHaveLength(10);
		expect(st.bench).toHaveLength(2); /* the substitute plus the forward who does not fit */
	});

	it('raakt niemand kwijt', () => {
		app.moveDefaultToFormation('1-3-3-1');
		const st = app.toestand.defaultLineup!;
		const inVeld = Object.values(st.lineup).filter(Boolean) as string[];
		expect(new Set([...inVeld, ...st.bench]).size).toBe(12);
	});

	it('doet niets als de formatie al klopt', () => {
		const voor = JSON.stringify(app.toestand.defaultLineup);
		app.moveDefaultToFormation('4-3-3');
		expect(JSON.stringify(app.toestand.defaultLineup)).toBe(voor);
	});

	it('zet hem ook om als je het standaardscherm opent', () => {
		app.toestand.formation = '4-4-2 diamond';
		app.ensureDefaultLineup();
		expect(app.toestand.defaultLineup!.formation).toBe('4-4-2 diamond');
	});
});

describe('één formatie voor het team', () => {
	it('zet de formatie én de standaardopstelling om, waar je hem ook kiest', () => {
		app.toestand.formation = '4-3-3';
		app.toestand.defaultLineup = {
			formation: '4-3-3',
			lineup: { K: 'p1', SP: 'p2' },
			bench: []
		};
		app.chooseFormation('4-4-2 diamond');
		expect(app.toestand.formation).toBe('4-4-2 diamond');
		expect(app.toestand.defaultLineup!.formation).toBe('4-4-2 diamond');
		expect(app.toestand.defaultLineup!.lineup.K).toBe('p1');
	});

	it('negeert een formatie die niet bestaat', () => {
		app.toestand.formation = '4-3-3';
		app.chooseFormation('bestaat-niet');
		expect(app.toestand.formation).toBe('4-3-3');
	});

	it('werkt ook zonder standaardopstelling', () => {
		app.toestand.defaultLineup = null;
		app.chooseFormation('1-2-2-1');
		expect(app.toestand.formation).toBe('1-2-2-1');
	});
});

describe('de naam van je team', () => {
	it('begint neutraal en niet met het team van de maker', () => {
		expect(emptyState().teamName).toBe('Ons team');
	});

	it('onthoudt wat je invult, en weigert leeg', () => {
		app.setTeamName('JO11-2');
		expect(app.toestand.teamName).toBe('JO11-2');
		app.setTeamName('   ');
		expect(app.toestand.teamName).toBe('Ons team');
	});

	it('bewaart de naam bij de wedstrijd, zodat een hernoeming het archief niet omschrijft', () => {
		app.setTeamName('JO11-2');
		app.newMatch('Sparta', true);
		app.toestand.match!.lineup = { K: 'p1' };
		app.finish();
		app.archiveMatch();
		app.setTeamName('JO12-1');
		expect(app.toestand.archive[0].teamName).toBe('JO11-2');
	});

	it('geeft oude opslag zonder teamnaam er alsnog een', () => {
		const oud = { ...emptyState(), players: app.toestand.players } as Record<string, unknown>;
		delete oud.teamName;
		localStorage.setItem('o14-app-v1', JSON.stringify(oud));
		app.load();
		expect(app.toestand.teamName).toBe('Ons team');
	});
});

describe('wat er tussen je toestellen heen en weer gaat', () => {
	/* This was missing: you set the lineup at home and your phone showed nothing. */
	it('neemt een wedstrijd die klaarstaat mee', () => {
		app.newMatch('Sparta', true);
		app.toestand.match!.lineup = { K: 'p2', SP: 'p1' };
		app.setAbsent('p1', true);

		const pakket = JSON.parse(JSON.stringify(app.syncPayload()));
		app.toestand = emptyState();
		app.toestand.players = [
			{ id: 'p1', name: 'Daanish', line: 'M' },
			{ id: 'p2', name: 'Gijs', line: '', keeper: true }
		];
		expect(app.adoptSyncPayload(pakket)).toBe(true);
		expect(app.match?.opponent).toBe('Sparta');
		expect(app.match?.lineup.K).toBe('p2');
		expect(app.match?.absent).toContain('p1');
	});

	/* Na de aftrap wint dit toestel altijd: wissels die hier nog niet verstuurd
	   zijn, bestaan op dat moment nergens anders. */
	it('laat een wedstrijd die hier loopt met rust', () => {
		app.newMatch('Sparta', true);
		app.toestand.match!.lineup = { K: 'p2' };
		app.toestand.match!.events = [{ type: 'start', t: 0 }];

		const vanElders = { ...app.syncPayload(), match: null };
		expect(app.adoptSyncPayload(JSON.parse(JSON.stringify(vanElders)))).toBe(true);
		expect(app.match?.opponent).toBe('Sparta');
		expect(app.kickedOff).toBe(true);
	});

	/*
	 * De andere helft van dezelfde regel, en die lag nergens vast. Vóór de aftrap
	 * wint de server wél. Dat is het geval waarin je thuis een opstelling maakt en
	 * er ondertussen op je telefoon ook een staat: dan is er één die het wordt, en
	 * ben je hooguit twee minuten klikken kwijt.
	 */
	it('laat een klaargezette opstelling wel wijken voor de server', () => {
		app.newMatch('Hier', true);
		app.toestand.match!.lineup = { K: 'p2' };

		const vanElders = JSON.parse(JSON.stringify(app.syncPayload()));
		vanElders.match.opponent = 'Van de server';
		vanElders.match.lineup = { SP: 'p1' };

		expect(app.adoptSyncPayload(vanElders)).toBe(true);
		expect(app.match?.opponent).toBe('Van de server');
		expect(app.match?.lineup.SP).toBe('p1');
	});

	/* En één tik op start verlegt die grens. */
	it('verlegt die grens zodra er afgetrapt is', () => {
		app.newMatch('Hier', true);
		app.toestand.match!.lineup = { K: 'p2' };
		app.toggleRunning();

		const vanElders = JSON.parse(JSON.stringify(app.syncPayload()));
		vanElders.match.opponent = 'Van de server';

		expect(app.adoptSyncPayload(vanElders)).toBe(true);
		expect(app.match?.opponent).toBe('Hier');
	});

	it('ruimt de wedstrijd wel op als hij afgelopen is', () => {
		app.newMatch('Sparta', true);
		app.toestand.match!.events = [{ type: 'start', t: 0 }];
		app.toestand.match!.finished = true;

		const vanElders = { ...app.syncPayload(), match: null };
		expect(app.adoptSyncPayload(JSON.parse(JSON.stringify(vanElders)))).toBe(true);
		expect(app.match).toBeNull();
	});
});

describe('de aftrap vastleggen', () => {
	/* The first real match at the touchline went wrong on this. A player had been
	   swapped before the whistle, so the list was not empty, so 'start' was never
	   written. The clock ran fine, but the app believed all match long that kick-off
	   had not happened — and then position swaps are no longer recorded. */
	it('legt de aftrap ook vast als je vooraf nog geschoven hebt', () => {
		app.newMatch('Sparta', true);
		app.toestand.match!.lineup = { K: 'p2', SP: 'p1' };
		app.rebuildBench();

		app.chosenPosition = 'SP';
		app.putOnPosition('p2'); /* one last shuffle before kick-off */
		expect(app.kickedOff).toBe(false);

		app.toggleRunning();
		expect(app.kickedOff).toBe(true);
		expect(app.toestand.match!.events.some((g) => g.type === 'start')).toBe(true);
	});

	it('houdt schuiven voor de aftrap uit het verloop', () => {
		app.newMatch('Sparta', true);
		app.toestand.match!.lineup = { K: 'p2', SP: null };
		app.rebuildBench();

		app.chosenPosition = 'K';
		app.putOnPosition('p1');
		expect(app.toestand.match!.events).toEqual([]);
	});

	/* You set the lineup in the evening and play the next day. The match should not
	   then carry yesterday's date. */
	it('stempelt de speeldag bij de aftrap, niet bij het aanmaken', () => {
		app.newMatch('Sparta', true);
		app.toestand.match!.date = '2020-01-01';
		app.toggleRunning();
		expect(app.toestand.match!.date).toBe(new Date().toISOString().slice(0, 10));
	});

	it('legt een positieruil wel vast zodra er is afgetrapt', () => {
		app.newMatch('Sparta', true);
		app.toestand.match!.lineup = { K: 'p2', SP: 'p1' };
		app.rebuildBench();
		app.chosenPosition = 'SP';
		app.putOnPosition('p2');
		app.toggleRunning();

		app.swapDuringMatch('K', 'SP');
		expect(app.toestand.match!.events.filter((g) => g.type === 'swap')).toHaveLength(1);
	});

	it('repareert een wedstrijd die zonder aftrap is opgeslagen', () => {
		app.newMatch('Sparta', true);
		app.toestand.match!.events = [{ type: 'substitution', t: 0, off: 'p1', on: 'p2', position: 'SP' }];
		app.save();
		app.toestand = emptyState();
		app.load();
		expect(app.kickedOff).toBe(true);
		expect(app.toestand.match!.events[0].type).toBe('start');
	});
});

describe('een bewaarde wedstrijd op eigen benen', () => {
	/* The archive stored the events but not the final lineup, and playing time is
	   wound back from precisely that lineup. So an archived match could not be
	   recalculated and was therefore beyond repair. This test proves it now can. */
	it('is uit zijn eigen gegevens opnieuw uit te rekenen', () => {
		app.newMatch('Sparta', true);
		const w = app.toestand.match!;
		w.lineup = { K: 'p2', SP: 'p1' };
		app.rebuildBench();
		app.toggleRunning();
		w.elapsed = 600;
		app.chosenPosition = 'SP';
		app.putOnPosition('p2'); /* wissel onderweg */
		w.elapsed = 1200;
		app.finish();
		app.archiveMatch();

		const a = app.toestand.archive[0];
		expect(a.lineup).toBeDefined();

		const herbouwd = {
			...a,
			lineup: a.lineup!,
			bench: a.bench ?? [],
			elapsed: a.duration,
			since: null,
			running: false,
			part: 2,
			inBreak: false,
			finished: true
		} as unknown as Parameters<typeof playingTimes>[0];

		const opnieuw = playingTimes(herbouwd, app.toestand.players);
		for (const regel of a.playingTime) {
			expect(regel.id).toBeTruthy();
			expect(Math.round(opnieuw[regel.id!])).toBe(regel.seconds);
		}
	});
});

describe('de selectie beheren', () => {
	it('zet namen uit een plakblok erbij, één per regel, en slaat lege regels over', () => {
		app.toestand.players = [];
		app.addPlayerNames('  Bram \n\n Cas\n   \nDirk  ');
		expect(app.toestand.players.map((p) => p.name)).toEqual(['Bram', 'Cas', 'Dirk']);
		expect(new Set(app.toestand.players.map((p) => p.id)).size).toBe(3);
	});

	it('vindt een speler op id, en niets bij een onbekende', () => {
		expect(app.playerById('p1')?.name).toBe('Daanish');
		expect(app.playerById('bestaat-niet')).toBeUndefined();
		expect(app.playerById(null)).toBeUndefined();
	});

	it('hernoemt zonder spaties eromheen', () => {
		app.renamePlayer(app.toestand.players[0], '  Daan  ');
		expect(app.toestand.players[0].name).toBe('Daan');
	});

	it('verwijdert alleen de aangewezen speler', () => {
		app.removePlayer(app.toestand.players[0]);
		expect(app.toestand.players.map((p) => p.id)).toEqual(['p2']);
	});

	it('tikt een linie aan en weer uit', () => {
		const p = app.toestand.players[0];
		app.setLine(p, 'A');
		expect(p.line).toBe('A');
		app.setLine(p, 'A');
		expect(p.line).toBe('');
		app.setLine(p, 'V');
		expect(p.line).toBe('V');
	});

	it('zet keepen los van de linie aan en uit', () => {
		const p = app.toestand.players[0];
		app.toggleKeeper(p);
		expect(p.keeper).toBe(true);
		expect(p.line).toBe('M'); /* blijft staan: keepen is geen linie */
		app.toggleKeeper(p);
		expect(p.keeper).toBe(false);
	});
});

describe('doelpunten en het terugnemen van je laatste tik', () => {
	function lopend() {
		app.newMatch('Sparta', true);
		const w = app.toestand.match!;
		w.lineup = { K: 'p2', SP: 'p1' };
		app.rebuildBench();
		app.toggleRunning();
		return w;
	}

	it('legt een doelpunt vast, met of zonder maker', () => {
		lopend();
		app.goal('p1');
		app.goal(null);
		const g = app.toestand.match!.events.filter((x) => x.type === 'goal');
		expect(g).toHaveLength(2);
		expect(g[0].player).toBe('p1');
		expect(g[1].player).toBeNull();
	});

	it('hangt de assist aan het laatste doelpunt, ook als er daarna iets anders gebeurde', () => {
		lopend();
		app.goal('p1');
		app.concede();
		app.setAssist('p2');
		const goals = app.toestand.match!.events.filter((x) => x.type === 'goal');
		expect(goals.at(-1)!.assist).toBe('p2');
	});

	it('telt een tegendoelpunt zonder maker', () => {
		lopend();
		app.concede();
		expect(app.toestand.match!.events.at(-1)!.type).toBe('conceded');
	});

	it('noemt wat er terug kan, en niets als er niets te herstellen valt', () => {
		lopend();
		expect(app.undoable()).toBeNull(); /* alleen de aftrap */
		app.goal('p1');
		expect(app.undoable()).toBe('Doelpunt');
		app.concede();
		expect(app.undoable()).toBe('Tegendoelpunt');
	});

	it('neemt een doelpunt terug', () => {
		lopend();
		app.goal('p1');
		const voor = app.toestand.match!.events.length;
		app.undoLast();
		expect(app.toestand.match!.events).toHaveLength(voor - 1);
	});

	/* This was impossible, and it is exactly the slip that happens at the touchline:
	   you tap the player who scored and then the one who set it up, and you have
	   made a swap. */
	it('neemt ook een positiewissel terug', () => {
		const w = lopend();
		app.swapDuringMatch('K', 'SP');
		expect(w.lineup).toMatchObject({ K: 'p1', SP: 'p2' });

		expect(app.undoable()).toBe('Positiewissel');
		app.undoLast();
		expect(w.lineup).toMatchObject({ K: 'p2', SP: 'p1' });
		expect(w.events.filter((g) => g.type === 'swap')).toHaveLength(0);
	});

	it('draait een wissel helemaal terug, veld en bank', () => {
		const w = lopend();
		app.chosenPosition = 'SP';
		app.putOnPosition('p2'); /* p2 from goal to striker, p1 to the bench */
		expect(w.lineup.SP).toBe('p2');
		expect(w.bench).toContain('p1');

		expect(app.undoable()).toBe('Wissel');
		app.undoLast();
		expect(w.lineup.SP).toBe('p1');
		expect(w.bench).not.toContain('p1');
		expect(w.events.filter((g) => g.type === 'substitution')).toHaveLength(0);
	});
});

describe('opstellen, opruimen en overnemen', () => {
	it('zet iemand op de gekozen plek en stuurt wie daar stond naar de bank', () => {
		app.newMatch('Sparta', true);
		const w = app.toestand.match!;
		w.lineup = { K: 'p2', SP: null };
		app.rebuildBench();

		app.chosenPosition = 'K';
		app.putOnPositionWhileSettingUp('wedstrijd', 'p1');
		expect(w.lineup.K).toBe('p1');
		expect(w.bench).toContain('p2');
		expect(app.chosenPosition).toBeNull();
	});

	it('doet hetzelfde voor de standaardopstelling', () => {
		app.ensureDefaultLineup();
		app.chosenPosition = Object.keys(app.toestand.defaultLineup!.lineup)[0] ?? 'K';
		app.putOnPositionWhileSettingUp('standaard', 'p1');
		expect(Object.values(app.toestand.defaultLineup!.lineup)).toContain('p1');
	});

	it('wist de standaardopstelling', () => {
		app.ensureDefaultLineup();
		expect(app.toestand.defaultLineup).not.toBeNull();
		app.clearDefaultLineup();
		expect(app.toestand.defaultLineup).toBeNull();
	});

	it('gooit een wedstrijd weg zonder het archief te raken', () => {
		app.newMatch('Sparta', true);
		app.toestand.archive = [{ date: '2026-01-01' } as never];
		app.discardMatch();
		expect(app.match).toBeNull();
		expect(app.toestand.archive).toHaveLength(1);
	});

	it('verwijdert precies één wedstrijd uit het archief', () => {
		app.toestand.archive = [{ opponent: 'A' }, { opponent: 'B' }, { opponent: 'C' }] as never[];
		app.removeFromArchive(1);
		expect(app.toestand.archive.map((a) => a.opponent)).toEqual(['A', 'C']);
	});

	it('wijzigt tegenstander, thuis of uit, en de notitie', () => {
		app.newMatch('Sparta', true);
		app.setOpponent('  SV de Meer  ');
		app.setHome(false);
		app.setNote('Sterk begin.');
		const w = app.toestand.match!;
		expect(w.opponent).toBe('SV de Meer');
		expect(w.home).toBe(false);
		expect(w.note).toBe('Sterk begin.');
	});

	it('schrijft een notitie bij een bewaarde wedstrijd', () => {
		app.toestand.archive = [{ opponent: 'A' }] as never[];
		app.setArchiveNote(0, 'Achteraf bedacht.');
		expect(app.toestand.archive[0].note).toBe('Achteraf bedacht.');
	});

	/* Adopting comes from a transfer code or a restored file. What is not in it
	   stays; a running match belongs to this device. */
	it('neemt alleen over wat er in het pakket zit', () => {
		app.newMatch('Sparta', true);
		app.toestand.teamName = 'Oud';
		app.adoptPackage({ teamName: 'JO13-1', players: [{ id: 'x', name: 'Nieuw', line: '' }] });
		expect(app.toestand.teamName).toBe('JO13-1');
		expect(app.toestand.players.map((p) => p.name)).toEqual(['Nieuw']);
		expect(app.match).not.toBeNull();
	});

	it('laat een lege teamnaam of een onbekende formatie met rust', () => {
		app.toestand.teamName = 'JO13-1';
		app.toestand.formation = '4-3-3';
		app.adoptPackage({ teamName: '   ', formation: 'bestaat-niet', players: app.toestand.players });
		expect(app.toestand.teamName).toBe('JO13-1');
		expect(app.toestand.formation).toBe('4-3-3');
	});
});

describe('wat er van de server binnenkomt', () => {
	/* The formation check was dead code: positionsOf() always falls back to 4-3-3
	   and so never returns anything empty. Every name got through. */
	it('weigert een formatie die we niet kennen', () => {
		app.toestand.formation = '4-3-3';
		app.adoptSyncPayload({
			players: app.toestand.players,
			formation: 'bestaat-niet'
		} as unknown as ReturnType<(typeof app)['syncPayload']>);
		expect(app.toestand.formation).toBe('4-3-3');
	});

	it('neemt een formatie die we wel kennen gewoon over', () => {
		app.toestand.formation = '4-3-3';
		app.adoptSyncPayload({
			players: app.toestand.players,
			formation: '4-4-2'
		} as unknown as ReturnType<(typeof app)['syncPayload']>);
		expect(app.toestand.formation).toBe('4-4-2');
	});
});

describe('als de opslag het begeeft', () => {
	/* A full disk must not stop the clock, so the app carries on. But then
	   everything you do afterwards is gone the moment you close it, and you should
	   not discover that only once you are home. */
	it('gaat door met de wedstrijd maar zet de vlag en noteert het', () => {
		clearIssues();
		app.newMatch('Sparta', true);
		const echt = localStorage.setItem;
		localStorage.setItem = () => {
			throw new Error('QuotaExceededError');
		};
		expect(() => app.setOpponent('SV de Meer')).not.toThrow();
		localStorage.setItem = echt;

		expect(app.toestand.match!.opponent).toBe('SV de Meer'); /* de app werkt door */
		expect(issues.savingFails).toBe(true);
		expect(issues.lijst[0].what).toContain('Opslaan lukte niet');
	});

	it('zet de vlag weer uit zodra opslaan wel lukt', () => {
		issues.savingFails = true;
		app.newMatch('Sparta', true);
		expect(issues.savingFails).toBe(false);
	});

	/* Without this, unreadable storage looks like losing everything, unexplained. */
	it('zet onleesbare gegevens apart in plaats van ze te laten vallen', () => {
		clearIssues();
		localStorage.setItem('o14-app-v1', '{"spelers":[ dit is geen json');
		app.toestand = emptyState();
		app.load();
		expect(localStorage.getItem('o14-app-v1-onleesbaar')).toContain('geen json');
		expect(issues.lijst[0].what).toContain('niet te lezen');
	});
});

describe('de klok rechtstreeks zetten', () => {
	/* ±1' is enough when the referee is a minute out. Anyone entering a match
	   afterwards would be tapping a whole hour together. */
	it('zet de klok op de opgegeven minuut', () => {
		app.newMatch('Sparta', true);
		app.toggleRunning();
		app.setClock(23);
		expect(Math.round(elapsed(app.match!, Date.now()))).toBe(23 * 60);
	});

	it('telt de tijd sinds de laatste start er niet nog eens bovenop', () => {
		app.newMatch('Sparta', true);
		app.toggleRunning();
		const w = app.match!;
		w.since = Date.now() - 300_000; /* vijf minuten geleden gestart */
		app.setClock(10);
		expect(Math.round(elapsed(w, Date.now()) / 60)).toBe(10);
	});

	it('gaat nooit onder nul en laat een afgelopen wedstrijd met rust', () => {
		app.newMatch('Sparta', true);
		app.toggleRunning();
		app.setClock(-5);
		expect(app.match!.elapsed).toBe(0);

		app.setClock(20);
		app.finish();
		const eind = app.match!.elapsed;
		app.setClock(99);
		expect(app.match!.elapsed).toBe(eind);
	});

	it('negeert wat geen getal is', () => {
		app.newMatch('Sparta', true);
		app.toggleRunning();
		app.setClock(12);
		app.setClock(Number.NaN);
		expect(app.match!.elapsed).toBe(12 * 60);
	});
});

/*
 * Een telefoon die leegloopt.
 *
 * Dit is het scenario waarvoor de lopende wedstrijd meegaat naar de server. Vier
 * seconden na elke wissel staat hij er; raakt het toestel op, dan pakt een ander
 * hem op met alles wat er al gebeurd is. Wat níét gebeurt is de andere kant op:
 * een wedstrijd die hier loopt wordt nooit overschreven door wat er op de server
 * staat — niet omdat wissels niet bewaard worden (dat gebeurt wel), maar omdat
 * er tussen de tik en het opsturen een gat zit waarin ze alleen hier staan.
 */
describe('een wedstrijd voortzetten op een ander toestel', () => {
	function opHetVeld() {
		app.toestand = emptyState();
		app.toestand.teamName = 'JO14-3';
		app.toestand.players = [
			{ id: 'k1', name: 'Bram', line: '', keeper: true },
			{ id: 'a1', name: 'Finn', line: 'A' },
			{ id: 'b1', name: 'Gijs', line: 'A' }
		];
		app.whoIsKeeping = 'tjaco@voorbeeld.nl';
		app.newMatch('Kampong', true);
		app.toestand.match!.lineup = { K: 'k1', SP: 'a1' };
		app.toestand.match!.bench = ['b1'];
		app.toggleRunning();
		/* zoals langs de lijn: plek aantikken, dan de speler van de bank */
		app.chosenPosition = 'SP';
		app.putOnPosition('b1');
		app.goal('b1');
		return JSON.parse(JSON.stringify(app.syncPayload()));
	}

	it('stuurt de lopende wedstrijd mee, met de wissels erin', () => {
		const pakket = opHetVeld();
		expect(pakket.match.running).toBe(true);
		expect(pakket.match.events.filter((g: { type: string }) => g.type === 'substitution')).toHaveLength(1);
		expect(pakket.match.keptBy).toBe('tjaco@voorbeeld.nl');
	});

	it('komt compleet binnen op een toestel dat zelf niets heeft lopen', () => {
		const pakket = opHetVeld();

		/* de tweede telefoon: net ingelogd, verder leeg */
		app.toestand = emptyState();
		app.whoIsKeeping = 'matthijs@voorbeeld.nl';
		expect(app.adoptSyncPayload(pakket)).toBe(true);

		expect(app.match!.opponent).toBe('Kampong');
		expect(app.kickedOff).toBe(true);
		expect(app.match!.lineup.SP).toBe('b1');
		expect(app.match!.events.filter((g) => g.type === 'substitution')).toHaveLength(1);
		expect(app.match!.events.filter((g) => g.type === 'goal')).toHaveLength(1);
	});

	it('laat daarna zien op wiens toestel hij begonnen is', () => {
		const pakket = opHetVeld();
		app.toestand = emptyState();
		app.adoptSyncPayload(pakket);
		expect(app.match!.keptBy).toBe('tjaco@voorbeeld.nl');
	});

	it('draagt over zonder iets van de wedstrijd te veranderen', () => {
		const pakket = opHetVeld();
		app.toestand = emptyState();
		app.whoIsKeeping = 'matthijs@voorbeeld.nl';
		app.adoptSyncPayload(pakket);
		const voor = JSON.stringify({ ...app.match, keptBy: null });

		expect(app.takeOverMatch()).toBe(true);
		expect(app.match!.keptBy).toBe('matthijs@voorbeeld.nl');
		expect(JSON.stringify({ ...app.match, keptBy: null })).toBe(voor);
	});

	/* En de andere kant op blijft dicht: wat hier loopt gaat voor. */
	it('overschrijft nooit een wedstrijd die hier al loopt', () => {
		const pakket = opHetVeld();
		opHetVeld();
		app.toestand.match!.opponent = 'Hier op het veld';
		app.adoptSyncPayload(pakket);
		expect(app.match!.opponent).toBe('Hier op het veld');
	});

	it('neemt niets over als je niet ingelogd bent', () => {
		opHetVeld();
		app.whoIsKeeping = null;
		expect(app.takeOverMatch()).toBe(false);
	});

	it('neemt een afgelopen wedstrijd niet over', () => {
		opHetVeld();
		app.toestand.match!.finished = true;
		app.whoIsKeeping = 'matthijs@voorbeeld.nl';
		expect(app.takeOverMatch()).toBe(false);
	});
});
