import { beforeEach, describe, expect, it } from 'vitest';
import { tick } from 'svelte';
import { render, screen } from '@testing-library/svelte';
import Opstelling from './+page.svelte';
import { app } from '$lib/store.svelte';
import { emptyState, type ArchivedMatch } from '$lib/domain/types';
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

/*
 * Onder het veld: wie zat er al veel op de bank, en hoe vaak was hij op de
 * training. Zodat niet elke week dezelfde jongens op de bank beginnen.
 */
describe('wie zat er op de bank', () => {
	/* Gijs begon op de bank en kwam er na twintig minuten in voor Finn. */
	const VORIGE: ArchivedMatch = {
		date: '2026-09-13',
		opponent: 'Buitenboys',
		home: false,
		score: [1, 0],
		formation: '1-2-1-1',
		duration: 2400,
		parts: 2,
		absent: [],
		events: [
			{ type: 'start', t: 0 },
			{ type: 'substitution', t: 1200, position: 'SP', off: 'a1', on: 'b1' }
		] as never,
		lineup: { K: 'k1', LV: 'v1', RV: 'v2', CM: 'm1', SP: 'b1' },
		bench: ['a1'],
		playingTime: [
			{ id: 'k1', name: 'Bram', seconds: 2400, keeper: 2400 },
			{ id: 'v1', name: 'Cas', seconds: 2400 },
			{ id: 'v2', name: 'Dirk', seconds: 2400 },
			{ id: 'm1', name: 'Eef', seconds: 2400 },
			{ id: 'a1', name: 'Finn', seconds: 1200 },
			{ id: 'b1', name: 'Gijs', seconds: 1200 }
		] as never
	};

	function rijVan(naam: string) {
		return [...document.querySelectorAll('.bankoverzicht tr')].find((tr) =>
			tr.querySelector('td')?.textContent?.trim().startsWith(naam)
		);
	}

	it('zegt het als er nog niets te tellen is', () => {
		metWedstrijd();
		render(Opstelling);
		expect(document.querySelector('.bankoverzicht')?.textContent).toContain('Nog geen bewaarde wedstrijden');
	});

	it('zegt het als iemand die vorige keer op de bank begon er nu weer op staat', () => {
		metWedstrijd();
		app.toestand.archive = [VORIGE];
		app.toestand.trainings = [{ id: 't1', date: '2026-09-18', status: { b1: 'present', a1: 'absent' } }];
		render(Opstelling);
		const gijs = rijVan('Gijs')?.textContent ?? '';
		expect(gijs).toContain('1 van de 1 keer begonnen op de bank');
		expect(gijs).toContain('nu wéér op de bank');
		expect(gijs).toContain('20 min bank');
		expect(gijs).toContain('training 1/1');
		expect(rijVan('Finn')?.textContent).toContain('1× in de basis');
		expect(rijVan('Finn')?.textContent).toContain('training 0/1');
	});

	it('laat wie vandaag is afgemeld weg', () => {
		metWedstrijd({ absent: ['b1'], bench: [] });
		app.toestand.archive = [VORIGE];
		render(Opstelling);
		expect(rijVan('Gijs')).toBeUndefined();
		expect(rijVan('Finn')).toBeTruthy();
	});

	it('staat ook onder de standaardopstelling', () => {
		metSelectie();
		app.toestand.archive = [VORIGE];
		page.params = { bron: 'standaard' };
		render(Opstelling);
		expect(rijVan('Gijs')?.textContent).toContain('20 min bank');
	});
});
