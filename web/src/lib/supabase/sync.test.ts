import { beforeEach, describe, expect, it, vi } from 'vitest';
import { noodrem, sync } from './sync.svelte';
import { app } from '$lib/store.svelte';
import { issues } from '$lib/issues.svelte';
import { emptyState, type State } from '$lib/domain/types';
import { nepServer } from '../../test/nepserver';

/** Voor wat niet over de tabellen gaat: alles is goed, of er is geen bereik. */
function nepFetch(opties: { stuk?: boolean } = {}) {
	const f = vi.fn(async (_url: string, _init?: RequestInit) => {
		if (opties.stuk) throw new Error('geen bereik');
		return new Response('{}', { status: 200 });
	});
	globalThis.fetch = f as unknown as typeof fetch;
	return { f };
}

/** Een kenmerk zoals de telefoon het maakt. */
const id = (n: number) => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');

/** Wat de iPhone-app in het account zette: een selectie, een training en een bewaarde wedstrijd. */
function vanDeTelefoon(): State {
	const t = emptyState();
	t.teamName = 'JO13-1';
	t.players = [
		{ id: id(1), name: 'Sem', line: 'V', keeper: true },
		{ id: id(2), name: 'Noah', line: 'M' },
		{ id: id(3), name: 'Luuk', line: 'A' }
	];
	t.trainings = [
		{ id: id(20), date: '2026-10-07', status: { [id(1)]: 'present', [id(2)]: 'excused', [id(3)]: 'present' } }
	];
	t.archive = [
		{
			id: id(30),
			date: '2026-10-04',
			opponent: 'Sparta',
			home: true,
			score: [2, 1],
			formation: '4-3-3',
			duration: 4200,
			parts: 2,
			events: [
				{ type: 'start', t: 0 },
				{ type: 'goal', t: 600, player: id(3) },
				{ type: 'conceded', t: 900 },
				{ type: 'goal', t: 2000, player: id(2) },
				{ type: 'end', t: 4200 }
			],
			playingTime: [
				{ id: id(1), name: 'Sem', seconds: 4200, keeper: 4200 },
				{ id: id(2), name: 'Noah', seconds: 4200, keeper: 0 },
				{ id: id(3), name: 'Luuk', seconds: 2100, keeper: 0 }
			]
		}
	];
	return t;
}

const namen = () => app.toestand.players.map((p) => p.name);

beforeEach(() => {
	localStorage.clear();
	sync.load(); /* vergeet ook wat er van een team in de tabellen stond */
	app.afterSave = () => sync.merkVies(); /* zoals de schil van de app doet */
	noodrem.los();
	app.toestand = emptyState();
	app.toestand.players = [{ id: 'p1', name: 'Daanish', line: 'M' }];
	sync.sessie = {
		access_token: 'u1',
		refresh_token: 'u1',
		verloopt: Date.now() + 3600_000,
		user_id: 'u1',
		email: 'trainer@voorbeeld.nl',
		teamId: 'team-1',
		laatst: null
	};
	sync.vies = false;
	sync.hapert = false;
	sync.geweigerd = 0;
	sync.message = '';
	sync.mijnTeams = [];
	sync.leden = [];
	sync.openstaand = [];
	sync.uitgenodigdVoor = [];
	sync.andereGebruiker = null;
	vi.stubGlobal('confirm', () => true);
});

/*
 * De tabellen.
 *
 * Sinds oktober 2026 schrijven het web en de iPhone-app in dezelfde tabellen,
 * per veld. Wat hier bewaakt wordt: het web haalt eerst op voordat het iets
 * stuurt, stuurt daarna alleen wat er hier veranderde, en laat staan wat een
 * ander toestel intussen deed.
 */
describe('de eerste keer', () => {
	it('haalt op wat de telefoon in het account zette', async () => {
		const s = nepServer();
		s.team('team-1', 'JO13-1');
		s.vul('team-1', vanDeTelefoon());

		await sync.kijkEven();

		expect(namen()).toEqual(['Sem', 'Noah', 'Luuk']);
		expect(app.toestand.archive[0].score).toEqual([2, 1]);
		expect(app.toestand.trainings[0].status[id(2)]).toBe('excused');
		expect(sync.vies).toBe(false);
	});

	/* Regel 3: het eerste contact met een team is ophalen, nooit opsturen. */
	it('stuurt niets op voordat het team een keer is opgehaald', async () => {
		const s = nepServer();
		s.team('team-1', 'JO13-1');
		s.vul('team-1', vanDeTelefoon());

		await sync.opsturen();

		expect(s.schrijfacties()).toHaveLength(0);
		expect(s.toestand('team-1')!.players.map((p) => p.name)).toEqual(['Sem', 'Noah', 'Luuk']);
	});

	it('zet wat hier stond apart, voor als dat een vergissing was', async () => {
		const s = nepServer();
		s.team('team-1', 'JO13-1');
		s.vul('team-1', vanDeTelefoon());

		await sync.kijkEven();

		const apart = JSON.parse(localStorage.getItem('o14-app-v1-voor-account')!);
		expect(apart.players[0].name).toBe('Daanish');
	});

	/* Het oude blok, van vóór de tabellen: één keer verhuizen, daarna niet meer. */
	it('verhuist het oude blok als er in de tabellen nog niets staat', async () => {
		const s = nepServer();
		s.team('team-1', 'JO13-1');
		s.oud['team-1'] = {
			versie: 8,
			data: {
				teamName: 'JO13-1',
				players: [{ id: 'p7', name: 'Vanaf de laptop', line: 'M' }],
				archive: [],
				trainings: []
			}
		};
		app.toestand = emptyState();

		await sync.kijkEven();

		expect(namen()).toEqual(['Vanaf de laptop']);
		expect(s.toestand('team-1')!.players.map((p) => p.name)).toEqual(['Vanaf de laptop']);
	});

	it('houdt wat hier staat als dat net zo nieuw is als het oude blok', async () => {
		const s = nepServer();
		s.team('team-1', 'JO13-1');
		s.oud['team-1'] = { versie: 8, data: { players: [{ id: 'p7', name: 'Ouder', line: 'M' }] } };
		sync.sessie!.versie = 8;
		app.toestand.players = [
			{ id: 'p1', name: 'Daanish', line: 'M' },
			{ id: 'p2', name: 'Nieuw hier', line: 'A' }
		];

		await sync.kijkEven();

		expect(namen()).toEqual(['Daanish', 'Nieuw hier']);
		expect(s.toestand('team-1')!.players.map((p) => p.name)).toEqual(['Daanish', 'Nieuw hier']);
	});

	it('zet wat hier staat in een team dat nog leeg is', async () => {
		const s = nepServer();
		s.team('team-1', 'JO13-1');
		app.toestand.teamName = 'Ons team';

		await sync.kijkEven();

		expect(s.toestand('team-1')!.players.map((p) => p.name)).toEqual(['Daanish']);
		/* en de standaardnaam hernoemt het team niet */
		expect(s.teams[0].naam).toBe('JO13-1');
		expect(app.toestand.teamName).toBe('JO13-1');
	});

	/* Supabase geeft hooguit duizend rijen per keer; een seizoen trainingen is meer. */
	it('haalt ook meer dan duizend rijen op', async () => {
		const s = nepServer();
		s.team('team-1', 'JO13-1');
		const t = vanDeTelefoon();
		t.players = Array.from({ length: 20 }, (_, i) => ({ id: id(100 + i), name: 'Speler ' + i, line: 'M' as const }));
		t.trainings = Array.from({ length: 60 }, (_, i) => ({
			id: id(1000 + i),
			date: '2026-' + String(9 + Math.floor(i / 28)).padStart(2, '0') + '-' + String(1 + (i % 28)).padStart(2, '0'),
			status: Object.fromEntries(t.players.map((p) => [p.id, 'present' as const]))
		}));
		s.vul('team-1', t);
		expect(s.rijenVan('training_spelers', 'team-1').length).toBe(1200);

		await sync.kijkEven();

		expect(app.toestand.trainings).toHaveLength(60);
		expect(app.toestand.trainings.every((tr) => Object.keys(tr.status).length === 20)).toBe(true);
	});
});

