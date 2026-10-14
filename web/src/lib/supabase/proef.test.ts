import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { noodrem, sync } from './sync.svelte';
import { app } from '$lib/store.svelte';
import { emptyState } from '$lib/domain/types';
import { SUPABASE_URL } from './config';
import { JA_NEE, JSON_KOLOMMEN, NU, rijen, toestand, verschil } from './rijen';
import gedeeld from '../../../../ios/BlaadjeKern/Tests/BlaadjeKernTests/Fixtures/rijen-gedeeld.json';

/*
 * De webapp tegen de echte tabellen: Postgres met het model en PostgREST, uit
 * proef/powersync. Draait alleen via `./proef.sh`; zonder opstelling slaat hij
 * zichzelf over.
 *
 * De nepserver in de gewone tests kent de regels die wij hem leerden. Deze proef
 * is er voor wat we niet zelf bedachten: de rechten in de database, hoe
 * PostgREST een groep rijen erbij zet, en hoe de server ja/nee en JSON
 * teruggeeft.
 *
 * De telefoon speelt mee via de rijen die de iPhone-app zelf maakte
 * (rijen-gedeeld.json): die zetten we erin zoals de telefoon dat doet.
 */
const REST = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.PROEF_REST;
const ANNA = '44444444-4444-4444-4444-444444444444';
const BAS = '55555555-5555-5555-5555-555555555555';
const echt = globalThis.fetch;

