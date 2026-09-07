import { beforeEach, describe, expect, it, vi } from 'vitest';
import { noodrem, sync } from './sync.svelte';
import { app } from '$lib/store.svelte';
import { emptyState } from '$lib/domain/types';

/** A fake server: enough to test the decisions, not the network. */
function nepFetch(
	opties: { versie?: number; data?: unknown; botsing?: boolean; stuk?: boolean; zonderCode?: boolean } = {}
) {
	const verstuurd: unknown[] = [];
	const f = vi.fn(async (url: string, init?: RequestInit) => {
		const body = init?.body ? JSON.parse(String(init.body)) : null;
		if (opties.stuk) throw new Error('geen bereik');
		if (url.includes('/rest/v1/teams')) {
			return new Response(JSON.stringify([{ id: 'team-1' }]), { status: 200 });
		}
		if (url.includes('rpc/toestand_opslaan')) {
			if (opties.botsing) {
				/* Zonder code: dan moet de tekst het doen. Dat is het pad dat stukging. */
				const lijf = opties.zonderCode
					? { message: 'versie loopt niet gelijk (hier 82, jij 78)' }
					: { code: '40001', message: 'versie loopt niet gelijk (hier 82, jij 78)' };
				return new Response(JSON.stringify(lijf), { status: 500 });
			}
			verstuurd.push(body.p_data);
			return new Response(JSON.stringify({ versie: (opties.versie ?? 0) + 1 }), { status: 200 });
		}
		if (url.includes('team_toestand')) {
			return new Response(JSON.stringify(opties.data ? [{ data: opties.data, versie: opties.versie ?? 1 }] : []), {
				status: 200
			});
		}
		return new Response('{}', { status: 200 });
	});
	globalThis.fetch = f as unknown as typeof fetch;
	return { f, verstuurd };
}

beforeEach(() => {
	localStorage.clear();
	app.toestand = emptyState();
	app.toestand.players = [{ id: 'p1', name: 'Daanish', line: 'M' }];
	sync.sessie = {
		access_token: 'token',
		refresh_token: 'r',
		verloopt: Date.now() + 3600_000,
		user_id: 'u1',
		email: 'trainer@voorbeeld.nl',
		teamId: 'team-1',
		versie: 1,
		laatst: null,
		afdruk: null
	};
	sync.vies = false;
	sync.botsing = false;
	sync.hapert = false;
});