describe('vanzelf bijwerken', () => {
	async function opgehaald() {
		const s = nepServer();
		s.team('team-1', 'JO13-1');
		s.vul('team-1', vanDeTelefoon());
		await sync.kijkEven();
		s.log = [];
		return s;
	}

	it('stuurt alleen op wat er veranderde', async () => {
		const s = await opgehaald();
		app.renamePlayer(app.toestand.players[1], 'Noah B.');
		expect(sync.vies).toBe(true);

		await sync.duwAlsNodig();

		expect(sync.vies).toBe(false);
		expect(s.schrijfacties()).toEqual([
			{ method: 'PATCH', pad: '/rest/v1/spelers?id=eq.' + id(2), body: { naam: 'Noah B.' } }
		]);
	});

	it('zet een nieuwe speler erbij', async () => {
		const s = await opgehaald();
		app.addPlayerNames('Milan');
		await sync.duwAlsNodig();
		expect(s.toestand('team-1')!.players.map((p) => p.name)).toEqual(['Sem', 'Noah', 'Luuk', 'Milan']);
	});

	it('stuurt een wedstrijd op die je klaarzet, zodat de telefoon hem ziet', async () => {
		const s = await opgehaald();
		app.newMatch('Feyenoord', false);
		await sync.duwAlsNodig();
		const w = s.toestand('team-1')!.match!;
		expect(w.opponent).toBe('Feyenoord');
		expect(w.home).toBe(false);
		expect(w.id).toBe(app.toestand.match!.id);
	});

	it('laat staan wat een ander toestel intussen deed', async () => {
		const s = await opgehaald();
		/* de telefoon zet een speler erbij, het web hernoemt een ander */
		const telefoon = s.toestand('team-1')!;
		telefoon.players.push({ id: id(4), name: 'Finn', line: 'V' });
		s.vul('team-1', telefoon);
		app.renamePlayer(app.toestand.players[0], 'Sem K.');

		await sync.duwAlsNodig();
		expect(s.toestand('team-1')!.players.map((p) => p.name)).toEqual(['Sem K.', 'Noah', 'Luuk', 'Finn']);

		await sync.kijkEven();
		expect(namen()).toEqual(['Sem K.', 'Noah', 'Luuk', 'Finn']);
	});

	it('haalt op wat de telefoon deed', async () => {
		const s = await opgehaald();
		const telefoon = s.toestand('team-1')!;
		telefoon.trainings[0].status[id(3)] = 'absent';
		s.vul('team-1', telefoon);

		await sync.kijkEven();

		expect(app.toestand.trainings[0].status[id(3)]).toBe('absent');
		expect(sync.vies).toBe(false);
	});

	/*
	 * De wedstrijd houd je bij op de telefoon. Een oudere kopie hier mag zijn
	 * wissels en doelpunten niet weghalen: het web volgt.
	 */
	it('volgt de wedstrijd van de telefoon, ook als die hier al liep', async () => {
		const s = await opgehaald();
		app.newMatch('Feyenoord', true);
		app.toggleRunning();
		await sync.duwAlsNodig();

		const telefoon = s.toestand('team-1')!;
		telefoon.match!.events.push({ type: 'goal', t: 300, player: id(3) }, { type: 'goal', t: 500, player: id(2) });
		s.vul('team-1', telefoon);

		await sync.kijkEven();

		expect(app.toestand.match!.events.filter((g) => g.type === 'goal')).toHaveLength(2);
		expect(s.toestand('team-1')!.match!.events.filter((g) => g.type === 'goal')).toHaveLength(2);
		expect(sync.vies).toBe(false);
	});

	it('haalt niet stiekem op als er hier nog iets klaarstaat', async () => {
		const s = await opgehaald();
		const telefoon = s.toestand('team-1')!;
		telefoon.players[0].name = 'Van de telefoon';
		s.vul('team-1', telefoon);
		sync.vies = true;

		await sync.ophalen(true);

		expect(namen()[0]).toBe('Sem');
	});

	/* Haalt hij op terwijl de trainer tikt, dan gaat die tik voor: eerst opsturen. */
	it('gooit geen tik weg die tijdens het ophalen kwam', async () => {
		const s = await opgehaald();
		const telefoon = s.toestand('team-1')!;
		telefoon.players[2].name = 'Luuk van de telefoon';
		s.vul('team-1', telefoon);

		const bezig = sync.ophalen(true);
		app.renamePlayer(app.toestand.players[0], 'Sem tijdens het ophalen');
		await bezig;
		expect(namen()[0]).toBe('Sem tijdens het ophalen');

		await sync.kijkEven();
		expect(namen()).toEqual(['Sem tijdens het ophalen', 'Noah', 'Luuk van de telefoon']);
	});

	it('vervangt met de hand alles door wat er in het account staat', async () => {
		const s = await opgehaald();
		app.toestand.players[0].name = 'Nog niet opgestuurd';
		const telefoon = s.toestand('team-1')!;
		telefoon.players[1].name = 'Noah van de telefoon';
		s.vul('team-1', telefoon);

		await sync.ophalen();

		expect(namen()).toEqual(['Sem', 'Noah van de telefoon', 'Luuk']);
	});

	/* Een leeg toestel is bijna altijd een nieuw of gewist toestel, en geen trainer die zijn seizoen weg wil. */
	it('maakt een team nooit leeg omdat er hier niets staat', async () => {
		const s = await opgehaald();
		app.wisAlles();

		await sync.duwAlsNodig();

		expect(s.toestand('team-1')!.players).toHaveLength(3);
		expect(s.schrijfacties()).toHaveLength(0);
		expect(namen()).toEqual(['Sem', 'Noah', 'Luuk']);
	});

	it('haalt wel een losse training weg', async () => {
		const s = await opgehaald();
		app.removeTraining(app.toestand.trainings[0]);
		await sync.duwAlsNodig();
		expect(s.toestand('team-1')!.trainings).toHaveLength(0);
		expect(s.rijenVan('training_spelers', 'team-1')).toHaveLength(0);
	});

	it('houdt wijzigingen vast als er geen bereik is', async () => {
		const s = await opgehaald();
		s.stuk = true;
		app.addPlayerNames('Milan');
		await sync.duwAlsNodig();
		expect(sync.vies).toBe(true);
		expect(sync.hapert).toBe(true);

		s.stuk = false;
		await sync.duwAlsNodig();
		expect(sync.vies).toBe(false);
		expect(s.toestand('team-1')!.players).toHaveLength(4);
	});

	/*
	 * Een weigering wordt nooit beter van opnieuw proberen, en blijft hij staan
	 * dan komt er nooit meer iets door. Dus: de rest gaat door, en het wordt
	 * opgeschreven.
	 */
	it('laat één geweigerde rij de rest niet tegenhouden', async () => {
		const s = await opgehaald();
		issues.lijst = [];
		s.weiger = (_m, tabel, r) => (tabel === 'spelers' && r.naam === 'Fout' ? 400 : null);
		app.addPlayerNames('Milan\nFout\nJesse');

		await sync.duwAlsNodig();

		expect(s.toestand('team-1')!.players.map((p) => p.name)).toEqual(['Sem', 'Noah', 'Luuk', 'Milan', 'Jesse']);
		expect(sync.geweigerd).toBe(1);
		expect(issues.lijst[0].what).toContain('weigerde 1 wijziging');
		expect(sync.vies).toBe(false);
	});

	it('wacht steeds langer als het opsturen blijft mislukken', async () => {
		const s = await opgehaald();
		s.stuk = true;
		app.addPlayerNames('Milan');
		const wachten: number[] = [];
		const echt = globalThis.setTimeout;
		globalThis.setTimeout = ((_fn: () => void, ms: number) => {
			wachten.push(ms);
			return 0 as unknown as ReturnType<typeof setTimeout>;
		}) as typeof setTimeout;
		for (let i = 0; i < 8; i++) await sync.duwAlsNodig();
		globalThis.setTimeout = echt;

		expect(wachten.length).toBeGreaterThan(3);
		/* oplopend, en nooit langer dan vijf minuten */
		expect(wachten.at(-1)!).toBeGreaterThan(wachten[1]);
		expect(Math.max(...wachten)).toBeLessThanOrEqual(300_000);
	});

	it('doet niets bij het openen als alles al klopt', async () => {
		const s = await opgehaald();
		await sync.kijkEven();
		expect(s.schrijfacties()).toHaveLength(0);
		expect(sync.vies).toBe(false);
	});
});

