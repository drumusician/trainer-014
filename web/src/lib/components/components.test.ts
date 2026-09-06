import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import Speeltijd from './Speeltijd.svelte';
import Verloop from './Verloop.svelte';
import Verslag from './Verslag.svelte';
import Tabs from './Tabs.svelte';
import { app } from '$lib/store.svelte';
import { emptyState } from '$lib/domain/types';
import { page } from '../../test/sveltekit/state.svelte';

beforeEach(() => {
	localStorage.clear();
	app.toestand = emptyState();
	app.toestand.players = [
		{ id: 'a1', name: 'Finn', line: 'A' },
		{ id: 'b1', name: 'Gijs', line: 'A' },
		{ id: 'k1', name: 'Bram', line: '', keeper: true }
	];
	page.url = new URL('http://localhost/app');
});

describe('de speeltijdtabel', () => {
	const rijen = [
		{ name: 'Finn', seconds: 1200 },
		{ name: 'Gijs', seconds: 3000 },
		{ name: 'Bram', seconds: 600, sub: 'keeper' }
	];

	it('zet de langste speeltijd bovenaan', () => {
		render(Speeltijd, { rijen });
		const namen = [...document.querySelectorAll('tr td:first-child')].map((c) => c.textContent);
		expect(namen[0]).toBe('Gijs');
		expect(namen[2]).toContain('Bram');
	});

	it('rekent seconden om naar hele minuten', () => {
		render(Speeltijd, { rijen });
		expect(screen.getByText('20 min')).toBeTruthy();
		expect(screen.getByText('50 min')).toBeTruthy();
	});

	/* De balk is de hele reden dat dit een tabel is en geen lijstje: je ziet in
	   één oogopslag wie achterblijft. De langste is altijd vol. */
	it('schaalt de balken op de langste speeltijd', () => {
		render(Speeltijd, { rijen });
		const breedtes = [...document.querySelectorAll('.staaf i')].map((i) =>
			(i as HTMLElement).style.width.replace('%', '')
		);
		expect(breedtes).toEqual(['100', '40', '20']);
	});

	it('valt niet om op een lege tabel', () => {
		render(Speeltijd, { rijen: [] });
		expect(document.querySelectorAll('tr')).toHaveLength(0);
	});
});

describe('het verloop', () => {
	it('zet elke gebeurtenis op zijn tijdstip', () => {
		render(Verloop, {
			props: {
				events: [
					{ type: 'start', t: 0 },
					{ type: 'goal', t: 300, player: 'a1' },
					{ type: 'conceded', t: 900 }
				] as never,
				parts: 2
			}
		});
		const regels = [...document.querySelectorAll('li')].map((l) => l.textContent);
		expect(regels.some((r) => r?.includes('05:00') && r?.includes('Finn'))).toBe(true);
		expect(regels.some((r) => r?.includes('15:00'))).toBe(true);
	});

	it('blijft leeg als er niets gebeurd is', () => {
		render(Verloop, { props: { events: [], parts: 2 } });
		expect(document.querySelectorAll('li')).toHaveLength(0);
	});
});

describe('het verslag', () => {
	const bron = {
		date: '2026-09-06',
		opponent: 'Kampong',
		home: true,
		score: [2, 1] as [number, number],
		formation: '1-2-1-1',
		duration: 3000,
		events: [
			{ type: 'start', t: 0 },
			{ type: 'goal', t: 600, player: 'a1' }
		] as never,
		parts: 2 as const,
		teamName: 'O14-3'
	};

	it('zet de tekst pas neer als je hem kopieert', async () => {
		render(Verslag, { props: { bron } });
		expect(document.querySelector('textarea')).toBeNull();
		screen.getByRole('button', { name: 'Verslag kopiëren' }).click();
		await tick();
		expect(document.querySelector('textarea')?.value).toContain('Kampong');
	});

	/* Of de wissels meegaan is een voorkeur die je onthoudt tot de volgende keer. */
	it('onthoudt of de wissels meegaan', async () => {
		render(Verslag, { props: { bron } });
		const knop = screen.getByRole('button', { name: /Wissels/ });
		const eerst = app.toestand.reportSubs;
		knop.click();
		await tick();
		expect(app.toestand.reportSubs).toBe(!eerst);
		expect(JSON.parse(localStorage.getItem('o14-app-v1') ?? '{}').reportSubs).toBe(!eerst);
	});
});

describe('de tabbalk', () => {
	it('zet vier plekken neer', () => {
		render(Tabs);
		expect(screen.getAllByRole('link')).toHaveLength(4);
	});

	it('markeert waar je bent', () => {
		page.url = new URL('http://localhost/app/team');
		render(Tabs);
		expect(screen.getByRole('link', { current: 'page' }).getAttribute('href')).toBe('/app/team');
	});

	/* Alles wat met een wedstrijd te maken heeft telt mee voor de eerste tab, ook
	   het archief en de opstelling. Anders licht er onderweg niets op. */
	it('rekent wedstrijdschermen bij de eerste tab', () => {
		for (const pad of ['/app/wedstrijd', '/app/archief/2', '/app/afloop', '/app/opstelling/wedstrijd']) {
			page.url = new URL('http://localhost' + pad);
			const { unmount } = render(Tabs);
			expect(screen.getByRole('link', { current: 'page' }).getAttribute('href'), pad).toBe('/app');
			unmount();
		}
	});

	it('geeft de echte hoogte van de balk door aan de rest van de app', () => {
		render(Tabs);
		expect(document.documentElement.style.getPropertyValue('--balk')).toMatch(/px$/);
	});
});
