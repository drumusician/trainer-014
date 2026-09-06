import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { createRawSnippet, tick } from 'svelte';
import Schil from './+layout.svelte';
import { app } from '$lib/store.svelte';
import { sync } from '$lib/supabase/sync.svelte';
import { issues } from '$lib/issues.svelte';
import { zetKop } from '$lib/header.svelte';
import { emptyState } from '$lib/domain/types';
import { lopendeWedstrijd, metWedstrijd } from '../../test/wedstrijd';
import { page } from '../../test/sveltekit/state.svelte';

/*
 * De schil om de hele app: de kop, de waarschuwingen en de tabbalk. Twee dingen
 * horen hier vast te liggen. De tabbalk verdwijnt op het veld, want daar telt
 * elke pixel — en dat is precies de regel die je niet ziet als hij stukgaat.
 * En de waarschuwingen: die staan er alleen als er echt iets aan de hand is.
 */
const inhoud = createRawSnippet(() => ({ render: () => '<p data-kind="inhoud">inhoud</p>' }));

function toon(pad = '/app') {
	page.url = new URL('http://localhost' + pad);
	return render(Schil, { props: { children: inhoud } });
}

beforeEach(() => {
	localStorage.clear();
	app.toestand = emptyState();
	sync.botsing = false;
	issues.savingFails = false;
	zetKop('Blaadje');
	vi.restoreAllMocks();
});

describe('de schil om de app', () => {
	it('zet de kop en de inhoud neer', () => {
		zetKop('Trainingen');
		toon('/app/trainingen');
		expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Trainingen');
		expect(document.querySelector('[data-kind=inhoud]')).toBeTruthy();
	});

	it('zet de stand in de kop tijdens een wedstrijd', () => {
		zetKop('O14-3 – Kampong', '/app', 'Naar start', '2 – 1', true);
		toon('/app/wedstrijd');
		expect(document.querySelector('.stand')?.textContent).toBe('2 – 1');
	});

	it('houdt de tabbalk zichtbaar op de gewone schermen', () => {
		metWedstrijd();
		toon('/app/team');
		expect(document.querySelector('.tabs')).toBeTruthy();
	});

	/* Op het opstelscherm en tijdens een lopende wedstrijd is het veld belangrijker
	   dan de balk. */
	it('haalt de tabbalk weg op het opstelscherm', () => {
		metWedstrijd();
		toon('/app/opstelling/wedstrijd');
		expect(document.querySelector('.tabs')).toBeNull();
	});

	it('haalt de tabbalk weg zodra er afgetrapt is', () => {
		lopendeWedstrijd();
		toon('/app/wedstrijd');
		expect(document.querySelector('.tabs')).toBeNull();
	});

	it('laat de balk staan op het wedstrijdscherm vóór de aftrap', () => {
		metWedstrijd();
		toon('/app/wedstrijd');
		expect(document.querySelector('.tabs')).toBeTruthy();
	});

	it('laat de balk terugkomen als de wedstrijd afgelopen is', () => {
		lopendeWedstrijd();
		app.toestand.match!.finished = true;
		toon('/app/wedstrijd');
		expect(document.querySelector('.tabs')).toBeTruthy();
	});

	describe('de waarschuwingen', () => {
		it('staan er niet als er niets aan de hand is', () => {
			toon();
			expect(document.querySelector('.waarschuwing')).toBeNull();
		});

		it('melden een botsing met twee uitwegen', () => {
			sync.botsing = true;
			toon();
			expect(document.querySelector('.waarschuwing')).toBeTruthy();
			expect(screen.getAllByRole('button')).toHaveLength(2);
		});

		/* Als opslaan niet lukt is alles wat je nog doet verloren. Dat is zwaarder
		   dan een botsing en krijgt zijn eigen, ernstiger melding. */
		it('melden het zwaarder als opslaan niet meer lukt', () => {
			issues.savingFails = true;
			toon();
			expect(document.querySelector('.waarschuwing.ernstig')).toBeTruthy();
		});
	});

	/*
	 * Eén klok voor de hele app. Zonder deze tik staan alle schermen die tijd
	 * tonen stil, en dat merk je pas langs de lijn.
	 */
	it('tikt de klok door zolang de wedstrijd loopt', async () => {
		vi.useFakeTimers();
		lopendeWedstrijd();
		app.nu = 0;
		toon('/app/wedstrijd');
		vi.advanceTimersByTime(1000);
		await tick();
		expect(app.nu).toBeGreaterThan(0);
		vi.useRealTimers();
	});

	it('laat de klok met rust als er niets loopt', async () => {
		vi.useFakeTimers();
		metWedstrijd();
		app.nu = 0;
		toon('/app');
		vi.advanceTimersByTime(3000);
		await tick();
		expect(app.nu).toBe(0);
		vi.useRealTimers();
	});
});