/*
 * Een team aanmaken.
 *
 * De eerste keer synchroniseren is er nog geen team op de server. Dat moet dan
 * ontstaan, en precies één keer: twee teams voor dezelfde trainer betekent dat de
 * ene telefoon de ene helft van het seizoen bijhoudt en de andere de andere.
 */
describe('het team op de server', () => {
	it('neemt een bestaand team over', async () => {
		const s = nepServer();
		s.team('team-1', 'JO13-1');
		sync.sessie!.teamId = undefined;
		await sync.opsturen();
		expect(sync.sessie!.teamId).toBe('team-1');
	});

	it('maakt er een aan als er nog geen is, en zet alles erin', async () => {
		const s = nepServer();
		app.toestand.teamName = 'JO14-3';
		sync.sessie!.teamId = undefined;

		await sync.opsturen();

		expect(s.teams).toHaveLength(1);
		expect(s.teams[0]).toMatchObject({ naam: 'JO14-3', eigenaar: 'u1' });
		expect(sync.sessie!.teamId).toBe(s.teams[0].id);
		expect(s.toestand(s.teams[0].id)!.players.map((p) => p.name)).toEqual(['Daanish']);
	});

	it('vraagt het bij de tweede keer niet opnieuw', async () => {
		const s = nepServer();
		s.team('team-1', 'JO13-1');
		await sync.opsturen();
		s.log = [];
		await sync.opsturen();
		expect(s.log.filter((v) => v.pad.startsWith('/rest/v1/teams?select=id,naam'))).toHaveLength(0);
	});
});

/*
 * Meerdere trainers per team.
 *
 * De database bewaakt wie er waarbij mag; die proef staat in supabase/test. Wat
 * hier bewaakt wordt is het toestel: welk team het volgt. Het verkeerde team
 * pakken betekent dat jouw seizoen over dat van iemand anders heen gaat.
 */
describe('welk team dit toestel volgt', () => {
	it('gokt niet als je bij meer dan één team hoort', async () => {
		const s = nepServer();
		s.team('team-1', 'JO13-1');
		s.team('team-2', 'JO15-2');
		sync.sessie!.teamId = undefined;

		await sync.opsturen();

		expect(sync.sessie!.teamId).toBeUndefined();
		expect(sync.mijnTeams.map((t) => t.naam)).toEqual(['JO13-1', 'JO15-2']);
		expect(s.schrijfacties()).toHaveLength(0);
		expect(sync.message).toContain('Kies');
		/* geen storing, dus ook niet 'geen verbinding' */
		expect(sync.hapert).toBe(false);
	});

	/*
	 * De bron van de verwarring op 7 september: de tweede trainer kreeg bij zijn
	 * eerste inlog automatisch een eigen leeg team, en nam daarna pas de
	 * uitnodiging aan.
	 */
	it('maakt geen leeg team aan als er een uitnodiging klaarstaat', async () => {
		const s = nepServer();
		s.team('team-9', 'JO15-2', 'u2');
		s.uitnodigingen.push({ id: 'x', team_id: 'team-9', email: 'trainer@voorbeeld.nl' });
		sync.sessie!.teamId = undefined;

		await sync.opsturen();

		expect(s.teams).toHaveLength(1);
		expect(sync.sessie!.teamId).toBeUndefined();
		expect(sync.message).toContain('uitnodiging');
		expect(sync.hapert).toBe(false);
	});

	it('neemt bij het overstappen de gegevens van het andere team over', async () => {
		const s = nepServer();
		s.team('team-1', 'JO13-1');
		s.team('team-9', 'JO15-2');
		s.vul('team-9', { ...vanDeTelefoon(), teamName: 'JO15-2' });
		sync.mijnTeams = [
			{ id: 'team-1', naam: 'JO13-1' },
			{ id: 'team-9', naam: 'JO15-2' }
		];

		await sync.kiesTeam('team-9');

		expect(sync.sessie!.teamId).toBe('team-9');
		expect(app.toestand.teamName).toBe('JO15-2');
		expect(namen()).toEqual(['Sem', 'Noah', 'Luuk']);
		/* en er is niets heen gegaan */
		expect(s.schrijfacties()).toHaveLength(0);
	});

	/* Stap je over naar een team waar nog niets staat, dan gaat wat hier staat niet mee. */
	it('draagt geen gegevens van het ene team het andere in', async () => {
		const s = nepServer();
		s.team('team-1', 'JO13-1');
		s.team('team-9', 'JO15-2');
		app.toestand.teamName = 'JO13-1';

		await sync.kiesTeam('team-9');
		await sync.duwAlsNodig();

		expect(app.toestand.players).toHaveLength(0);
		expect(app.toestand.teamName).toBe('JO15-2');
		expect(s.rijenVan('spelers', 'team-9')).toHaveLength(0);
	});

	/* Maar wie nergens vandaan komt houdt wat hij heeft: dat ís het begin. */
	it('laat wat er staat met rust als dit het eerste team is', async () => {
		const s = nepServer();
		s.team('team-9', 'JO15-2');
		sync.sessie!.teamId = undefined;

		await sync.kiesTeam('team-9');
		await sync.duwAlsNodig();

		expect(sync.sessie!.teamId).toBe('team-9');
		expect(namen()).toEqual(['Daanish']);
		expect(s.toestand('team-9')!.players.map((p) => p.name)).toEqual(['Daanish']);
	});

	it('stapt niet half over als het ophalen mislukt', async () => {
		const s = nepServer();
		s.team('team-1', 'JO13-1');
		s.team('team-9', 'JO15-2');
		s.stuk = true;
		app.toestand.teamName = 'JO13-1';

		await sync.kiesTeam('team-9');

		expect(sync.sessie!.teamId).toBe('team-1');
		expect(app.toestand.teamName).toBe('JO13-1');
		expect(sync.message).toContain('niets veranderd');
	});

	it('stapt niet over zolang er hier nog iets klaarstaat', async () => {
		nepServer();
		sync.vies = true;
		await sync.kiesTeam('team-2');
		expect(sync.sessie!.teamId).toBe('team-1');
		expect(sync.message).toContain('Stuur eerst op');
	});

	/* Volgt dit toestel nog geen team, dan hoort wat er klaarstaat nergens bij. */
	it('laat een toestel dat nog nergens bij hoort wel kiezen', async () => {
		const s = nepServer();
		s.team('team-9', 'JO15-2');
		sync.sessie!.teamId = undefined;
		sync.vies = true;
		await sync.kiesTeam('team-9');
		expect(sync.sessie!.teamId).toBe('team-9');
	});

	it('kiest geen team waar je niet bij hoort', async () => {
		const s = nepServer();
		s.team('team-1', 'JO13-1');
		s.team('team-9', 'JO15-2', 'u2');
		await sync.kiesTeam('team-9');
		expect(sync.sessie!.teamId).toBe('team-1');
		expect(sync.message).toContain('niets veranderd');
	});
});

