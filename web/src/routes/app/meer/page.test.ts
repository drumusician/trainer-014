import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import Meer from './+page.svelte';
import { app } from '$lib/store.svelte';
import { emptyState } from '$lib/domain/types';
import { makeTransferCode } from '$lib/domain/transfer';
import { issues, reportIssue } from '$lib/issues.svelte';
import { metSelectie } from '../../../test/wedstrijd';
import { sync } from '$lib/supabase/sync.svelte';

/*
 * Het gegevensscherm. Alles wat de app in en uit gaat loopt hier langs: inloggen
 * om te synchroniseren, een backup naar een bestand, een code om over te zetten
 * naar een ander toestel, en de lijst met problemen. Dit is het scherm waar een
 * fout gegevens kost in plaats van een verkeerde weergave.
 */
beforeEach(() => {
	localStorage.clear();
	app.toestand = emptyState();
	issues.lijst = [];
	sync.sessie = null;
	sync.fase = 'email';
	sync.vies = false;
	sync.hapert = false;
	sync.botsing = false;
	sync.message = '';
	vi.restoreAllMocks();
	vi.stubGlobal('alert', () => {});
	vi.stubGlobal('confirm', () => true);
});

describe('het gegevensscherm', () => {
	it('vraagt eerst om een e-mailadres', () => {
		render(Meer);
		expect(document.querySelector('input[type=email]')).toBeTruthy();
		expect(screen.getByRole('button', { name: 'Stuur inlog' })).toBeTruthy();
	});

	/* Zolang je niet ingelogd bent staat er dat de gegevens alleen hier staan. */
	it('waarschuwt dat de gegevens alleen op dit toestel staan', () => {
		render(Meer);
		expect(document.querySelector('.mager')).toBeTruthy();
	});

	it('maakt een overzetcode van wat er nu is', async () => {
		metSelectie();
		render(Meer);
		screen.getByRole('button', { name: 'Code maken' }).click();
		await tick();
		const vak = document.querySelector('textarea') as HTMLTextAreaElement;
		expect(vak.value.length).toBeGreaterThan(20);
	});

	/*
	 * Een code van een ander toestel overnemen vervangt alles. Dat is de meest
	 * ingrijpende knop van de app, en hij hoort te doen wat hij zegt.
	 */
	it('neemt een code van een ander toestel over', async () => {
		const ander = emptyState();
		ander.teamName = 'JO12-1';
		ander.players = [{ id: 'x', name: 'Zoe', line: 'M' }];
		const code = makeTransferCode(ander);

		render(Meer);
		screen.getByRole('button', { name: 'Invoeren' }).click();
		await tick();
		const vak = document.querySelector('textarea') as HTMLTextAreaElement;
		vak.value = code;
		vak.dispatchEvent(new Event('input', { bubbles: true }));
		await tick();
		screen.getByRole('button', { name: 'Overnemen' }).click();
		await tick();
		expect(app.toestand.teamName).toBe('JO12-1');
		expect(app.toestand.players.map((p) => p.name)).toEqual(['Zoe']);
	});

	it('laat een onleesbare code de bestaande gegevens niet aantasten', async () => {
		metSelectie();
		render(Meer);
		screen.getByRole('button', { name: 'Invoeren' }).click();
		await tick();
		const vak = document.querySelector('textarea') as HTMLTextAreaElement;
		vak.value = 'dit is geen code';
		vak.dispatchEvent(new Event('input', { bubbles: true }));
		await tick();
		screen.getByRole('button', { name: 'Overnemen' }).click();
		await tick();
		expect(app.toestand.teamName).toBe('O14-3');
		expect(app.toestand.players).toHaveLength(6);
	});

	/*
	 * De problemenlijst is wat de app zelf heeft opgemerkt. Hij hoort er alleen te
	 * staan als er echt iets is, anders leest niemand hem als het ertoe doet.
	 */
	it('houdt de problemenlijst weg zolang er niets is', () => {
		render(Meer);
		expect(screen.queryByRole('button', { name: 'Lijst wissen' })).toBeNull();
	});

	it('toont een gemeld probleem en laat je de lijst wissen', async () => {
		reportIssue('De opgeslagen gegevens hadden een vorm die deze versie niet kent.');
		render(Meer);
		expect(document.querySelector('.problemen')?.textContent).toContain('vorm die deze versie niet kent');
		screen.getByRole('button', { name: 'Lijst wissen' }).click();
		await tick();
		expect(issues.lijst).toHaveLength(0);
	});

	it('toont Nederlands, geen Engelse resten van de hernoeming', () => {
		metSelectie();
		render(Meer);
		const tekst = document.body.textContent ?? '';
		for (const woord of ['undefined', 'NaN', 'backup file', 'sign in']) {
			expect(tekst).not.toContain(woord);
		}
	});

	it('vraagt om de code nadat de mail verstuurd is', () => {
		sync.fase = 'code';
		render(Meer);
		expect(document.querySelector('input[autocomplete=one-time-code]')).toBeTruthy();
		expect(screen.getByRole('button', { name: 'Inloggen' })).toBeTruthy();
	});

	it('laat je terug naar een ander adres', async () => {
		sync.fase = 'code';
		render(Meer);
		screen.getByRole('button', { name: 'Ander adres' }).click();
		await tick();
		expect(sync.fase).toBe('email');
	});
});

