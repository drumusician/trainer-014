import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import Opzetten from './+page.svelte';
import Spelers from '../team/spelers/+page.svelte';
import { app } from '$lib/store.svelte';
import { emptyState, type ArchivedMatch } from '$lib/domain/types';
import { metSelectie } from '../../../test/wedstrijd';
import { gegaanNaar } from '../../../test/sveltekit/navigation';

/*
 * Het opzetscherm is de allereerste minuut van een nieuwe trainer met deze app.
 * Drie stappen, en na afloop staat er een team. Wat hier misgaat merkt iemand
 * die de app nog niet kent, en die komt niet terug.
 */
beforeEach(() => {
	localStorage.clear();
	gegaanNaar.length = 0;
	app.toestand = emptyState();
	vi.restoreAllMocks();
	vi.stubGlobal('alert', () => {});
});

function vulIn(kies: string, waarde: string) {
	const vak = document.querySelector(kies) as HTMLInputElement | HTMLTextAreaElement;
	vak.value = waarde;
	vak.dispatchEvent(new Event('input', { bubbles: true }));
	return tick();
}

describe('het opzetscherm', () => {
	it('begint bij stap één', () => {
		render(Opzetten);
		expect(document.querySelector('.stappen-teller')?.textContent).toContain('1');
	});

	it('laat je niet door zonder teamnaam', async () => {
		render(Opzetten);
		screen.getByRole('button', { name: 'Verder' }).click();
		await tick();
		expect(document.querySelector('.stappen-teller')?.textContent).toContain('1');
	});

	it('loopt de drie stappen af en zet het team neer', async () => {
		render(Opzetten);
		await vulIn('input', 'JO14-3');
		screen.getByRole('button', { name: 'Verder' }).click();
		await tick();
		expect(app.toestand.teamName).toBe('JO14-3');

		await vulIn('textarea', 'Bram\nCas\nDirk');
		screen.getByRole('button', { name: 'Verder' }).click();
		await tick();
		expect(app.toestand.players).toHaveLength(3);
		expect(document.body.textContent).toContain('JO14-3');
	});

	it('laat je niet door zonder spelers', async () => {
		render(Opzetten);
		await vulIn('input', 'JO14-3');
		screen.getByRole('button', { name: 'Verder' }).click();
		await tick();
		screen.getByRole('button', { name: 'Verder' }).click();
		await tick();
		expect(document.body.textContent).not.toContain('Zo gaan jullie spelen');
	});

	it('neemt over wat er al staat als je halverwege binnenkomt', () => {
		metSelectie();
		render(Opzetten);
		expect((document.querySelector('input') as HTMLInputElement).value).toBe('O14-3');
	});

	/* Aan het eind twee wegen: meteen een opstelling maken, of later. */
	it('brengt je naar de standaardopstelling als je die meteen wilt', async () => {
		metSelectie();
		render(Opzetten);
		await vulIn('input', 'O14-3');
		screen.getByRole('button', { name: 'Verder' }).click();
		await tick();
		screen.getByRole('button', { name: 'Verder' }).click();
		await tick();
		screen.getByRole('button', { name: 'Opstelling maken' }).click();
		expect(app.toestand.defaultLineup).toBeTruthy();
		expect(gegaanNaar).toContain('/app/opstelling/standaard');
	});

	it('brengt je naar start als je dat liever later doet', async () => {
		metSelectie();
		render(Opzetten);
		await vulIn('input', 'O14-3');
		screen.getByRole('button', { name: 'Verder' }).click();
		await tick();
		screen.getByRole('button', { name: 'Verder' }).click();
		await tick();
		screen.getByRole('button', { name: 'Later' }).click();
		expect(gegaanNaar).toContain('/app');
	});
});

describe('de spelersstatistieken', () => {
	const WEDSTRIJD: ArchivedMatch = {
		date: '2026-09-06',
		opponent: 'Kampong',
		home: true,
		score: [2, 0],
		formation: '1-2-1-1',
		duration: 2400,
		parts: 2,
		events: [
			{ type: 'start', t: 0 },
			{ type: 'goal', t: 300, player: 'a1' },
			{ type: 'goal', t: 1500, player: 'a1' }
		] as never,
		playingTime: [
			{ id: 'k1', name: 'Bram', seconds: 2400 },
			{ id: 'a1', name: 'Finn', seconds: 1200 },
			{ id: 'b1', name: 'Gijs', seconds: 600 }
		] as never
	};

	it('zegt het als er nog geen spelers zijn', () => {
		render(Spelers);
		expect(document.querySelector('table')).toBeNull();
	});

	it('zet iedereen in de tabel', () => {
		metSelectie();
		app.toestand.archive = [WEDSTRIJD];
		render(Spelers);
		expect(document.querySelectorAll('table tr')).toHaveLength(6);
	});

	/* De sorteerknoppen zijn de hele functie van dit scherm: dezelfde spelers,
	   vier vragen. Wie speelde het minst, wie is er het minst, wie scoorde. */
	it('sorteert op minuten, en op naam als je dat vraagt', async () => {
		metSelectie();
		app.toestand.archive = [WEDSTRIJD];
		render(Spelers);
		/* De naam staat vooraan in de cel, met de rol en het gemiddelde erachter. */
		const namen = () =>
			[...document.querySelectorAll('table tr td:first-child')].map((c) => c.textContent?.trim().split(' ')[0]);
		expect(namen()[0]).toBe('Bram');

		screen.getByRole('button', { name: 'Naam' }).click();
		await tick();
		expect(namen()).toEqual(['Bram', 'Cas', 'Dirk', 'Eef', 'Finn', 'Gijs']);
	});

	it('sorteert op doelpunten', async () => {
		metSelectie();
		app.toestand.archive = [WEDSTRIJD];
		render(Spelers);
		screen.getByRole('button', { name: 'Doelpunten' }).click();
		await tick();
		const eerste = document.querySelector('table tr')?.textContent ?? '';
		expect(eerste).toContain('Finn');
	});
});