describe('als de ploeg nog niet op de server staat', () => {
	it('werkt gewoon bij, zonder te klagen', async () => {
		const s = nepServer();
		s.team('team-1', 'JO13-1');
		s.zonderPloeg = true;
		await sync.kijkEven();
		await sync.opsturen();
		expect(sync.message).toBe('Bijgewerkt.');
		await sync.haalPloeg();
		expect(sync.leden).toHaveLength(0);
		await sync.kijkNaarUitnodigingen();
		expect(sync.uitgenodigdVoor).toHaveLength(0);
	});
});

/*
 * Zelf een team beginnen.
 *
 * Wie was uitgenodigd voor het team van een ander moet ook zijn eigen ploeg
 * kunnen beginnen.
 */
describe('een eigen team beginnen', () => {
	async function bijTeam1() {
		const s = nepServer();
		s.team('team-1', 'JO13-1');
		s.vul('team-1', vanDeTelefoon());
		await sync.kijkEven();
		s.log = [];
		return s;
	}

	it('maakt een team op jouw naam en volgt het meteen', async () => {
		const s = await bijTeam1();

		await sync.nieuwTeam('  JO10-4  ');

		const nieuw = s.teams.find((t) => t.naam === 'JO10-4')!;
		expect(nieuw.eigenaar).toBe('u1');
		expect(sync.sessie!.teamId).toBe(nieuw.id);
		expect(app.toestand.teamName).toBe('JO10-4');
	});

	/* Wat er in de app stond hoort bij het team dat je verlaat. */
	it('begint leeg, en laat het vorige team heel', async () => {
		const s = await bijTeam1();

		await sync.nieuwTeam('JO10-4');

		expect(app.toestand.players).toHaveLength(0);
		expect(s.toestand('team-1')!.players).toHaveLength(3);
		const nieuw = s.teams.find((t) => t.naam === 'JO10-4')!;
		expect(s.rijenVan('spelers', nieuw.id)).toHaveLength(0);
	});

	it('houdt wat er staat als dit je eerste team is', async () => {
		const s = nepServer();
		sync.sessie!.teamId = undefined;

		await sync.nieuwTeam('JO10-4');

		expect(namen()).toEqual(['Daanish']);
		expect(s.toestand(sync.sessie!.teamId!)!.players.map((p) => p.name)).toEqual(['Daanish']);
	});

	it('vraagt om een naam', async () => {
		const s = nepServer();
		await sync.nieuwTeam('   ');
		expect(s.schrijfacties()).toHaveLength(0);
		expect(sync.message).toContain('naam');
	});

	it('begint niets nieuws zolang er hier iets klaarstaat', async () => {
		const s = await bijTeam1();
		sync.vies = true;
		await sync.nieuwTeam('JO10-4');
		expect(s.teams).toHaveLength(1);
		expect(sync.sessie!.teamId).toBe('team-1');
	});
});

describe('de teamnaam op de server', () => {
	it('werkt de naam bij zodra de trainer hem verandert', async () => {
		const s = nepServer();
		s.team('team-1', 'JO13-1');
		await sync.kijkEven();
		app.setTeamName('JO13-2');
		await sync.duwAlsNodig();
		expect(s.teams[0].naam).toBe('JO13-2');
	});

	/* Een trainer die niet de eigenaar is kan de naam niet veranderen. Dat mag
	   geen lus worden: de server werkt dan stil niets bij. */
	it('probeert het niet bij elke opslag opnieuw', async () => {
		const s = nepServer();
		s.team('team-1', 'JO13-1', 'u2', ['u2', 'u1']);
		await sync.kijkEven();
		app.setTeamName('JO13-9');
		await sync.duwAlsNodig();
		await sync.opsturen();
		await sync.opsturen();
		expect(s.log.filter((v) => v.method === 'PATCH' && v.pad.startsWith('/rest/v1/teams'))).toHaveLength(1);
		expect(s.teams[0].naam).toBe('JO13-1');
	});
});

/*
 * De hele heen-en-weer.
 *
 * Tjaco's vraag: en als ik daarna weer terugswitch, nadat ik met dat tweede
 * account een nieuw team heb gemaakt? Dat is precies de reis waarop gegevens van
 * de een bij de ander kunnen belanden.
 */
describe('heen en weer tussen twee accounts', () => {
	it('houdt de twee seizoenen uit elkaar, de hele reis lang', async () => {
		const s = nepServer();
		s.emails.u1 = 'tjaco@voorbeeld.nl';
		s.emails.u2 = 'matthijs@voorbeeld.nl';
		sync.sessie = null;
		app.toestand = emptyState();
		const logIn = async (wie: string) => {
			s.wie = wie;
			sync.email = s.emails[wie];
			await sync.controleerCode('12345678');
		};

		/* Tjaco richt zijn team in en stuurt het op. */
		await logIn('u1');
		app.setTeamName('JO14-3');
		app.addPlayerNames('Bram');
		await sync.opsturen();
		const teamTjaco = sync.sessie!.teamId!;
		expect(s.toestand(teamTjaco)!.players.map((p) => p.name)).toEqual(['Bram']);

		/* Uitloggen, en Matthijs logt in op hetzelfde toestel. */
		sync.uitloggen();
		await logIn('u2');
		expect(sync.andereGebruiker).toBe('tjaco@voorbeeld.nl');

		/* Hij begint schoon en maakt zijn eigen team. */
		sync.beginSchoon();
		await new Promise((r) => setTimeout(r, 0));
		expect(app.toestand.players).toHaveLength(0);
		await sync.nieuwTeam('JO10-4');
		app.addPlayerNames('Sil');
		await sync.opsturen();
		const teamMatthijs = sync.sessie!.teamId!;
		expect(teamMatthijs).not.toBe(teamTjaco);
		expect(s.toestand(teamMatthijs)!.players.map((p) => p.name)).toEqual(['Sil']);

		/* En Tjaco's team is onderweg niet aangeraakt. */
		expect(s.toestand(teamTjaco)!.players.map((p) => p.name)).toEqual(['Bram']);

		/* Terug naar Tjaco. Weer de vraag, want er staat nu Matthijs' team. */
		sync.uitloggen();
		await logIn('u1');
		expect(sync.andereGebruiker).toBe('matthijs@voorbeeld.nl');

		/* Schoon beginnen haalt meteen zijn eigen seizoen terug. */
		sync.beginSchoon();
		await new Promise((r) => setTimeout(r, 0));
		await new Promise((r) => setTimeout(r, 0));
		expect(app.toestand.teamName).toBe('JO14-3');
		expect(namen()).toEqual(['Bram']);
		expect(sync.sessie!.teamId).toBe(teamTjaco);

		/* En het team van Matthijs is nog steeds van hem. */
		expect(s.toestand(teamMatthijs)!.players.map((p) => p.name)).toEqual(['Sil']);
	});
});

describe('inloggen op een telefoon', () => {
	it('onthoudt voor wie er een code onderweg is, ook na herladen', async () => {
		globalThis.fetch = vi.fn(async () => new Response('{}', { status: 200 })) as unknown as typeof fetch;
		sync.sessie = null;
		await sync.stuurCode('trainer@voorbeeld.nl');
		expect(sync.fase).toBe('code');

		/* as if the app reloads while you are over in your mail */
		sync.sessie = null;
		sync.fase = 'email';
		sync.email = '';
		sync.load();
		expect(sync.fase).toBe('code');
		expect(sync.email).toBe('trainer@voorbeeld.nl');
	});

	it('vergeet de poging zodra je binnen bent', async () => {
		globalThis.fetch = vi.fn(async (url: string) =>
			url.includes('verify')
				? new Response(
						JSON.stringify({
							access_token: 'a',
							refresh_token: 'r',
							expires_in: 3600,
							user: { id: 'u', email: 'trainer@voorbeeld.nl' }
						}),
						{ status: 200 }
					)
				: new Response('{}', { status: 200 })
		) as unknown as typeof fetch;
		await sync.stuurCode('trainer@voorbeeld.nl');
		await sync.controleerCode('123456');
		expect(sync.sessie?.email).toBe('trainer@voorbeeld.nl');
		sync.sessie = null;
		sync.fase = 'email';
		sync.load();
		expect(sync.fase).toBe('email');
	});
});

