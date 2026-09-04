import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sync } from './sync.svelte';
import { app } from '$lib/toestand.svelte';
import { legeToestand } from '$lib/domein/types';

/** Een nepserver: genoeg om de beslissingen te testen, niet het netwerk. */
function nepFetch(opties: { versie?: number; data?: unknown; botsing?: boolean; stuk?: boolean } = {}) {
	const verstuurd: unknown[] = [];
	const f = vi.fn(async (url: string, init?: RequestInit) => {
		const body = init?.body ? JSON.parse(String(init.body)) : null;
		if (opties.stuk) throw new Error('geen bereik');
		if (url.includes('/rest/v1/teams')) {
			return new Response(JSON.stringify([{ id: 'team-1' }]), { status: 200 });
		}
		if (url.includes('rpc/toestand_opslaan')) {
			if (opties.botsing) {
				return new Response(JSON.stringify({ code: '40001', message: 'versie loopt niet gelijk' }), { status: 500 });
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
	app.toestand = legeToestand();
	app.toestand.spelers = [{ id: 'p1', naam: 'Daanish', linie: 'M' }];
	sync.sessie = {
		access_token: 'token', refresh_token: 'r', verloopt: Date.now() + 3600_000,
		user_id: 'u1', email: 'trainer@voorbeeld.nl', teamId: 'team-1', versie: 1, laatst: null, afdruk: null
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
		expect((verstuurd[0] as { spelers: unknown[] }).spelers).toHaveLength(1);
	});

	it('doet niets als alleen de lopende wedstrijd veranderde', async () => {
		nepFetch({ versie: 1 });
		sync.merkVies();
		await sync.duwAlsNodig();
		expect(sync.vies).toBe(false);

		app.nieuweWedstrijd('Sparta', true); /* raakt het pakket niet */
		sync.merkVies();
		expect(sync.vies).toBe(false);
	});

	it('haalt niet stiekem op als er hier nog iets klaarstaat', async () => {
		nepFetch({ versie: 9, data: { spelers: [{ id: 'x', naam: 'Vreemd', linie: '' }] } });
		sync.vies = true;
		await sync.ophalen(true);
		expect(app.toestand.spelers[0].naam).toBe('Daanish');
	});

	it('haalt wel op als er hier niets klaarstaat', async () => {
		nepFetch({ versie: 9, data: { spelers: [{ id: 'x', naam: 'Vanaf de laptop', linie: '' }], trainingen: [], archief: [] } });
		await sync.ophalen(true);
		expect(app.toestand.spelers[0].naam).toBe('Vanaf de laptop');
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

		/* alsof de app opnieuw geladen wordt terwijl jij in je mail zit */
		sync.sessie = null;
		sync.fase = 'email';
		sync.email = '';
		sync.laad();
		expect(sync.fase).toBe('code');
		expect(sync.email).toBe('trainer@voorbeeld.nl');
	});

	it('vergeet de poging zodra je binnen bent', async () => {
		globalThis.fetch = vi.fn(async (url: string) =>
			url.includes('verify')
				? new Response(JSON.stringify({ access_token: 'a', refresh_token: 'r', expires_in: 3600, user: { id: 'u', email: 'trainer@voorbeeld.nl' } }), { status: 200 })
				: new Response('{}', { status: 200 })
		) as unknown as typeof fetch;
		await sync.stuurCode('trainer@voorbeeld.nl');
		await sync.controleerCode('123456');
		expect(sync.sessie?.email).toBe('trainer@voorbeeld.nl');
		sync.sessie = null;
		sync.fase = 'email';
		sync.laad();
		expect(sync.fase).toBe('email');
	});
});
