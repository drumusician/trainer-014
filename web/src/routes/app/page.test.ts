import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import Start from './+page.svelte';
import { app } from '$lib/store.svelte';
import { emptyState } from '$lib/domain/types';
import { lopendeWedstrijd, metSelectie, metWedstrijd } from '../../test/wedstrijd';
import { gegaanNaar } from '../../test/sveltekit/navigation';

/*
 * Het startscherm is de eerste blik op zaterdagochtend. Bovenaan hoort te staan
 * wat er nú speelt, en die kaart is zelf de knop ernaartoe. Welke van de vijf
 * kaarten er staat hangt af van de staat van de wedstrijd, en dat was tot nu toe
 * nergens vastgelegd.
 */
beforeEach(() => {
	localStorage.clear();
	gegaanNaar.length = 0;
	app.toestand = emptyState();
});

describe('het startscherm', () => {
	it('verwelkomt je als er nog geen spelers zijn', () => {
		render(Start);
		expect(screen.getByRole('link', { name: /aan de slag/i }).getAttribute('href')).toBe('/app/opzetten');
	});

	it('biedt zaterdag een nieuwe wedstrijd aan', () => {
		metSelectie();
		render(Start);
		expect(document.querySelector('.nu')?.textContent).toContain('Nieuwe wedstrijd');
	});

	it('wijst naar de opstelling zolang die nog leeg is', () => {
		metWedstrijd({ lineup: {} });
		render(Start);
		expect(document.querySelector('a.nu')?.getAttribute('href')).toBe('/app/opstelling/wedstrijd');
	});

	it('wijst naar het wedstrijdscherm als de opstelling staat', () => {
		metWedstrijd();
		render(Start);
		expect(document.querySelector('a.nu')?.getAttribute('href')).toBe('/app/wedstrijd');
	});

	it('toont de lopende klok tijdens de wedstrijd', () => {
		lopendeWedstrijd(185);
		render(Start);
		const kaart = document.querySelector('a.nu')?.textContent ?? '';
		expect(kaart).toContain('03:05');
		expect(kaart).toContain('Kampong');
	});

	/* Een gespeelde wedstrijd die nog niet bewaard is, is het makkelijkst kwijt
	   te raken. Daarom staat die bovenaan tot je hem opbergt. */
	it('herinnert je aan een wedstrijd die nog niet bewaard is', () => {
		metWedstrijd({ events: [{ type: 'start', t: 0 }], finished: true });
		render(Start);
		expect(document.querySelector('a.nu')?.getAttribute('href')).toBe('/app/afloop');
	});

	/* Zonder wedstrijd staan hier de instellingen; met wedstrijd de snelkoppelingen. */
	it('laat je de opzet kiezen als er niets loopt', () => {
		metSelectie();
		render(Start);
		expect(screen.getByText('Zo spelen jullie')).toBeTruthy();
		expect(screen.queryByText('Tegenstander en wie er is')).toBeNull();
	});

	it('geeft tijdens een wedstrijd de snelkoppelingen', () => {
		lopendeWedstrijd();
		render(Start);
		expect(screen.getByRole('link', { name: 'Tegenstander en wie er is' }).getAttribute('href')).toBe('/app/aanwezig');
		expect(screen.getByRole('link', { name: 'Opstelling' }).getAttribute('href')).toBe('/app/opstelling/wedstrijd');
	});

	it('zet in de lijst gespeelde wedstrijden de thuisploeg voorop', () => {
		metSelectie();
		app.toestand.archive = [
			{ date: '2026-09-13', opponent: 'Buitenboys', home: false, score: [5, 3] },
			{ date: '2026-09-06', opponent: 'De Meer', home: true, score: [9, 0] }
		] as never;
		render(Start);
		const regels = [...document.querySelectorAll('ul.log li')].map((li) => li.textContent?.replace(/\s+/g, ' '));
		expect(regels[0]).toContain('uit tegen Buitenboys 3–5');
		expect(regels[1]).toContain('thuis tegen De Meer 9–0');
	});

	it('toont Nederlands, geen Engelse resten van de hernoeming', () => {
		lopendeWedstrijd(600);
		render(Start);
		const tekst = document.body.textContent ?? '';
		for (const woord of ['lineup', 'match', 'undefined', 'NaN']) {
			expect(tekst).not.toContain(woord);
		}
	});
});