/*
 * Inloggen.
 *
 * Dit is het enige stuk van de app dat met een e-mailadres werkt, en het gaat op
 * twee manieren: een code overtypen of op de link in de mail klikken. Die tweede
 * weg brengt de sleutels achter een # in het adres mee, en die moeten daar meteen
 * weer uit — anders blijft je toegangstoken in de geschiedenis van de browser
 * staan.
 */
describe('inloggen', () => {
	beforeEach(() => {
		sync.sessie = null;
		sync.fase = 'email';
		sync.email = '';
		sync.message = '';
	});

	it('vraagt om een adres als je er geen invult', async () => {
		nepFetch();
		await sync.stuurCode('   ');
		expect(sync.message).toContain('e-mailadres');
		expect(sync.fase).toBe('email');
	});

	it('verstuurt de mail en gaat wachten op de code', async () => {
		const { f } = nepFetch();
		await sync.stuurCode(' trainer@voorbeeld.nl ');
		expect(f.mock.calls[0][0]).toContain('/auth/v1/otp');
		expect(sync.email).toBe('trainer@voorbeeld.nl');
		expect(sync.fase).toBe('code');
		expect(sync.message).toContain('trainer@voorbeeld.nl');
	});

	it('zegt het als versturen niet lukt', async () => {
		nepFetch({ stuk: true });
		await sync.stuurCode('trainer@voorbeeld.nl');
		expect(sync.message).toContain('lukte niet');
		expect(sync.fase).toBe('email');
	});

	it('vraagt om de code als je er geen invult', async () => {
		nepFetch();
		await sync.controleerCode('  ');
		expect(sync.message).toContain('code uit de mail');
	});

	it('logt in met een kloppende code', async () => {
		globalThis.fetch = vi.fn(async (url: string) => {
			if (String(url).includes('/auth/v1/verify')) {
				return new Response(JSON.stringify({ access_token: 'nieuw', refresh_token: 'r2', expires_in: 3600 }), {
					status: 200
				});
			}
			return new Response('{}', { status: 200 });
		}) as unknown as typeof fetch;
		sync.email = 'trainer@voorbeeld.nl';
		await sync.controleerCode(' 123456 ');
		expect(sync.sessie?.access_token).toBe('nieuw');
		expect(sync.fase).toBe('email');
		expect(sync.message).toBe('Ingelogd.');
	});

	it('zegt het als de code niet klopt', async () => {
		nepFetch({ stuk: true });
		sync.email = 'trainer@voorbeeld.nl';
		await sync.controleerCode('000000');
		expect(sync.message).toContain('klopt niet');
		expect(sync.sessie).toBeNull();
	});

	it('logt je uit en laat niets achter', async () => {
		nepFetch();
		sync.sessie = { access_token: 'x', refresh_token: 'y' } as never;
		sync.vies = true;
		sync.uitloggen();
		expect(sync.sessie).toBeNull();
		expect(sync.vies).toBe(false);
		expect(localStorage.getItem('o14-sessie-v1')).toBeFalsy();
		/* en ook niet wat er van het team in de tabellen stond */
		expect(localStorage.getItem('o14-gespiegeld-v1')).toBeFalsy();
	});
});

describe('terugkomen uit de mail', () => {
	function metHash(h: string) {
		Object.defineProperty(window, 'location', {
			value: { ...window.location, hash: h, pathname: '/app/meer', search: '', origin: 'http://localhost' },
			writable: true,
			configurable: true
		});
		history.replaceState = vi.fn();
	}

	beforeEach(() => {
		sync.sessie = null;
		sync.message = '';
	});

	it('doet niets als er niets in het adres staat', async () => {
		metHash('');
		nepFetch();
		await sync.pakInlogUitLink();
		expect(sync.sessie).toBeNull();
	});

	it('neemt de sleutels uit het adres over', async () => {
		metHash('#access_token=abc&refresh_token=def&expires_in=3600');
		globalThis.fetch = vi.fn(
			async () => new Response(JSON.stringify({ id: 'u9', email: 'trainer@voorbeeld.nl' }), { status: 200 })
		) as unknown as typeof fetch;
		await sync.pakInlogUitLink();
		expect(sync.sessie?.access_token).toBe('abc');
		expect(sync.sessie?.email).toBe('trainer@voorbeeld.nl');
		expect(sync.message).toContain('via de link');
	});

	/* Het token mag niet in de adresbalk blijven staan. */
	it('veegt het adres schoon', async () => {
		metHash('#access_token=abc&refresh_token=def');
		nepFetch();
		await sync.pakInlogUitLink();
		expect(history.replaceState).toHaveBeenCalled();
	});

	it('logt toch in als het opzoeken van het adres mislukt', async () => {
		metHash('#access_token=abc&refresh_token=def');
		nepFetch({ stuk: true });
		await sync.pakInlogUitLink();
		expect(sync.sessie?.access_token).toBe('abc');
	});

	it('vertelt wat er misging als de link niet meer geldig is', async () => {
		metHash('#error=access_denied&error_description=Email+link+is+invalid+or+has+expired');
		nepFetch();
		await sync.pakInlogUitLink();
		expect(sync.message).toContain('invalid');
		expect(sync.sessie).toBeNull();
	});
});

describe('wie er bij het team kan', () => {
	function metPloeg(leden: { gebruiker: string; rol: string }[], open: { id: string; email: string }[] = []) {
		const verstuurd: { url: string; method?: string; body?: unknown }[] = [];
		globalThis.fetch = vi.fn(async (url: string, init?: RequestInit) => {
			const u = String(url);
			verstuurd.push({ url: u, method: init?.method, body: init?.body ? JSON.parse(String(init.body)) : null });
			if (u.includes('team_leden')) return new Response(JSON.stringify(leden), { status: 200 });
			if (u.includes('uitnodigingen')) return new Response(JSON.stringify(open), { status: 200 });
			return new Response('{}', { status: 200 });
		}) as unknown as typeof fetch;
		return verstuurd;
	}

	beforeEach(() => {
		sync.leden = [];
		sync.openstaand = [];
		sync.message = '';
	});

	it('haalt op wie er lid is en wat er openstaat', async () => {
		metPloeg([{ gebruiker: 'u1', rol: 'eigenaar' }], [{ id: 'i1', email: 'matthijs@voorbeeld.nl' }]);
		await sync.haalPloeg();
		expect(sync.leden).toHaveLength(1);
		expect(sync.openstaand[0].email).toBe('matthijs@voorbeeld.nl');
	});

	it('nodigt uit op adres', async () => {
		const verstuurd = metPloeg([]);
		await sync.nodigUit(' Matthijs@Voorbeeld.nl ');
		const post = verstuurd.find((v) => v.url.includes('uitnodigingen') && v.method === 'POST');
		expect(post?.body).toMatchObject({ email: 'Matthijs@Voorbeeld.nl', team_id: 'team-1', door: 'u1' });
		expect(sync.message).toContain('uitgenodigd');
	});

	it('vraagt om een adres als je iets anders intikt', async () => {
		const verstuurd = metPloeg([]);
		await sync.nodigUit('matthijs');
		expect(verstuurd.some((v) => v.method === 'POST')).toBe(false);
		expect(sync.message).toContain('e-mailadres');
	});

	/* Twee keer hetzelfde adres is geen fout om iemand mee lastig te vallen: het
	   antwoord op zijn vraag is gewoon ja. */
	it('zegt gewoon ja als het adres er al stond', async () => {
		globalThis.fetch = vi.fn(async (url: string, init?: RequestInit) => {
			if (String(url).includes('uitnodigingen') && init?.method === 'POST') {
				return new Response(JSON.stringify({ code: '23505', message: 'duplicate key' }), { status: 409 });
			}
			return new Response('[]', { status: 200 });
		}) as unknown as typeof fetch;
		await sync.nodigUit('matthijs@voorbeeld.nl');
		expect(sync.message).toContain('was al uitgenodigd');
	});

	it('trekt een uitnodiging weer in', async () => {
		const verstuurd = metPloeg([]);
		await sync.trekIn('i1');
		expect(verstuurd.some((v) => v.method === 'DELETE' && v.url.includes('id=eq.i1'))).toBe(true);
	});

	it('haalt iemand er weer uit', async () => {
		const verstuurd = metPloeg([]);
		await sync.haalEruit('u2');
		expect(
			verstuurd.some((v) => v.method === 'DELETE' && v.url.includes('team_leden') && v.url.includes('gebruiker=eq.u2'))
		).toBe(true);
	});
});

