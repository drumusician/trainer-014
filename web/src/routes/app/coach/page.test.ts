import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import Coach from './[bron]/+page.svelte';
import { app } from '$lib/store.svelte';
import { sync, noodrem } from '$lib/supabase/sync.svelte';
import { emptyState } from '$lib/domain/types';
import type { CoachVoorstel } from '$lib/domain/coach';
import { metSelectie, metWedstrijd } from '../../../test/wedstrijd';
import { page } from '../../../test/sveltekit/state.svelte';
import { gegaanNaar } from '../../../test/sveltekit/navigation';

/*
 * De assistent. Het denkwerk zit op de server; dit scherm stuurt de vraag, laat
 * het voorstel zien, en neemt het alleen over als het klopt.
 */
const TEAM = '6f1d2c3b-1111-4222-8333-944455556666';

let gevraagd: { url: string; body: Record<string, unknown> }[] = [];

function antwoordtMet(status: number, body: unknown) {
	globalThis.fetch = vi.fn(async (url: string, init?: RequestInit) => {
		gevraagd.push({ url, body: JSON.parse(String(init?.body ?? '{}')) });
		return new Response(JSON.stringify(body), { status });
	}) as unknown as typeof fetch;
}

function ingelogd() {
	sync.sessie = {
		access_token: 'tok',
		refresh_token: 'ref',
		verloopt: Date.now() + 3_600_000,
		teamId: TEAM
	} as never;
}

/* De ploeg uit test/wedstrijd.ts, in 1-2-2-1. ML is nog leeg. */
function wedstrijd() {
	const w = metWedstrijd({ formation: '1-2-2-1' });
	w.lineup = { K: 'k1', LV: 'v1', RV: 'v2', MR: 'm1', ML: null, SP: 'a1' };
	w.bench = ['b1'];
	return w;
}

const VOORSTEL_1221: CoachVoorstel = {
	samenvatting: 'Gijs begint, Finn komt er in de rust in.',
	opstelling: [
		{ plek: 'K', speler: 'Bram' },
		{ plek: 'LV', speler: 'Cas' },
		{ plek: 'RV', speler: 'Dirk' },
		{ plek: 'MR', speler: 'Eef' },
		{ plek: 'ML', speler: 'Finn' },
		{ plek: 'SP', speler: 'Gijs' }
	],
	bank: [],
	wisselplan: [{ minuut: 20, eruit: 'Gijs', erin: 'Finn', waarom: 'Evenveel speeltijd.' }],
	redenen: ['Gijs begon vorige keer op de bank.'],
	aandachtspunten: ['Laat Eef praten.']
};

async function vraag(tekst = 'Morgen tegen de nummer 1.') {
	const vak = document.querySelector('textarea') as HTMLTextAreaElement;
	vak.value = tekst;
	vak.dispatchEvent(new Event('input', { bubbles: true }));
	screen.getByRole('button', { name: /Vraag om een voorstel|Opnieuw vragen/ }).click();
	/* de fetch is een belofte, en daarna nog een render */
	for (let i = 0; i < 10; i++) await tick();
	await new Promise((r) => setTimeout(r, 0));
	await tick();
}

beforeEach(() => {
	localStorage.clear();
	gegaanNaar.length = 0;
	gevraagd = [];
	app.toestand = emptyState();
	page.params = { bron: 'wedstrijd' };
	sync.sessie = null;
	noodrem.los();
});

