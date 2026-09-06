import { beforeEach, describe, expect, it } from 'vitest';
import { tick } from 'svelte';
import { render, screen } from '@testing-library/svelte';
import Opstelling from './+page.svelte';
import { app } from '$lib/store.svelte';
import { emptyState } from '$lib/domain/types';
import { metSelectie, metWedstrijd } from '../../../../test/wedstrijd';
import { page } from '../../../../test/sveltekit/state.svelte';
import { gegaanNaar } from '../../../../test/sveltekit/navigation';

/*
 * Het opstelscherm is het scherm van de avond ervoor: slepen tot het klopt. Na
 * het fluitsignaal mag dat niet meer, want vanaf dan wordt de speeltijd
 * teruggerekend uit de wissels en zou verschuiven zonder gebeurtenis de
 * geschiedenis herschrijven. Die grens wordt hier bewaakt.
 */

function opstellingVoorWedstrijd(events: unknown[] = []) {
	metWedstrijd({ events: events as never });
}

beforeEach(() => {
	localStorage.clear();
	gegaanNaar.length = 0;
	page.params = { bron: 'wedstrijd' };
	app.toestand = emptyState();
	app.chosenPosition = null;
});

describe('het opstelscherm', () => {
	it('vraagt om een selectie als die er nog niet is', () => {
		render(Opstelling);
		expect(screen.getByRole('link', { name: 'Aan de slag' })).toBeTruthy();
	});

	it('zet veld en bank neer voor de wedstrijd van morgen', () => {
		opstellingVoorWedstrijd();
		render(Opstelling);
		expect(screen.getByText('Bram')).toBeTruthy();
		expect(screen.getByText('Gijs')).toBeTruthy();
	});

	it('wisselt twee plekken om als je ze allebei aantikt', () => {
		opstellingVoorWedstrijd();
		render(Opstelling);
		screen.getByRole('button', { name: /Bram/ }).click();
		screen.getByRole('button', { name: /Finn/ }).click();
		expect(app.toestand.match!.lineup.K).toBe('a1');
		expect(app.toestand.match!.lineup.SP).toBe('k1');
	});

	it('zet een bankspeler op de gekozen plek', () => {
		opstellingVoorWedstrijd();
		render(Opstelling);
		screen.getByRole('button', { name: /Finn/ }).click();
		screen.getByRole('button', { name: /Gijs/ }).click();
		expect(app.toestand.match!.lineup.SP).toBe('b1');
		expect(app.toestand.match!.bench).toContain('a1');
	});

	it('vertelt wie je gekozen hebt', async () => {
		opstellingVoorWedstrijd();
		render(Opstelling);
		screen.getByRole('button', { name: /Cas/ }).click();
		await tick();
		expect(screen.getByRole('button', { name: 'Naar de bank' })).toBeTruthy();
		expect(document.querySelector('.melding')?.textContent).toContain('Cas');
	});

	/* Een linie zonder wisselspeler wil je nu weten, niet zondagochtend. */
	it('waarschuwt voor een linie zonder wisselspeler', () => {
		opstellingVoorWedstrijd();
		render(Opstelling);
		const waarschuwing = document.querySelector('.mager')?.textContent ?? '';
		/* alleen Gijs zit op de bank, en die is aanvaller */
		expect(waarschuwing).toContain('keeper');
		expect(waarschuwing).toContain('verdediging');
		expect(waarschuwing).not.toContain('aanval');
	});

	/*
	 * Dit is de bewaking. Zodra de wedstrijd begonnen is hoort schuiven niet meer
	 * hier maar op het wedstrijdscherm, waar elke verplaatsing een gebeurtenis
	 * wegschrijft.
	 */
	it('stuurt je naar het wedstrijdscherm zodra er afgetrapt is', async () => {
		opstellingVoorWedstrijd([{ type: 'start', t: 0 }]);
		render(Opstelling);
		await Promise.resolve();
		expect(gegaanNaar).toContain('/app/wedstrijd');
	});

	it('laat je vóór het fluitsignaal gewoon schuiven', async () => {
		opstellingVoorWedstrijd();
		render(Opstelling);
		await Promise.resolve();
		expect(gegaanNaar).not.toContain('/app/wedstrijd');
	});

	/* De standaardopstelling is een ander doel, maar hetzelfde scherm. */
	it('maakt een standaardopstelling aan als die nog niet bestaat', async () => {
		metSelectie();
		page.params = { bron: 'standaard' };
		render(Opstelling);
		await Promise.resolve();
		expect(app.toestand.defaultLineup).toBeTruthy();
	});

	it('toont Nederlands, geen Engelse resten van de hernoeming', () => {
		opstellingVoorWedstrijd();
		render(Opstelling);
		const tekst = document.body.textContent ?? '';
		for (const woord of ['lineup', 'bench', 'player', 'position', 'undefined']) {
			expect(tekst).not.toContain(woord);
		}
	});
});