describe('uitgenodigd worden', () => {
	beforeEach(() => {
		sync.uitgenodigdVoor = [];
		sync.mijnTeams = [];
		sync.message = '';
	});

	it('ziet een uitnodiging van een ander team staan, met de naam erbij', async () => {
		globalThis.fetch = vi.fn(async (url: string) => {
			const u = String(url);
			if (u.includes('uitnodigingen')) {
				return new Response(JSON.stringify([{ team_id: 'team-9' }]), { status: 200 });
			}
			if (u.includes('teams?select=id'))
				return new Response(JSON.stringify([{ id: 'team-9', naam: 'JO15-2' }]), { status: 200 });
			return new Response('[]', { status: 200 });
		}) as unknown as typeof fetch;
		await sync.kijkNaarUitnodigingen();
		expect(sync.uitgenodigdVoor).toEqual([{ id: 'team-9', naam: 'JO15-2' }]);
	});

	/* De eigenaar ziet zijn eigen openstaande uitnodigingen ook; die horen hier
	   niet als 'je bent uitgenodigd' te verschijnen. */
	it('rekent je eigen openstaande uitnodiging niet mee', async () => {
		globalThis.fetch = vi.fn(
			async () => new Response(JSON.stringify([{ team_id: 'team-1' }]), { status: 200 })
		) as unknown as typeof fetch;
		await sync.kijkNaarUitnodigingen();
		expect(sync.uitgenodigdVoor).toHaveLength(0);
	});

	/*
	 * De doodlopende weg van 7 september.
	 *
	 * Wie net is uitgenodigd en zelf nog geen team heeft, houdt er precies één
	 * over. De knoppen verschenen pas bij twee of meer, dus die persoon zag
	 * 'Aangenomen. Kies hieronder welk team je wilt' met niets eronder — op het
	 * moment dat hij voor het eerst binnenkwam.
	 */
	it('zet ook bij één team de knop neer', async () => {
		globalThis.fetch = vi.fn(async (url: string) => {
			const u = String(url);
			if (u.includes('uitnodiging_aannemen')) return new Response(JSON.stringify(['team-9']), { status: 200 });
			if (u.includes('teams?select=id'))
				return new Response(JSON.stringify([{ id: 'team-9', naam: 'JO15-2' }]), { status: 200 });
			return new Response('[]', { status: 200 });
		}) as unknown as typeof fetch;

		await sync.neemUitnodigingAan();
		expect(sync.mijnTeams).toEqual([{ id: 'team-9', naam: 'JO15-2' }]);
		expect(sync.message).not.toContain('Kies hieronder');
	});

	it('neemt aan en vraagt daarna welk team dit toestel volgt', async () => {
		globalThis.fetch = vi.fn(async (url: string) => {
			const u = String(url);
			if (u.includes('uitnodiging_aannemen')) return new Response(JSON.stringify(['team-9']), { status: 200 });
			if (u.includes('teams?select=id'))
				return new Response(
					JSON.stringify([
						{ id: 'team-1', naam: 'JO13-1' },
						{ id: 'team-9', naam: 'JO15-2' }
					]),
					{ status: 200 }
				);
			return new Response('[]', { status: 200 });
		}) as unknown as typeof fetch;
		const teams = await sync.neemUitnodigingAan();
		expect(teams).toEqual(['team-9']);
		expect(sync.mijnTeams).toHaveLength(2);
		expect(sync.uitgenodigdVoor).toHaveLength(0);
	});

	/*
	 * Wat PostgREST teruggeeft voor een functie die 'setof uuid' oplevert, zie je
	 * pas tegen de echte server: een lijst tekst, of een lijst objecten met één
	 * veld. Gokt de app verkeerd, dan zegt hij dat er geen uitnodiging klaarstond
	 * terwijl hij hem net heeft aangenomen — en dan probeert de trainer het nog
	 * eens, en nog eens.
	 */
	it('begrijpt het antwoord ook als het in objecten verpakt zit', async () => {
		globalThis.fetch = vi.fn(async (url: string) => {
			const u = String(url);
			if (u.includes('uitnodiging_aannemen')) {
				return new Response(JSON.stringify([{ uitnodiging_aannemen: 'team-9' }]), { status: 200 });
			}
			if (u.includes('teams?select=id'))
				return new Response(JSON.stringify([{ id: 'team-9', naam: 'JO15-2' }]), { status: 200 });
			return new Response('[]', { status: 200 });
		}) as unknown as typeof fetch;
		const teams = await sync.neemUitnodigingAan();
		expect(teams).toEqual(['team-9']);
		expect(sync.message).toContain('Aangenomen');
	});

	it('zegt het als er niets klaarstond', async () => {
		globalThis.fetch = vi.fn(async () => new Response('[]', { status: 200 })) as unknown as typeof fetch;
		await sync.neemUitnodigingAan();
		expect(sync.message).toContain('geen uitnodiging');
	});
});

/*
 * Voordat het nieuwe schema erin staat.
 *
 * De app gaat live via Netlify zodra main groen is; schema.sql draait iemand met
 * de hand in Supabase. Tussen die twee momenten zit tijd, en dan bestaan
 * team_leden en uitnodigingen nog niet. Dat mag niets kapotmaken: een trainer die
 * er niets van weet moet gewoon zijn wedstrijd kunnen bijhouden.
 */

/*
 * Vastzitten op een keuze.
 *
 * Hoor je bij twee teams en heb je nog niet gekozen, dan kán er niet opgestuurd
 * worden. Dat is geen storing maar een vraag aan de trainer. De app mag daar niet
 * eindeloos op blijven kloppen, en al helemaal niet melden dat er geen verbinding
 * is — dan gaat hij naar buiten lopen met zijn telefoon in de lucht terwijl hij
 * gewoon op een knop moet drukken.
 */
