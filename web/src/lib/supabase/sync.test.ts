import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sync } from './sync.svelte';
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