/*
 * Ingelogd. Wat hier staat is het enige wat een trainer te zien krijgt over of
 * zijn gegevens veilig op de server staan, dus elke stand moet in gewone taal
 * kloppen: nog niet opgestuurd, geen verbinding, of iets nieuwers aan de andere
 * kant.
 */
describe('het gegevensscherm als je ingelogd bent', () => {
	beforeEach(() => {
		sync.sessie = { access_token: 'x', refresh_token: 'y', email: 'trainer@example.com' } as never;
	});

	it('zegt met welk adres je ingelogd bent', () => {
		render(Meer);
		expect(document.body.textContent).toContain('trainer@example.com');
		expect(screen.getByRole('button', { name: 'Uitloggen' })).toBeTruthy();
	});

	it('zegt dat er nog niets uitgewisseld is', () => {
		render(Meer);
		expect(document.body.textContent).toContain('Nog niets uitgewisseld');
	});

	it('zegt wanneer het voor het laatst gelukt is', () => {
		sync.sessie!.laatst = new Date('2026-09-06T14:30:00').toISOString();
		render(Meer);
		expect(document.body.textContent).toContain('Bijgewerkt');
	});

	it('zegt dat er nog iets klaarstaat', () => {
		sync.vies = true;
		render(Meer);
		expect(document.body.textContent).toContain('Nog niet opgestuurd.');
	});

	/* Hetzelfde wachten, maar met een andere oorzaak: geen verbinding. Dat is de
	   stand waarin je niets hoeft te doen behalve wachten tot je weer bereik hebt. */
	it('onderscheidt wachten van geen verbinding', () => {
		sync.vies = true;
		sync.hapert = true;
		render(Meer);
		expect(document.body.textContent).toContain('geen verbinding');
	});

	it('meldt dat er iets nieuwers op de server staat', () => {
		sync.botsing = true;
		render(Meer);
		expect(document.body.textContent).toContain('nieuwers op de server');
	});

	/* De uitweg uit een botsing: dit toestel wint. Die knop hoort er alleen te
	   staan als er ook echt een botsing is, want hij overschrijft het werk van de
	   ander. */
	it('biedt het overrulen alleen aan bij een botsing', () => {
		const zonder = render(Meer);
		expect(zonder.queryByRole('button', { name: 'Toch dit toestel opsturen' })).toBeNull();
		zonder.unmount();

		sync.botsing = true;
		render(Meer);
		expect(screen.getByRole('button', { name: 'Toch dit toestel opsturen' })).toBeTruthy();
	});

	it('logt je uit', async () => {
		render(Meer);
		screen.getByRole('button', { name: 'Uitloggen' }).click();
		await tick();
		expect(sync.sessie).toBeNull();
	});

	it('toont Nederlands, geen Engelse resten van de hernoeming', () => {
		metSelectie();
		sync.sessie = { access_token: 'x', refresh_token: 'y', email: 'trainer@example.com' } as never;
		render(Meer);
		const tekst = document.body.textContent ?? '';
		for (const woord of ['undefined', 'NaN', 'sign in', 'sync']) {
			expect(tekst).not.toContain(woord);
		}
	});
});
