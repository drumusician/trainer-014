import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import Aanwezig from './+page.svelte';
import { app } from '$lib/store.svelte';
import { emptyState } from '$lib/domain/types';
import { lopendeWedstrijd, metWedstrijd } from '../../../test/wedstrijd';

/*
 * Wie is er? Dit scherm is de eerste handeling van de zaterdag, en het bevat de
 * bewaking die in september één keer misging: iemand afwezig melden tijdens een
 * lopende wedstrijd haalde hem van het veld zonder wissel, en daarmee verdween
 * zijn hele speeltijd uit de terugrekening.
 */
beforeEach(() => {
	localStorage.clear();
	app.toestand = emptyState();
});

describe('het aanwezigheidsscherm', () => {
	it('zegt het als er geen wedstrijd is', () => {
		render(Aanwezig);
		expect(screen.getByRole('link', { name: 'Terug' })).toBeTruthy();
	});

	it('zet iedereen op aanwezig', () => {
		metWedstrijd();
		render(Aanwezig);
		expect(screen.getAllByRole('button', { name: 'Er wel' })).toHaveLength(6);
		expect(document.querySelector('.telling')?.textContent).toContain('6');
	});

	it('meldt iemand af en telt mee', async () => {
		metWedstrijd();
		render(Aanwezig);
		screen.getAllByRole('button', { name: 'Er wel' })[1].click();
		await tick();
		expect(app.toestand.match!.absent).toContain('v1');
		expect(document.querySelector('.telling')?.textContent).toContain('5');
	});

	it('haalt een afgemelde speler van het veld', async () => {
		metWedstrijd();
		render(Aanwezig);
		screen.getAllByRole('button', { name: 'Er wel' })[1].click();
		await tick();
		expect(app.toestand.match!.lineup.LV).toBeFalsy();
	});

	/*
	 * Dit is de bewaking. Wie na het fluitsignaal op het veld staat kan niet meer
	 * met één tik verdwijnen; die moet je eerst wisselen, anders is zijn speeltijd
	 * niet meer terug te rekenen.
	 */
	it('laat iemand die op het veld staat niet afmelden tijdens de wedstrijd', () => {
		lopendeWedstrijd(600);
		render(Aanwezig);
		const opHetVeld = [...document.querySelectorAll('.presknop.veld')];
		expect(opHetVeld).toHaveLength(5);
		expect(opHetVeld[0].tagName).toBe('SPAN');
	});

	it('laat de bankspeler tijdens de wedstrijd wel afmelden', async () => {
		lopendeWedstrijd(600);
		render(Aanwezig);
		const knoppen = screen.getAllByRole('button', { name: 'Er wel' });
		expect(knoppen).toHaveLength(1);
		knoppen[0].click();
		await tick();
		expect(app.toestand.match!.absent).toEqual(['b1']);
	});

	it('wijst tijdens de wedstrijd terug naar het veld en anders naar de opstelling', () => {
		metWedstrijd();
		const voor = render(Aanwezig);
		expect(voor.getByRole('link', { name: /opstelling/i }).getAttribute('href')).toBe('/app/opstelling/wedstrijd');
		voor.unmount();

		lopendeWedstrijd();
		render(Aanwezig);
		expect(screen.getByRole('link', { name: /wedstrijd/i }).getAttribute('href')).toBe('/app/wedstrijd');
	});

	it('neemt de tegenstander over', async () => {
		metWedstrijd();
		render(Aanwezig);
		const vak = document.querySelector('input') as HTMLInputElement;
		vak.value = 'Hercules';
		/* Svelte hangt de change-afhandeling aan de wortel op, dus de gebeurtenis
		   moet omhoog kunnen borrelen. */
		vak.dispatchEvent(new Event('change', { bubbles: true }));
		await tick();
		expect(app.toestand.match!.opponent).toBe('Hercules');
	});

	it('toont Nederlands, geen Engelse resten van de hernoeming', () => {
		metWedstrijd();
		render(Aanwezig);
		const tekst = document.body.textContent ?? '';
		for (const woord of ['absent', 'present', 'player', 'undefined']) {
			expect(tekst).not.toContain(woord);
		}
	});
});