describe('vanzelf bijwerken', () => {
	it('merkt een wijziging en stuurt hem op', async () => {
		const { verstuurd } = nepFetch({ versie: 1 });
		sync.merkVies();
		expect(sync.vies).toBe(true);
		await sync.duwAlsNodig();
		expect(sync.vies).toBe(false);
		expect((verstuurd[0] as { players: unknown[] }).players).toHaveLength(1);
	});

	/* This used to be the other way round: the match deliberately stayed on one
	   device. But then you cannot prepare anything at home, which is precisely when
	   you are sitting down quietly. */
	it('stuurt ook een wedstrijd op die je klaarzet', async () => {
		const { verstuurd } = nepFetch({ versie: 1 });
		sync.merkVies();
		await sync.duwAlsNodig();
		expect(sync.vies).toBe(false);

		app.newMatch('Sparta', true);
		sync.merkVies();
		expect(sync.vies).toBe(true);
		await sync.duwAlsNodig();
		expect((verstuurd.at(-1) as { match: { opponent: string } }).match.opponent).toBe('Sparta');
	});

	it('haalt niet stiekem op als er hier nog iets klaarstaat', async () => {
		nepFetch({ versie: 9, data: { players: [{ id: 'x', name: 'Vreemd', line: '' }] } });
		sync.vies = true;
		await sync.ophalen(true);
		expect(app.toestand.players[0].name).toBe('Daanish');
	});

	it('haalt wel op als er hier niets klaarstaat', async () => {
		nepFetch({
			versie: 9,
			data: { players: [{ id: 'x', name: 'Vanaf de laptop', line: '' }], trainings: [], archive: [] }
		});
		await sync.ophalen(true);
		expect(app.toestand.players[0].name).toBe('Vanaf de laptop');
		expect(sync.sessie!.versie).toBe(9);
	});

	it('overschrijft niets bij een botsing maar vraagt het aan de trainer', async () => {
		nepFetch({ botsing: true });
		sync.merkVies();
		await sync.duwAlsNodig();
		expect(sync.botsing).toBe(true);
		expect(sync.vies).toBe(true); /* blijft klaarstaan */
	});

	it('houdt wijzigingen vast als er geen bereik is', async () => {
		nepFetch({ stuk: true });
		sync.merkVies();
		await sync.duwAlsNodig();
		expect(sync.vies).toBe(true);
		expect(sync.hapert).toBe(true);
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

describe('bij het openen', () => {
	/* This went wrong when the match joined the payload: a lineup was ready on the
	   laptop, but nothing changed any more, so the app never noticed there was
	   suddenly more to send. The phone stayed empty. */
	it('merkt dat er hier iets staat wat de server nog niet heeft', async () => {
		const { verstuurd } = nepFetch({ versie: 1, data: { players: app.toestand.players } });
		sync.sessie!.afdruk = 'iets ouds';
		app.newMatch('Sparta', true);
		sync.vies = false;

		await sync.kijkEven();
		expect(sync.vies).toBe(true);
		await sync.duwAlsNodig();
		expect((verstuurd.at(-1) as { match: { opponent: string } }).match.opponent).toBe('Sparta');
	});

	it('laat het met rust als de server alles al heeft', async () => {
		nepFetch({ versie: 1, data: { players: app.toestand.players } });
		sync.merkVies();
		await sync.duwAlsNodig(); /* now it knows what is there */
		expect(sync.vies).toBe(false);

		await sync.kijkEven();
		expect(sync.vies).toBe(false);
	});
});

describe('niet blijven hameren', () => {
	/* Dit ging echt mis: de tekst van de database is Nederlands, en de hernoeming
	   naar het Engels maakte er 'versie running niet gelijk' van. Daardoor werd een
	   versieconflict niet als conflict herkend, ging de rem er nooit op en bleef de
	   app doorproberen — 357.000 fouten in een uur op de database. */
	it('herkent een versieconflict aan de tekst van de database', async () => {
		nepFetch({ botsing: true, zonderCode: true });
		sync.merkVies();
		await sync.duwAlsNodig();
		expect(sync.botsing).toBe(true);
	});

	it('probeert na een botsing niet uit zichzelf opnieuw', async () => {
		const { f } = nepFetch({ botsing: true });
		sync.merkVies();
		await sync.duwAlsNodig();
		const na = f.mock.calls.length;
		for (let i = 0; i < 20; i++) await sync.duwAlsNodig();
		expect(f.mock.calls.length).toBe(na);
	});

	it('wacht steeds langer als het opsturen blijft mislukken', async () => {
		nepFetch({ stuk: true });
		sync.merkVies();
		const wachten: number[] = [];
		const echt = globalThis.setTimeout;
		globalThis.setTimeout = ((fn: () => void, ms: number) => {
			wachten.push(ms);
			return 0 as unknown as ReturnType<typeof setTimeout>;
		}) as typeof setTimeout;
		for (let i = 0; i < 8; i++) await sync.duwAlsNodig();
		globalThis.setTimeout = echt;

		expect(wachten.length).toBeGreaterThan(3);
		/* oplopend, en nooit langer dan vijf minuten */
		expect(wachten[1]).toBeGreaterThan(wachten[0]);
		expect(Math.max(...wachten)).toBeLessThanOrEqual(300_000);
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
		sync.botsing = true;
		sync.uitloggen();
		expect(sync.sessie).toBeNull();
		expect(sync.vies).toBe(false);
		expect(sync.botsing).toBe(false);
		expect(localStorage.getItem('o14-sessie-v1')).toBeFalsy();
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

/*
 * Een team aanmaken.
 *
 * De eerste keer synchroniseren is er nog geen team op de server. Dat moet dan
 * ontstaan, en precies één keer: twee teams voor dezelfde trainer betekent dat de
 * ene telefoon de ene helft van het seizoen bijhoudt en de andere de andere.
 */
describe('het team op de server', () => {
	it('neemt een bestaand team over', async () => {
		const { f } = nepFetch();
		sync.sessie!.teamId = undefined;
		await sync.opsturen();
		expect(sync.sessie!.teamId).toBe('team-1');
		expect(f.mock.calls.some((c) => String(c[0]).includes('teams?select=id'))).toBe(true);
	});

	it('maakt er een aan als er nog geen is', async () => {
		const gemaakt: unknown[] = [];
		globalThis.fetch = vi.fn(async (url: string, init?: RequestInit) => {
			const u = String(url);
			if (u.includes('teams?select=id')) return new Response('[]', { status: 200 });
			if (u.includes('/rest/v1/teams')) {
				gemaakt.push(JSON.parse(String(init?.body)));
				return new Response(JSON.stringify([{ id: 'nieuw-team' }]), { status: 200 });
			}
			return new Response(JSON.stringify({ versie: 2 }), { status: 200 });
		}) as unknown as typeof fetch;

		app.toestand.teamName = 'JO14-3';
		sync.sessie!.teamId = undefined;
		await sync.opsturen();
		expect(sync.sessie!.teamId).toBe('nieuw-team');
		expect(gemaakt[0]).toMatchObject({ naam: 'JO14-3', eigenaar: 'u1' });
	});

	it('vraagt het bij de tweede keer niet opnieuw', async () => {
		const { f } = nepFetch();
		await sync.opsturen();
		await sync.opsturen();
		expect(f.mock.calls.filter((c) => String(c[0]).includes('teams?select=id'))).toHaveLength(0);
	});
});

/*
 * Meerdere trainers per team.
 *
 * De database bewaakt wie er waarbij mag; die proef staat in supabase/test. Wat
 * hier bewaakt wordt is het toestel: welk team het volgt. Dat is de gevaarlijkste
 * beslissing in dit bestand, want het verkeerde team pakken betekent dat jouw
 * seizoen over dat van iemand anders heen gaat, en dat is met geen enkele knop
 * terug te draaien.
 */
describe('welk team dit toestel volgt', () => {
	function metTeams(teams: { id: string; naam: string }[]) {
		const gemaakt: unknown[] = [];
		const f = vi.fn(async (url: string, init?: RequestInit) => {
			const u = String(url);
			if (u.includes('teams?select=id')) return new Response(JSON.stringify(teams), { status: 200 });
			if (u.includes('uitnodigingen')) return new Response('[]', { status: 200 });
			if (u.includes('/rest/v1/teams') && init?.method === 'POST') {
				gemaakt.push(JSON.parse(String(init.body)));
				return new Response(JSON.stringify([{ id: 'vers-team' }]), { status: 200 });
			}
			if (u.includes('team_toestand')) return new Response('[]', { status: 200 });
			return new Response(JSON.stringify({ versie: 2 }), { status: 200 });
		});
		globalThis.fetch = f as unknown as typeof fetch;
		return { f, gemaakt };
	}

	beforeEach(() => {
		sync.mijnTeams = [];
		sync.leden = [];
		sync.openstaand = [];
		sync.uitgenodigdVoor = [];
		sync.message = '';
	});

	it('neemt het team over als er maar één is', async () => {
		metTeams([{ id: 'team-1', naam: 'JO13-1' }]);
		sync.sessie!.teamId = undefined;
		await sync.opsturen();
		expect(sync.sessie!.teamId).toBe('team-1');
		/* de lijst blijft staan; hij is geen keuzemoment maar een overzicht */
		expect(sync.mijnTeams).toEqual([{ id: 'team-1', naam: 'JO13-1' }]);
	});

	/*
	 * Dit is de test die ertoe doet. Bij twee teams mag de app niet gokken. Vóór
	 * het lidmaatschap pakte hij simpelweg het oudste; dat werkte zolang je alleen
	 * je eigen team had, en zou vanaf nu andermans seizoen kunnen overschrijven.
	 */
	it('gokt niet als je bij meer dan één team hoort', async () => {
		const { f } = metTeams([
			{ id: 'team-1', naam: 'JO13-1' },
			{ id: 'team-2', naam: 'JO15-2' }
		]);
		sync.sessie!.teamId = undefined;
		await sync.opsturen();

		expect(sync.sessie!.teamId).toBeUndefined();
		expect(sync.mijnTeams.map((t) => t.naam)).toEqual(['JO13-1', 'JO15-2']);
		/* en er is niets opgestuurd */
		expect(f.mock.calls.some((c) => String(c[0]).includes('toestand_opslaan'))).toBe(false);
	});

	/*
	 * De bron van de verwarring op 7 september.
	 *
	 * De tweede trainer logde voor het eerst in, kreeg automatisch een eigen leeg
	 * team, en nam daarna pas de uitnodiging aan. Twee teams, waarvan één nergens
	 * voor dient — en precies díé tweede maakte de keuzeknoppen nodig. De app
	 * veroorzaakte zijn eigen complexiteit.
	 */
	it('maakt geen leeg team aan als er een uitnodiging klaarstaat', async () => {
		const gemaakt: unknown[] = [];
		globalThis.fetch = vi.fn(async (url: string, init?: RequestInit) => {
			const u = String(url);
			if (u.includes('teams?select=id')) return new Response('[]', { status: 200 });
			if (u.includes('uitnodigingen')) return new Response(JSON.stringify([{ team_id: 'team-9' }]), { status: 200 });
			if (u.includes('/rest/v1/teams') && init?.method === 'POST') {
				gemaakt.push(1);
				return new Response(JSON.stringify([{ id: 'ongewenst' }]), { status: 200 });
			}
			return new Response('{}', { status: 200 });
		}) as unknown as typeof fetch;

		sync.sessie!.teamId = undefined;
		await sync.opsturen();

		expect(gemaakt).toHaveLength(0);
		expect(sync.sessie!.teamId).toBeUndefined();
		expect(sync.message).toContain('uitnodiging');
		/* en het is geen storing, dus geen 'geen verbinding' en geen herhaling */
		expect(sync.hapert).toBe(false);
	});

	it('maakt er een aan als je nog nergens bij hoort', async () => {
		const { gemaakt } = metTeams([]);
		app.toestand.teamName = 'JO14-3';
		sync.sessie!.teamId = undefined;
		await sync.opsturen();
		expect(sync.sessie!.teamId).toBe('vers-team');
		expect(gemaakt[0]).toMatchObject({ naam: 'JO14-3' });
	});

	it('volgt het team dat je kiest en haalt dat op', async () => {
		metTeams([]);
		sync.vies = false;
		await sync.kiesTeam('team-2');
		expect(sync.sessie!.teamId).toBe('team-2');
		expect(sync.mijnTeams).toHaveLength(0);
	});

	/*
	 * Overstappen terwijl er nog iets klaarstaat zou dat werk bij het andere team
	 * naar binnen duwen. Dus eerst opsturen of ophalen, dan pas kiezen.
	 */
	it('stapt niet over zolang er hier nog iets klaarstaat', async () => {
		metTeams([]);
		sync.sessie!.teamId = 'team-1';
		sync.vies = true;
		await sync.kiesTeam('team-2');
		expect(sync.sessie!.teamId).toBe('team-1');
		expect(sync.message).toContain('Stuur eerst op');
	});

	/*
	 * Maar die rem mag geen doodlopende weg worden. Volgt dit toestel nog geen
	 * team, dan hoort wat er klaarstaat nergens bij, en 'stuur eerst op' zou
	 * verwijzen naar iets wat niet bestaat. Dat is de toestand van iemand die net
	 * is uitgenodigd.
	 */
	it('laat een toestel dat nog nergens bij hoort wel kiezen', async () => {
		metTeams([]);
		sync.sessie!.teamId = undefined;
		sync.vies = true;
		await sync.kiesTeam('team-9');
		expect(sync.sessie!.teamId).toBe('team-9');
		expect(sync.message).not.toContain('Stuur eerst op');
	});

	/* De versie van het ene team zegt niets over het andere; hem meenemen zou
	   betekenen dat we denken te weten waar we op bouwen terwijl dat niet zo is. */
	it('neemt de versie van het vorige team niet mee', async () => {
		metTeams([]);
		sync.sessie!.versie = 42;
		await sync.kiesTeam('team-2');
		expect(sync.sessie!.versie).not.toBe(42);
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
describe('als het nieuwe schema er nog niet is', () => {
	function zonderNieuweTabellen() {
		globalThis.fetch = vi.fn(async (url: string) => {
			const u = String(url);
			if (u.includes('team_leden') || u.includes('uitnodigingen')) {
				return new Response(JSON.stringify({ code: '42P01', message: 'relation "public.team_leden" does not exist' }), {
					status: 404
				});
			}
			if (u.includes('teams?select=id'))
				return new Response(JSON.stringify([{ id: 'team-1', naam: 'JO13-1' }]), { status: 200 });
			if (u.includes('rpc/toestand_opslaan')) return new Response(JSON.stringify({ versie: 2 }), { status: 200 });
			return new Response('[]', { status: 200 });
		}) as unknown as typeof fetch;
	}

	beforeEach(() => {
		sync.leden = [];
		sync.openstaand = [];
		sync.uitgenodigdVoor = [];
		sync.message = '';
	});

	it('houdt de wedstrijd gewoon bij', async () => {
		zonderNieuweTabellen();
		await sync.opsturen();
		expect(sync.vies).toBe(false);
		expect(sync.message).toBe('Opgestuurd.');
	});

	/* En zonder melding: er is niets wat de trainer eraan kan doen, dus een
	   foutmelding zou alleen maar onrust zaaien over iets wat niet van hem is. */
	it('laat de ploeg leeg, zonder erover te klagen', async () => {
		zonderNieuweTabellen();
		await sync.haalPloeg();
		expect(sync.leden).toHaveLength(0);
		expect(sync.openstaand).toHaveLength(0);
		expect(sync.message).toBe('');
	});

	it('kijkt naar uitnodigingen zonder te klagen', async () => {
		zonderNieuweTabellen();
		await sync.kijkNaarUitnodigingen();
		expect(sync.uitgenodigdVoor).toHaveLength(0);
		expect(sync.message).toBe('');
	});
});

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
 * De vier regels waar het niet mis mag gaan.
 *
 * 1. Een toestel volgt precies één team. Alles wat het opstuurt gaat daarheen.
 * 2. De app raadt nooit welk team dat is.
 * 3. Het eerste contact met een team is altijd ophalen, nooit opsturen.
 * 4. Overstappen kan alleen als er niets klaarstaat, en lukt helemaal of niet.
 *
 * Regel 3 is de belangrijkste. Zonder die regel duwt een net toegevoegde trainer
 * zijn nog lege app naar het team van een ander. De versiecontrole houdt dat
 * tegen, maar dan krijgt hij een botsing te zien — en één van de twee knoppen
 * daar stuurt met opzet dit toestel eroverheen. Een geladen wapen in handen van
 * iemand die net binnenkomt.
 */
describe('elkaars teams niet overschrijven', () => {
	function server(opties: { teams?: { id: string; naam: string }[]; documenten?: Record<string, unknown> } = {}) {
		const verstuurd: { url: string; method?: string; body?: Record<string, unknown> }[] = [];
		const documenten = opties.documenten ?? {};
		globalThis.fetch = vi.fn(async (url: string, init?: RequestInit) => {
			const u = String(url);
			const body = init?.body ? JSON.parse(String(init.body)) : null;
			verstuurd.push({ url: u, method: init?.method, body });
			if (u.includes('teams?select=id')) {
				return new Response(JSON.stringify(opties.teams ?? [{ id: 'team-1', naam: 'JO13-1' }]), { status: 200 });
			}
			if (u.includes('uitnodigingen')) return new Response('[]', { status: 200 });
			if (u.includes('/rest/v1/teams') && init?.method === 'POST') {
				return new Response(JSON.stringify([{ id: 'vers-team' }]), { status: 200 });
			}
			if (u.includes('team_toestand')) {
				const id = u.split('team_id=eq.')[1]?.split('&')[0] ?? '';
				const d = documenten[id];
				return new Response(JSON.stringify(d ? [d] : []), { status: 200 });
			}
			if (u.includes('rpc/toestand_opslaan')) return new Response(JSON.stringify({ versie: 9 }), { status: 200 });
			return new Response('{}', { status: 200 });
		}) as unknown as typeof fetch;
		return verstuurd;
	}

	const documentVan = (naam: string, versie = 4) => ({
		versie,
		data: { teamName: naam, players: [{ id: 'x', name: 'Speler van ' + naam, line: 'M' }], archive: [], trainings: [] }
	});

	beforeEach(() => {
		sync.mijnTeams = [];
		sync.message = '';
		sync.botsing = false;
		sync.hapert = false;
	});

	/* ---------- regel 3 ---------- */
	it('stuurt niets op naar een team dat dit toestel nog nooit heeft opgehaald', async () => {
		const verstuurd = server({ documenten: { 'team-1': documentVan('JO13-1') } });
		sync.sessie!.teamId = undefined;
		sync.sessie!.versie = undefined;
		app.toestand.teamName = 'Ons team';

		await sync.opsturen();

		expect(verstuurd.some((v) => v.url.includes('toestand_opslaan'))).toBe(false);
		expect(sync.message).toContain('nog niet opgehaald');
		expect(sync.botsing).toBe(false);
	});

	it('stuurt wel op naar een team dat het net zelf heeft aangemaakt', async () => {
		const verstuurd = server({ teams: [] });
		sync.sessie!.teamId = undefined;
		sync.sessie!.versie = undefined;

		await sync.opsturen();

		/* vers aangemaakt: de server heeft niets, dus opsturen is hier veilig */
		expect(verstuurd.some((v) => v.url.includes('toestand_opslaan'))).toBe(true);
	});

	it('stuurt gewoon op zodra het team een keer opgehaald is', async () => {
		const verstuurd = server({ documenten: { 'team-1': documentVan('JO13-1') } });
		sync.sessie!.teamId = 'team-1';
		sync.sessie!.versie = 4;

		await sync.opsturen();
		expect(verstuurd.some((v) => v.url.includes('toestand_opslaan'))).toBe(true);
	});

	/* ---------- regel 4 ---------- */
	it('neemt bij het overstappen de gegevens van het andere team over', async () => {
		server({
			teams: [
				{ id: 'team-1', naam: 'JO13-1' },
				{ id: 'team-9', naam: 'JO15-2' }
			],
			documenten: { 'team-9': documentVan('JO15-2', 7) }
		});
		sync.mijnTeams = [
			{ id: 'team-1', naam: 'JO13-1' },
			{ id: 'team-9', naam: 'JO15-2' }
		];
		sync.sessie!.teamId = 'team-1';
		sync.sessie!.versie = 3;
		sync.vies = false;

		await sync.kiesTeam('team-9');

		expect(sync.sessie!.teamId).toBe('team-9');
		expect(sync.sessie!.versie).toBe(7);
		expect(app.toestand.teamName).toBe('JO15-2');
		expect(app.toestand.players[0].name).toBe('Speler van JO15-2');
	});

	/*
	 * Dit is het doorkruisen waar het om gaat. Stap je over naar een team waar nog
	 * niets staat, dan mag wat hier staat niet meegaan: dat is van het team dat je
	 * verlaat, en het zou zich bij het nieuwe naar binnen schrijven.
	 */
	it('draagt geen gegevens van het ene team het andere in', async () => {
		server({
			teams: [
				{ id: 'team-1', naam: 'JO13-1' },
				{ id: 'team-9', naam: 'JO15-2' }
			],
			documenten: {}
		});
		app.toestand.teamName = 'JO13-1';
		app.toestand.players = [{ id: 'p1', name: 'Bram', line: 'M' }];
		sync.sessie!.teamId = 'team-1';
		sync.sessie!.versie = 3;
		sync.vies = false;

		await sync.kiesTeam('team-9');

		expect(app.toestand.players).toHaveLength(0);
		expect(app.toestand.teamName).not.toBe('JO13-1');
	});

	/* Maar wie nergens vandaan komt houdt wat hij heeft: dat ís het begin. */
	it('laat wat er staat met rust als dit het eerste team is', async () => {
		server({ teams: [{ id: 'team-9', naam: 'JO15-2' }], documenten: {} });
		app.toestand.players = [{ id: 'p1', name: 'Bram', line: 'M' }];
		sync.sessie!.teamId = undefined;
		sync.sessie!.versie = undefined;

		await sync.kiesTeam('team-9');

		expect(sync.sessie!.teamId).toBe('team-9');
		expect(app.toestand.players).toHaveLength(1);
	});

	/*
	 * Halverwege blijven steken is het gevaarlijkst: dan staat de selectie van het
	 * ene team op een toestel dat het andere volgt, en duwt de eerstvolgende
	 * wijziging hem de verkeerde kant op.
	 */
	it('stapt niet half over als het ophalen mislukt', async () => {
		globalThis.fetch = vi.fn(async (url: string) => {
			if (String(url).includes('team_toestand')) throw new Error('geen bereik');
			return new Response('[]', { status: 200 });
		}) as unknown as typeof fetch;
		app.toestand.teamName = 'JO13-1';
		sync.sessie!.teamId = 'team-1';
		sync.sessie!.versie = 3;
		sync.vies = false;

		await sync.kiesTeam('team-9');

		expect(sync.sessie!.teamId).toBe('team-1');
		expect(sync.sessie!.versie).toBe(3);
		expect(app.toestand.teamName).toBe('JO13-1');
		expect(sync.message).toContain('niets veranderd');
	});

	it('stapt niet over met werk dat nog klaarstaat', async () => {
		server();
		sync.sessie!.teamId = 'team-1';
		sync.vies = true;
		await sync.kiesTeam('team-9');
		expect(sync.sessie!.teamId).toBe('team-1');
	});

	/* ---------- regel 2 ---------- */
	it('kiest niet zelf als er meer teams zijn', async () => {
		const verstuurd = server({
			teams: [
				{ id: 'team-1', naam: 'JO13-1' },
				{ id: 'team-9', naam: 'JO15-2' }
			]
		});
		sync.sessie!.teamId = undefined;
		await sync.opsturen();
		expect(sync.sessie!.teamId).toBeUndefined();
		expect(verstuurd.some((v) => v.url.includes('toestand_opslaan'))).toBe(false);
		expect(sync.mijnTeams).toHaveLength(2);
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
	it('zegt wat er aan de hand is en probeert het niet opnieuw', async () => {
		const nu = Date.now();
		for (let i = 0; i < 400; i++) noodrem.mag(nu + i * 10);
		const voor = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length;

		await sync.opsturen(false, true);

		expect((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(voor);
		expect(sync.message).toContain('stilgezet');
		expect(sync.botsing).toBe(false);
	});
});