describe('de assistent', () => {
	it('vraagt eerst om in te loggen', () => {
		wedstrijd();
		render(Coach);
		expect(screen.getByText('Eerst inloggen')).toBeTruthy();
		expect(screen.getByRole('link', { name: 'Naar inloggen' }).getAttribute('href')).toBe('/app/meer');
	});

	it('zegt het als er niets op te stellen is', () => {
		metSelectie();
		ingelogd();
		render(Coach);
		expect(document.body.textContent).toContain('Er is geen opstelling om over mee te denken');
	});

	it('stuurt de vraag met het team naar de server en laat het voorstel zien', async () => {
		wedstrijd();
		ingelogd();
		antwoordtMet(200, { voorstel: VOORSTEL_1221, over: 19 });
		render(Coach);
		await vraag();

		expect(gevraagd).toHaveLength(1);
		expect(gevraagd[0].url).toContain('/functions/v1/coach');
		expect(gevraagd[0].body.teamId).toBe(TEAM);
		expect(gevraagd[0].body.vraag).toBe('Morgen tegen de nummer 1.');
		expect(gevraagd[0].body.formatie).toBe('1-2-2-1');

		const tekst = document.body.textContent ?? '';
		expect(tekst).toContain('Gijs begint, Finn komt er in de rust in.');
		expect(tekst).toContain('20′ Finn erin voor Gijs');
		expect(tekst).toContain('Gijs begon vorige keer op de bank.');
		expect(tekst).toContain('Laat Eef praten.');
		expect(tekst).toContain('vandaag nog 19 keer');
	});

	/* Een halve minuut naar een stil scherm kijken voelt als kapot. */
	it('laat zien dat hij bezig is, met een klok die loopt', async () => {
		vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
		wedstrijd();
		ingelogd();
		let antwoord!: (r: Response) => void;
		globalThis.fetch = vi.fn(() => new Promise<Response>((r) => (antwoord = r))) as unknown as typeof fetch;
		render(Coach);
		(document.querySelector('textarea') as HTMLTextAreaElement).value = 'Morgen.';
		screen.getByRole('button', { name: /Vraag om een voorstel/ }).click();
		await tick();
		await tick();

		expect(screen.getByRole('button', { name: 'Bezig…' }).hasAttribute('disabled')).toBe(true);
		expect(screen.getByRole('status').textContent).toContain('De assistent denkt na');
		vi.advanceTimersByTime(23_000);
		await tick();
		expect(screen.getByRole('status').textContent).toContain('23 seconden');
		expect(screen.getByRole('status').textContent).not.toContain('langer dan normaal');
		vi.advanceTimersByTime(60_000);
		await tick();
		expect(screen.getByRole('status').textContent).toContain('langer dan normaal');

		antwoord(new Response(JSON.stringify({ voorstel: VOORSTEL_1221, over: 19 }), { status: 200 }));
		for (let i = 0; i < 10; i++) await tick();
		await vi.waitFor(() => expect(screen.queryByRole('status')).toBeNull());
		expect(document.body.textContent).toContain('Gijs begint, Finn komt er in de rust in.');
		vi.useRealTimers();
	});

	/* Anders kijk je naar het vorige antwoord en denk je dat er niets gebeurt. */
	it('laat het vorige voorstel niet staan terwijl hij opnieuw nadenkt', async () => {
		wedstrijd();
		ingelogd();
		antwoordtMet(200, { voorstel: VOORSTEL_1221, over: 19 });
		render(Coach);
		await vraag();
		expect(document.body.textContent).toContain('Gijs begint');

		globalThis.fetch = vi.fn(() => new Promise<Response>(() => {})) as unknown as typeof fetch;
		screen.getByRole('button', { name: /Opnieuw vragen/ }).click();
		await tick();
		await tick();
		expect(document.body.textContent).not.toContain('Gijs begint');
		expect(screen.getByRole('status')).toBeTruthy();
	});

	it('stuurt bij: het vorige voorstel en alle wensen gaan mee', async () => {
		wedstrijd();
		ingelogd();
		antwoordtMet(200, { voorstel: VOORSTEL_1221, over: 19 });
		render(Coach);
		await vraag('Tegen de nummer 1.');

		const bijsturen = async (wens: string, samenvatting: string) => {
			antwoordtMet(200, { voorstel: { ...VOORSTEL_1221, samenvatting }, over: 18 });
			const vak = screen.getByLabelText('Wat wil je anders?') as HTMLTextAreaElement;
			vak.value = wens;
			vak.dispatchEvent(new Event('input', { bubbles: true }));
			await tick();
			screen.getByRole('button', { name: 'Pas het voorstel aan' }).click();
			for (let i = 0; i < 10; i++) await tick();
			await new Promise((r) => setTimeout(r, 0));
			await tick();
		};

		await bijsturen('Finn in de basis.', 'Finn begint nu.');
		const eerste = gevraagd.at(-1)!.body as {
			vraag: string;
			vorige: { voorstel: CoachVoorstel; bijsturingen: string[] };
		};
		expect(eerste.vraag).toBe('Tegen de nummer 1.');
		expect(eerste.vorige.voorstel.samenvatting).toBe('Gijs begint, Finn komt er in de rust in.');
		expect(eerste.vorige.bijsturingen).toEqual(['Finn in de basis.']);
		expect(document.body.textContent).toContain('Finn begint nu.');
		expect(document.body.textContent).toContain('Finn in de basis.');

		/* De tweede ronde vergeet de eerste wens niet. */
		await bijsturen('Gijs liever links.', 'Gijs staat links.');
		const tweede = gevraagd.at(-1)!.body as { vorige: { voorstel: CoachVoorstel; bijsturingen: string[] } };
		expect(tweede.vorige.voorstel.samenvatting).toBe('Finn begint nu.');
		expect(tweede.vorige.bijsturingen).toEqual(['Finn in de basis.', 'Gijs liever links.']);
		/* het vakje is weer leeg voor de volgende wens */
		expect((screen.getByLabelText('Wat wil je anders?') as HTMLTextAreaElement).value).toBe('');
	});

	it('begint weer van nul als je opnieuw vraagt', async () => {
		wedstrijd();
		ingelogd();
		antwoordtMet(200, { voorstel: VOORSTEL_1221, over: 19 });
		render(Coach);
		await vraag('Tegen de nummer 1.');
		await vraag('Tegen de nummer 3.');
		expect('vorige' in gevraagd.at(-1)!.body).toBe(false);
	});

	it('bewaart de vaste afspraken en stuurt ze mee', async () => {
		wedstrijd();
		ingelogd();
		antwoordtMet(200, { voorstel: VOORSTEL_1221, over: 19 });
		render(Coach);
		const vak = screen.getByPlaceholderText(/wie keept, begint niet op de bank/i) as HTMLTextAreaElement;
		vak.value = 'Wie keept, begint niet op de bank.';
		vak.dispatchEvent(new Event('input', { bubbles: true }));
		await tick();
		expect(app.toestand.coachAfspraken).toBe('Wie keept, begint niet op de bank.');
		await vraag();
		expect(gevraagd[0].body.afspraken).toBe('Wie keept, begint niet op de bank.');
	});

	it('kan niet bijsturen zonder wens', async () => {
		wedstrijd();
		ingelogd();
		antwoordtMet(200, { voorstel: VOORSTEL_1221, over: 19 });
		render(Coach);
		await vraag();
		expect(screen.getByRole('button', { name: 'Pas het voorstel aan' }).hasAttribute('disabled')).toBe(true);
	});

	it('neemt een kloppend voorstel over en gaat terug naar de opstelling', async () => {
		wedstrijd();
		ingelogd();
		antwoordtMet(200, { voorstel: VOORSTEL_1221, over: 19 });
		render(Coach);
		await vraag();
		screen.getByRole('button', { name: 'Neem deze opstelling over' }).click();
		expect(app.toestand.match!.lineup).toEqual({ K: 'k1', LV: 'v1', RV: 'v2', MR: 'm1', ML: 'a1', SP: 'b1' });
		expect(app.toestand.match!.bench).toEqual([]);
		expect(gegaanNaar).toContain('/app/opstelling/wedstrijd');
	});

	it('neemt een voorstel met een dubbele speler niet over', async () => {
		wedstrijd();
		ingelogd();
		const dubbel = {
			...VOORSTEL_1221,
			opstelling: VOORSTEL_1221.opstelling.map((r) => (r.plek === 'ML' ? { ...r, speler: 'Eef' } : r))
		};
		antwoordtMet(200, { voorstel: dubbel, over: 18 });
		render(Coach);
		await vraag();
		expect(screen.queryByRole('button', { name: 'Neem deze opstelling over' })).toBeNull();
		expect(document.body.textContent).toContain('Eef staat twee keer op het veld.');
	});

	it('laat de melding van de server zien als het niet mag', async () => {
		wedstrijd();
		ingelogd();
		antwoordtMet(429, { fout: 'Je hebt de assistent vandaag al vaak genoeg gevraagd. Morgen weer.' });
		render(Coach);
		await vraag();
		expect(screen.getByRole('alert').textContent).toContain('vaak genoeg gevraagd');
	});

	it('zegt het als de assistent nog niet op de server staat', async () => {
		wedstrijd();
		ingelogd();
		antwoordtMet(404, { code: 'NOT_FOUND', message: 'Requested function was not found' });
		render(Coach);
		await vraag();
		expect(screen.getByRole('alert').textContent).toContain('staat nog niet aan');
	});

	it('zegt het als er geen verbinding is', async () => {
		wedstrijd();
		ingelogd();
		globalThis.fetch = vi.fn(async () => {
			throw new TypeError('Failed to fetch');
		}) as unknown as typeof fetch;
		render(Coach);
		await vraag();
		expect(screen.getByRole('alert').textContent).toContain('Geen verbinding');
	});

	/* Terugkomen kost geen nieuwe beurt en geen nieuwe minuut wachten. */
	it('laat het vorige voorstel weer zien als je terugkomt', async () => {
		wedstrijd();
		ingelogd();
		antwoordtMet(200, { voorstel: VOORSTEL_1221, over: 19 });
		const eerste = render(Coach);
		await vraag('Tegen de nummer 1.');
		eerste.unmount();

		render(Coach);
		await tick();
		expect(document.body.textContent).toContain('Gijs begint, Finn komt er in de rust in.');
		expect((document.querySelector('textarea') as HTMLTextAreaElement).value).toBe('Tegen de nummer 1.');
		expect(gevraagd).toHaveLength(1);
	});

	it('zegt bij de standaardopstelling dat de app niet weet wie er morgen is', () => {
		metSelectie();
		app.toestand.defaultLineup = { formation: '1-2-2-1', lineup: {}, bench: [] };
		page.params = { bron: 'standaard' };
		ingelogd();
		render(Coach);
		expect(document.body.textContent).toContain('weet niet wie er morgen is');
	});

	it('stuurt je na de aftrap naar de wedstrijd', () => {
		wedstrijd().events = [{ type: 'start', t: 0 }];
		ingelogd();
		render(Coach);
		expect(gegaanNaar).toContain('/app/wedstrijd');
	});
});