describe('wachten op een teamkeuze', () => {
	beforeEach(() => {
		sync.mijnTeams = [];
		sync.hapert = false;
		sync.message = '';
		sync.sessie!.teamId = undefined;
		globalThis.fetch = vi.fn(async (url: string) => {
			if (String(url).includes('teams?select=id')) {
				return new Response(
					JSON.stringify([
						{ id: 'team-1', naam: 'JO13-1' },
						{ id: 'team-9', naam: 'JO15-2' }
					]),
					{ status: 200 }
				);
			}
			return new Response('{}', { status: 200 });
		}) as unknown as typeof fetch;
	});

	it('zegt wat er moet gebeuren in plaats van dat er iets mis is', async () => {
		await sync.opsturen();
		expect(sync.mijnTeams).toHaveLength(2);
		expect(sync.message).toContain('Kies');
		expect(sync.message).not.toContain('lukte niet');
	});

	/* 'hapert' betekent: geen bereik. Dat is hier niet zo, en het scherm zou het
	   anders zo opschrijven. */
	it('noemt het geen verbindingsprobleem', async () => {
		await sync.opsturen();
		expect(sync.hapert).toBe(false);
	});

	it('blijft er niet op kloppen', async () => {
		vi.useFakeTimers();
		await sync.opsturen();
		const naEerste = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length;
		vi.advanceTimersByTime(10 * 60_000);
		expect((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(naEerste);
		vi.useRealTimers();
	});
});

/*
 * De noodrem.
 *
 * Op 7 september stonden er 81.705.953 API-verzoeken in de statistieken van
 * Postgres en de database op 100% processor. De lus zelf was niet te
 * reproduceren — vier nagebootste toestanden en de echte gebouwde app tegen een
 * nepserver deden alle vier braaf niets. Daarom geen reparatie van die ene lus
 * maar een grens eromheen: alle verkeer gaat door sb(), en daar wordt geteld.
 *
 * Deze test is er niet om een bug te vangen die we kennen, maar om er een te
 * begrenzen die we niet kennen.
 */
describe('de noodrem', () => {
	beforeEach(() => {
		noodrem.los();
		sync.message = '';
		sync.hapert = false;
		globalThis.fetch = vi.fn(async () => new Response('{}', { status: 200 })) as unknown as typeof fetch;
	});

	it('laat normaal gebruik gewoon door', () => {
		const nu = Date.now();
		for (let i = 0; i < 100; i++) expect(noodrem.mag(nu + i * 10)).toBe(true);
	});

	it('slaat aan bij een lus', () => {
		const nu = Date.now();
		let doorgelaten = 0;
		/* duizend verzoeken in tien seconden: dat is geen gebruik meer */
		for (let i = 0; i < 1000; i++) if (noodrem.mag(nu + i * 10)) doorgelaten++;
		expect(doorgelaten).toBeLessThan(200);
	});

	/* Een wedstrijd duurt een uur en kost een verzoek of veertig. Die mag nooit
	   geraakt worden door de rem. */
	it('raakt een hele wedstrijd niet', () => {
		const nu = Date.now();
		let doorgelaten = 0;
		for (let i = 0; i < 40; i++) if (noodrem.mag(nu + i * 90_000)) doorgelaten++;
		expect(doorgelaten).toBe(40);
	});

	it('laat het na een kwartier weer los', () => {
		const nu = Date.now();
		for (let i = 0; i < 400; i++) noodrem.mag(nu + i * 10);
		expect(noodrem.mag(nu + 60_000)).toBe(false);
		expect(noodrem.mag(nu + 16 * 60_000)).toBe(true);
	});

	it('gaat eraf als de trainer zelf op de knop drukt', async () => {
		const nu = Date.now();
		for (let i = 0; i < 400; i++) noodrem.mag(nu + i * 10);
		expect(noodrem.mag(nu + 1000)).toBe(false);
		noodrem.los();
		expect(noodrem.mag(nu + 1001)).toBe(true);
	});

	/* En als hij erop staat: zeggen wat er is, en niet blijven proberen. */
	/*
	 * De rem is ook een instrument. De lus was niet te reproduceren, dus als hij
	 * zich weer voordoet moet de app zelf opschrijven wélke aanroep het was — in
	 * het logboekje bij Gegevens, dat met één knop door te sturen is.
	 */
	it('schrijft op wat er zo vaak werd opgevraagd', () => {
		issues.lijst = [];
		const nu = Date.now();
		for (let i = 0; i < 200; i++) noodrem.mag(nu + i * 10, '/rest/v1/team_toestand?select=data');
		expect(issues.lijst).toHaveLength(1);
		expect(issues.lijst[0].what).toContain('te veel verzoeken');
		expect(issues.lijst[0].message).toContain('/rest/v1/team_toestand');
	});

	it('zegt wat er aan de hand is en probeert het niet opnieuw', async () => {
		const nu = Date.now();
		for (let i = 0; i < 400; i++) noodrem.mag(nu + i * 10);
		const voor = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length;

		await sync.opsturen(true);

		expect((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(voor);
		expect(sync.message).toContain('stilgezet');
	});
});

/*
 * Wat een tokenvernieuwing niet mag kwijtmaken.
 *
 * Elk uur wordt het toegangsbewijs vernieuwd, en daarbij wordt de sessie opnieuw
 * opgebouwd. Twee velden vielen daar stilletjes uit. Geen van beide levert een
 * foutmelding op; het gaat om gedrag dat een uur later ineens anders is.
 */
describe('een uur later, na het vernieuwen van het toegangsbewijs', () => {
	beforeEach(() => noodrem.los());

	function metVernieuwing() {
		globalThis.fetch = vi.fn(async (url: string) => {
			if (String(url).includes('/auth/v1/token')) {
				return new Response(JSON.stringify({ access_token: 'nieuw', refresh_token: 'r2', expires_in: 3600 }), {
					status: 200
				});
			}
			return new Response('[]', { status: 200 });
		}) as unknown as typeof fetch;
	}

	/*
	 * 0 betekent 'we hebben gekeken en er stond niets'. Onbekend betekent 'we
	 * hebben dit team nog nooit gezien'. Dat verschil is precies de regel die
	 * andermans seizoen beschermt; hem wegpoetsen bij het vernieuwen zette die
	 * regel elk uur weer buiten werking.
	 */
	it('houdt vast dat het team nog nooit is opgehaald', async () => {
		metVernieuwing();
		sync.sessie = {
			access_token: 'oud',
			refresh_token: 'r',
			verloopt: Date.now() - 1000,
			teamId: 'team-1',
			versie: undefined,
			afdruk: null,
			laatst: null
		} as typeof sync.sessie;

		await sync.haalPloeg();

		expect(sync.sessie?.access_token).toBe('nieuw');
		expect(sync.sessie?.versie).toBeUndefined();
	});

	/*
	 * En de vingerafdruk. Zonder die vindt merkVies() altijd een verschil, dus
	 * denkt de app bij elke opslag dat er iets te versturen is — ook als er niets
	 * veranderd is.
	 */
	it('houdt de vingerafdruk vast, zodat niet alles ineens nieuw lijkt', async () => {
		metVernieuwing();
		const afdrukVooraf = 'ietsherkenbaars';
		sync.sessie = {
			access_token: 'oud',
			refresh_token: 'r',
			verloopt: Date.now() - 1000,
			teamId: 'team-1',
			versie: 4,
			afdruk: afdrukVooraf,
			laatst: null
		} as typeof sync.sessie;

		await sync.haalPloeg();

		expect(sync.sessie?.afdruk).toBe(afdrukVooraf);
	});

	it('houdt ook het team en de versie vast', async () => {
		metVernieuwing();
		sync.sessie = {
			access_token: 'oud',
			refresh_token: 'r',
			verloopt: Date.now() - 1000,
			teamId: 'team-7',
			versie: 12,
			afdruk: null,
			laatst: null
		} as typeof sync.sessie;

		await sync.haalPloeg();

		expect(sync.sessie?.teamId).toBe('team-7');
		expect(sync.sessie?.versie).toBe(12);
	});

	/*
	 * En uitloggen doet hij alleen als de server het bewijs echt afwijst. Er stond
	 * een catch die bij élke fout uitlogde: geen bereik op het moment dat je token
	 * toevallig verloopt, en je stond langs de lijn uitgelogd — opnieuw inloggen
	 * kan dan niet, want er is geen bereik.
	 */
	it('blijft ingelogd als er alleen geen bereik is', async () => {
		globalThis.fetch = vi.fn(async () => {
			throw new Error('geen bereik');
		}) as unknown as typeof fetch;
		sync.sessie = {
			access_token: 'oud',
			refresh_token: 'r',
			verloopt: Date.now() - 1000,
			teamId: 'team-1',
			versie: 4,
			afdruk: null,
			laatst: null
		} as typeof sync.sessie;

		await sync.haalPloeg();

		expect(sync.sessie).not.toBeNull();
		expect(sync.hapert).toBe(true);
	});

	it('logt wel uit als de server het bewijs afwijst', async () => {
		globalThis.fetch = vi.fn(
			async () => new Response(JSON.stringify({ message: 'invalid refresh token' }), { status: 401 })
		) as unknown as typeof fetch;
		sync.sessie = {
			access_token: 'oud',
			refresh_token: 'r',
			verloopt: Date.now() - 1000,
			teamId: 'team-1',
			versie: 4,
			afdruk: null,
			laatst: null
		} as typeof sync.sessie;

		await sync.haalPloeg();
		expect(sync.sessie).toBeNull();
	});

	/* En de noodrem mag je zeker niet uitloggen: die slaat juist aan als er iets
	   mis is, en dan wil je je sessie houden. */
	it('blijft ingelogd als de noodrem aanslaat', async () => {
		globalThis.fetch = vi.fn(async () => new Response('{}', { status: 200 })) as unknown as typeof fetch;
		sync.sessie = {
			access_token: 'oud',
			refresh_token: 'r',
			verloopt: Date.now() - 1000,
			teamId: 'team-1',
			versie: 4,
			afdruk: null,
			laatst: null
		} as typeof sync.sessie;
		const nu = Date.now();
		for (let i = 0; i < 400; i++) noodrem.mag(nu + i * 10);

		await sync.haalPloeg();
		expect(sync.sessie).not.toBeNull();
	});
});

/*
 * Er logt iemand anders in dan de vorige keer.
 *
 * Op een geleende telefoon, of als je zelf twee adressen hebt. Wat er dan niet
 * mag gebeuren: de spelers op dit toestel stilletjes meenemen naar het nieuwe
 * account. Heeft dat account nog geen team, dan maakt de app er een aan — met de
 * naam van het oude team — en duwt de namen van andermans kinderen erin.
 */
describe('als er iemand anders inlogt', () => {
	function metInlog(email: string) {
		globalThis.fetch = vi.fn(async (url: string, init?: RequestInit) => {
			const u = String(url);
			if (u.includes('/rest/v1/teams') && init?.method === 'POST')
				return new Response(JSON.stringify([{ id: 'vers-team' }]), { status: 200 });
			if (u.includes('/auth/v1/verify'))
				return new Response(
					JSON.stringify({
						access_token: 'nieuw',
						refresh_token: 'r2',
						expires_in: 3600,
						user: { id: 'u9', email }
					}),
					{ status: 200 }
				);
			if (u.includes('teams?select=id')) return new Response('[]', { status: 200 });
			if (u.includes('uitnodigingen')) return new Response('[]', { status: 200 });
			return new Response(JSON.stringify({ versie: 1 }), { status: 200 });
		}) as unknown as typeof fetch;
	}

	/** verzoeken die iets in de tabellen zetten */
	const schrijvend = () =>
		(globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.filter(
			(c) => (c[1] as RequestInit)?.method && (c[1] as RequestInit).method !== 'GET' && !String(c[0]).includes('/auth/')
		);

	beforeEach(() => {
		noodrem.los();
		localStorage.clear();
		sync.load();
		sync.sessie = null;
		sync.andereGebruiker = null;
		sync.message = '';
		app.toestand = emptyState();
		app.toestand.teamName = 'JO13-1';
		app.toestand.players = [{ id: 'p1', name: 'Bram', line: 'M' }];
	});

	it('vraagt van wie de gegevens zijn', async () => {
		localStorage.setItem('o14-laatste-inlog-v1', 'tjaco@voorbeeld.nl');
		metInlog('matthijs@voorbeeld.nl');
		sync.email = 'matthijs@voorbeeld.nl';

		await sync.controleerCode('12345678');

		expect(sync.andereGebruiker).toBe('tjaco@voorbeeld.nl');
	});

	/* Dit is waarom het ertoe doet: zolang die vraag openstaat gaat er niets weg. */
	it('stuurt niets op zolang die vraag openstaat', async () => {
		localStorage.setItem('o14-laatste-inlog-v1', 'tjaco@voorbeeld.nl');
		metInlog('matthijs@voorbeeld.nl');
		sync.email = 'matthijs@voorbeeld.nl';
		await sync.controleerCode('12345678');

		await sync.opsturen();
		expect(schrijvend()).toHaveLength(0);
		expect(sync.message).toContain('tjaco@voorbeeld.nl');
	});

	it('vraagt niets als dezelfde persoon opnieuw inlogt', async () => {
		localStorage.setItem('o14-laatste-inlog-v1', 'tjaco@voorbeeld.nl');
		metInlog('tjaco@voorbeeld.nl');
		sync.email = 'tjaco@voorbeeld.nl';
		await sync.controleerCode('12345678');
		expect(sync.andereGebruiker).toBeNull();
	});

	it('vraagt niets als er hier niets staat om te verhuizen', async () => {
		app.toestand = emptyState();
		localStorage.setItem('o14-laatste-inlog-v1', 'tjaco@voorbeeld.nl');
		metInlog('matthijs@voorbeeld.nl');
		sync.email = 'matthijs@voorbeeld.nl';
		await sync.controleerCode('12345678');
		expect(sync.andereGebruiker).toBeNull();
	});

	it('vraagt niets bij de allereerste inlog op een toestel', async () => {
		metInlog('tjaco@voorbeeld.nl');
		sync.email = 'tjaco@voorbeeld.nl';
		await sync.controleerCode('12345678');
		expect(sync.andereGebruiker).toBeNull();
	});

	it('neemt de gegevens mee als de trainer dat zegt', async () => {
		localStorage.setItem('o14-laatste-inlog-v1', 'tjaco@voorbeeld.nl');
		metInlog('matthijs@voorbeeld.nl');
		sync.email = 'matthijs@voorbeeld.nl';
		await sync.controleerCode('12345678');

		sync.neemMee();
		expect(sync.andereGebruiker).toBeNull();
		expect(app.toestand.players).toHaveLength(1);
		expect(localStorage.getItem('o14-laatste-inlog-v1')).toBe('matthijs@voorbeeld.nl');
	});

	it('begint schoon als de trainer dat zegt', async () => {
		localStorage.setItem('o14-laatste-inlog-v1', 'tjaco@voorbeeld.nl');
		metInlog('matthijs@voorbeeld.nl');
		sync.email = 'matthijs@voorbeeld.nl';
		await sync.controleerCode('12345678');

		sync.beginSchoon();
		expect(sync.andereGebruiker).toBeNull();
		expect(app.toestand.players).toHaveLength(0);
		expect(app.toestand.teamName).not.toBe('JO13-1');
	});

	/*
	 * De test die laat zien waaróm die vraag er is.
	 *
	 * Zonder hem maakt de app voor het nieuwe account een team aan — met de naam
	 * van het oude — en stuurt de spelers van de vorige trainer daarheen. Niemand
	 * ziet dat gebeuren.
	 */
	it('stuurt de spelers van de vorige niet naar het nieuwe team', async () => {
		localStorage.setItem('o14-laatste-inlog-v1', 'tjaco@voorbeeld.nl');
		metInlog('matthijs@voorbeeld.nl');
		sync.email = 'matthijs@voorbeeld.nl';
		await sync.controleerCode('12345678');

		await sync.opsturen();

		const oproepen = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls;
		/* geen team aangemaakt op naam van het oude team */
		expect(
			oproepen.some((c) => String(c[0]).includes('/rest/v1/teams') && (c[1] as RequestInit)?.method === 'POST')
		).toBe(false);
		/* en niets opgestuurd */
		expect(schrijvend()).toHaveLength(0);
	});

	/* En daarna gaat het gewoon weer. */
	it('gaat weer synchroniseren zodra de vraag beantwoord is', async () => {
		localStorage.setItem('o14-laatste-inlog-v1', 'tjaco@voorbeeld.nl');
		metInlog('matthijs@voorbeeld.nl');
		sync.email = 'matthijs@voorbeeld.nl';
		await sync.controleerCode('12345678');
		sync.neemMee();

		await sync.opsturen();
		expect(schrijvend().some((c) => String(c[0]).includes('/rest/v1/spelers'))).toBe(true);
	});
});