/** Een toegangsbewijs zoals Supabase het geeft, getekend met het geheim van de proef. */
async function bewijs(gebruiker: string): Promise<string> {
	const b64 = (b: Uint8Array) =>
		btoa(String.fromCharCode(...b))
			.replace(/\+/g, '-')
			.replace(/\//g, '_')
			.replace(/=+$/, '');
	const json = (x: object) => b64(new TextEncoder().encode(JSON.stringify(x)));
	const nu = Math.floor(Date.now() / 1000);
	const kop = json({ alg: 'HS256', typ: 'JWT', kid: 'proef' });
	const lijf = json({ sub: gebruiker, role: 'authenticated', aud: 'authenticated', iat: nu, exp: nu + 3600 });
	const geheim = new TextEncoder().encode('blaadje-proef-geheim-van-minstens-32-tekens');
	const sleutel = await crypto.subtle.importKey('raw', geheim, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
	const handtekening = await crypto.subtle.sign('HMAC', sleutel, new TextEncoder().encode(kop + '.' + lijf));
	return kop + '.' + lijf + '.' + b64(new Uint8Array(handtekening));
}

/** Rechtstreeks naar de database, zoals een ander toestel. */
async function rest(gebruiker: string, methode: string, pad: string, body?: unknown, prefer = 'return=minimal') {
	const r = await echt(REST + '/' + pad, {
		method: methode,
		headers: {
			Authorization: 'Bearer ' + (await bewijs(gebruiker)),
			'Content-Type': 'application/json',
			Prefer: prefer
		},
		body: body === undefined ? undefined : JSON.stringify(body)
	});
	const tekst = await r.text();
	if (!r.ok) throw new Error(methode + ' ' + pad + ': ' + r.status + ' ' + tekst);
	return tekst ? JSON.parse(tekst) : null;
}

const TABELLEN = [
	'teams',
	'team_instellingen',
	'spelers',
	'wedstrijden',
	'trainingen',
	'wedstrijd_spelers',
	'gebeurtenissen',
	'training_spelers',
	'taken'
];

/** Wat er voor een team in de database staat, als toestand. */
async function opDeServer(team: string) {
	const tabellen: Record<string, Record<string, unknown>[]> = {};
	for (const t of TABELLEN) {
		const filter = t === 'teams' || t === 'team_instellingen' ? 'id' : 'team_id';
		tabellen[t] = await rest(ANNA, 'GET', `${t}?select=*&${filter}=eq.${team}&limit=5000`);
	}
	return toestand(tabellen, team);
}

/** Leidt het verkeer van de app naar de opstelling; inloggen doen we zelf. */
async function naarDeOpstelling(gebruiker: string, email: string) {
	globalThis.fetch = (async (url: string, init?: RequestInit) => {
		const u = String(url);
		if (u.startsWith(SUPABASE_URL + '/auth/v1/user')) {
			return new Response(JSON.stringify({ id: gebruiker, email }), { status: 200 });
		}
		if (!u.startsWith(SUPABASE_URL + '/rest/v1/')) throw new Error('niet in de proef: ' + u);
		return echt(REST + '/' + u.slice((SUPABASE_URL + '/rest/v1/').length), init);
	}) as typeof fetch;
	sync.sessie = {
		access_token: await bewijs(gebruiker),
		refresh_token: 'r',
		verloopt: Date.now() + 3600_000,
		user_id: gebruiker,
		email,
		teamId: null,
		laatst: null
	};
}

/** Een ander toestel: niets op het toestel, niets onthouden. */
function nieuwToestel() {
	localStorage.clear();
	sync.load();
	app.toestand = emptyState();
	app.afterSave = () => sync.merkVies();
	sync.vies = false;
	sync.hapert = false;
	sync.message = '';
	sync.mijnTeams = [];
	noodrem.los();
}

describe.skipIf(!REST)('de webapp tegen de echte tabellen', () => {
	const geval = (
		gedeeld as unknown as {
			naam: string;
			team: string;
			rijen: { tabel: string; id: string; kolommen: Record<string, unknown> }[];
		}[]
	).find((g) => g.naam === 'september')!;
	const team = geval.team;

	beforeAll(async () => {
		/* De telefoon van Anna: haar team, en daarin wat de iPhone-app maakte. */
		await rest(ANNA, 'POST', 'teams', { id: team, naam: 'JO13-1' });
		const nu = Date.now();
		for (const tabel of TABELLEN.slice(1)) {
			const lijst = geval.rijen
				.filter((r) => r.tabel === tabel)
				.map((r, i) => {
					const o: Record<string, unknown> = { id: r.id };
					for (const [k, v] of Object.entries(r.kolommen)) {
						o[k] = JA_NEE.has(k)
							? v === 1
							: JSON_KOLOMMEN.has(k) && typeof v === 'string'
								? JSON.parse(v)
								: v === NU
									? new Date(nu).toISOString()
									: v;
					}
					if (['spelers', 'wedstrijden', 'trainingen', 'gebeurtenissen'].includes(tabel))
						o.gemaakt = new Date(nu + i).toISOString();
					return o;
				});
			if (lijst.length) await rest(ANNA, 'POST', tabel, lijst);
		}
	});

	beforeEach(async () => {
		nieuwToestel();
		await naarDeOpstelling(ANNA, 'anna@voorbeeld.nl');
	});

	it('haalt op wat de telefoon erin zette', async () => {
		await sync.kijkEven();
		const server = (await opDeServer(team))!;
		expect(sync.sessie!.teamId).toBe(team);
		expect(app.toestand.players.map((p) => p.name)).toEqual(server.players.map((p) => p.name));
		expect(app.toestand.players.length).toBeGreaterThan(5);
		expect(app.toestand.trainings).toHaveLength(server.trainings.length);
		expect(verschil(rijen(server, team), rijen(app.toestand, team))).toEqual([]);
		expect(sync.vies).toBe(false);
	});

	it('stuurt wijzigingen op die de server zo bewaart', async () => {
		await sync.kijkEven();
		app.renamePlayer(app.toestand.players[0], 'Bram de Tweede');
		app.addPlayerNames('Nieuweling');
		const tr = app.newTraining();
		app.cycleAttendance(tr, app.toestand.players[1].id);
		app.newMatch('Feyenoord', false);
		app.setNote('Zaterdag om tien uur verzamelen.');
		await sync.duwAlsNodig();

		expect(sync.message).toBe('');
		expect(sync.vies).toBe(false);
		expect(sync.geweigerd).toBe(0);
		const server = (await opDeServer(team))!;
		expect(server.players[0].name).toBe('Bram de Tweede');
		expect(server.players.at(-1)!.name).toBe('Nieuweling');
		expect(server.match?.opponent).toBe('Feyenoord');
		expect(server.match?.note).toBe('Zaterdag om tien uur verzamelen.');
		expect(verschil(rijen(server, team), rijen(app.toestand, team))).toEqual([]);
	});

	it('ziet op een tweede toestel precies hetzelfde', async () => {
		await sync.kijkEven();
		const eerste = rijen(app.toestand, team);
		nieuwToestel();
		await naarDeOpstelling(ANNA, 'anna@voorbeeld.nl');
		await sync.kijkEven();
		expect(verschil(eerste, rijen(app.toestand, team))).toEqual([]);
	});

	it('laat staan wat de telefoon intussen deed', async () => {
		await sync.kijkEven();
		/* de telefoon zet iemand op afgemeld bij de laatste training */
		const training = app.toestand.trainings[0].id;
		const speler = app.toestand.players[2].id;
		await rest(ANNA, 'PATCH', `training_spelers?training_id=eq.${training}&speler_id=eq.${speler}`, {
			status: 'afgemeld'
		});
		/* en het web hernoemt een ander */
		app.renamePlayer(app.toestand.players[3], 'Hernoemd op het web');
		await sync.duwAlsNodig();
		await sync.kijkEven();

		expect(app.toestand.trainings[0].status[speler]).toBe('excused');
		expect(app.toestand.players[3].name).toBe('Hernoemd op het web');
	});

	it('zet een heel seizoen erin en haalt het terug, ook boven de duizend rijen', async () => {
		await sync.kijkEven();
		const spelers = app.toestand.players;
		for (let i = 0; i < 70; i++) {
			const tr = app.newTraining();
			app.setTrainingDate(tr, '2027-0' + (1 + Math.floor(i / 28)) + '-' + String(1 + (i % 28)).padStart(2, '0'));
			app.cycleAttendance(tr, spelers[i % spelers.length].id);
		}
		await sync.duwAlsNodig();
		expect(sync.geweigerd).toBe(0);

		const voor = rijen(app.toestand, team);
		expect(voor.filter((r) => r.tabel === 'training_spelers').length).toBeGreaterThan(1000);
		nieuwToestel();
		await naarDeOpstelling(ANNA, 'anna@voorbeeld.nl');
		await sync.kijkEven();
		expect(verschil(voor, rijen(app.toestand, team))).toEqual([]);
	});

	it('haalt een training weg, met wie er was', async () => {
		await sync.kijkEven();
		const weg = app.toestand.trainings[0];
		app.removeTraining(weg);
		await sync.duwAlsNodig();
		const over = await rest(ANNA, 'GET', `training_spelers?select=id&training_id=eq.${weg.id}`);
		expect(over).toHaveLength(0);
		expect((await opDeServer(team))!.trainings.some((t) => t.id === weg.id)).toBe(false);
	});

	it('laat iemand die niet bij het team hoort er niet bij', async () => {
		expect(await rest(BAS, 'GET', `spelers?select=id&team_id=eq.${team}`)).toEqual([]);
		await expect(
			rest(BAS, 'POST', 'spelers', { id: crypto.randomUUID(), team_id: team, naam: 'Indringer' })
		).rejects.toThrow(/403|401|42501/);
	});

	it('zet het programma en de taken erin, en een ouder kan ermee werken', async () => {
		await sync.kijkEven();
		const [sem, noah] = app.toestand.players;
		const id = app.addToProgram('2027-05-01', '10:30', 'Ajax', true);
		app.setTask(id, 'limonade', sem.id);
		app.setTask(id, 'vlaggen', noah.id);
		app.addTask(id, 'rijden', null);
		await sync.duwAlsNodig();
		expect(sync.geweigerd).toBe(0);

		const server = (await opDeServer(team))!;
		expect(server.program?.find((p) => p.id === id)).toMatchObject({ opponent: 'Ajax', time: '10:30', home: true });
		expect(server.tasks?.filter((x) => x.matchId === id)).toHaveLength(3);
		expect(verschil(rijen(server, team), rijen(app.toestand, team))).toEqual([]);

		/* Een ouder: de teamlink, Sem kiezen, en de limonade teruggeven. */
		const [link] = await rest(ANNA, 'POST', 'deellinks', { team_id: team }, 'return=representation');
		const ouder = (pad: string, body: unknown) =>
			echt(REST + '/rpc/' + pad, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body)
			}).then((r) => r.json());
		const token = 'telefoon-van-de-ouder-van-sem-0123456789';
		expect(await ouder('volg', { p_code: link.code, p_token: token, p_speler: sem.id })).toBe(true);
		const pagina = await ouder('volgpagina', { p_code: link.code, p_token: token });
		expect(pagina.mijn_kind.naam).toBe(sem.name);
		const wedstrijd = pagina.wedstrijden.find((w: { id: string }) => w.id === id);
		const limonade = wedstrijd.taken.find((x: { soort: string }) => x.soort === 'limonade');
		expect(limonade.van_mij).toBe(true);
		expect(await ouder('taak_kan_niet', { p_code: link.code, p_token: token, p_taak: limonade.id })).toBe(true);

		/* De trainer ziet het: de taak staat open, met wie niet kon. */
		await sync.kijkEven();
		const taak = app.toestand.tasks!.find((x) => x.id === limonade.id)!;
		expect(taak.player).toBeUndefined();
		expect(taak.declinedBy).toBe(sem.id);

		/* Op de dag zelf wordt het de wedstrijd, met dezelfde taken. */
		app.toestand.program = app.toestand.program!.map((p) => (p.id === id ? { ...p, date: '2026-10-14' } : p));
		app.save();
		await sync.duwAlsNodig();
		/* Een eerdere proef liet een wedstrijd openstaan; er kan er maar één tegelijk. */
		expect(app.toestand.match).not.toBeNull();
		expect(app.startFromProgram(id)).toBe(false);
		app.discardMatch();
		expect(app.startFromProgram(id)).toBe(true);
		await sync.duwAlsNodig();
		expect(sync.geweigerd).toBe(0);
		const daarna = (await opDeServer(team))!;
		expect(daarna.match?.id).toBe(id);
		expect(daarna.match?.time).toBe('10:30');
		expect(daarna.program?.some((p) => p.id === id) ?? false).toBe(false);
		expect(daarna.tasks?.filter((x) => x.matchId === id)).toHaveLength(3);
		app.discardMatch();
		await sync.duwAlsNodig();
		expect((await opDeServer(team))!.program?.some((p) => p.id === id)).toBe(true);
	});

	it('verhuist het oude blok van een team naar de tabellen', async () => {
		const ander = crypto.randomUUID();
		await rest(ANNA, 'POST', 'teams', { id: ander, naam: 'JO11-2' });
		await rest(ANNA, 'POST', 'rpc/toestand_opslaan', {
			p_team_id: ander,
			p_data: {
				teamName: 'JO11-2',
				players: [{ id: 'p1', name: 'Uit het oude blok', line: 'M' }],
				archive: [],
				trainings: []
			},
			p_verwachte_versie: null
		});
		sync.mijnTeams = [
			{ id: team, naam: 'JO13-1' },
			{ id: ander, naam: 'JO11-2' }
		];
		await sync.kiesTeam(ander);
		await sync.duwAlsNodig();

		expect(app.toestand.players.map((p) => p.name)).toEqual(['Uit het oude blok']);
		expect((await opDeServer(ander))!.players.map((p) => p.name)).toEqual(['Uit het oude blok']);
	});
});
