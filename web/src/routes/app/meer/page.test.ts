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
	sync.mijnTeams = [];
	sync.leden = [];
	sync.openstaand = [];
	sync.uitgenodigdVoor = [];
	globalThis.fetch = vi.fn(async () => new Response('[]', { status: 200 })) as unknown as typeof fetch;
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

	/*
	 * Doorsturen naar Tjaco. De belofte is niet 'wij sturen niets' maar 'er gaat
	 * niets weg tenzij jij het stuurt, en dan zonder namen'. Beide helften horen
	 * hier zichtbaar te zijn: de trainer ziet de tekst voordat hij hem verstuurt,
	 * en er staat geen naam in.
	 */
	it('zet het logboekje pas klaar als je erom vraagt', async () => {
		reportIssue('Opslaan lukte niet.', new Error('QuotaExceededError'));
		render(Meer);
		expect(document.querySelectorAll('textarea')).toHaveLength(0);

		screen.getByRole('button', { name: 'Stuur dit naar Tjaco' }).click();
		await tick();
		const vak = document.querySelector('textarea') as HTMLTextAreaElement;
		expect(vak.value).toContain('QuotaExceededError');
	});

	it('haalt de namen eruit voordat je iets kunt versturen', async () => {
		metSelectie();
		reportIssue('Opslaan lukte niet voor Bram van O14-3.');
		render(Meer);
		screen.getByRole('button', { name: 'Stuur dit naar Tjaco' }).click();
		await tick();
		const vak = document.querySelector('textarea') as HTMLTextAreaElement;
		expect(vak.value).not.toContain('Bram');
		expect(vak.value).not.toContain('O14-3');
		expect(vak.value).toContain('[naam]');
	});

	/* De mailknop verstuurt niets: hij opent het mailprogramma van de trainer,
	   met de tekst erin. Versturen doet hij zelf. */
	it('opent de mail met de tekst erin, en verstuurt zelf niets', async () => {
		reportIssue('Opslaan lukte niet.');
		render(Meer);
		screen.getByRole('button', { name: 'Stuur dit naar Tjaco' }).click();
		await tick();
		const link = screen.getByRole('link', { name: 'Openen in mail' }).getAttribute('href') ?? '';
		expect(link.startsWith('mailto:tjaco@blaadje.app')).toBe(true);
		expect(decodeURIComponent(link)).toContain('Opslaan lukte niet.');
	});

	it('laat je het weer wegklappen', async () => {
		reportIssue('Opslaan lukte niet.');
		render(Meer);
		screen.getByRole('button', { name: 'Stuur dit naar Tjaco' }).click();
		await tick();
		screen.getByRole('button', { name: 'Sluiten' }).click();
		await tick();
		expect(document.querySelectorAll('textarea')).toHaveLength(0);
	});

	it('toont een gemeld probleem en laat je de lijst wissen', async () => {
		reportIssue('De opgeslagen gegevens hadden een vorm die deze versie niet kent.');
		render(Meer);
		expect(document.querySelector('.problemen')?.textContent).toContain('vorm die deze versie niet kent');
		screen.getByRole('button', { name: 'Lijst wissen' }).click();
		await tick();
		expect(issues.lijst).toHaveLength(0);
	});

	/*
	 * Welke bouw draait dit toestel? Zonder dat te kunnen zien is elke proef met
	 * twee toestellen onbetrouwbaar: een tabblad dat sinds gisteren openstaat doet
	 * nog precies wat het deed, en dat zie je nergens aan.
	 */
	it('zet onderaan welke versie er draait', () => {
		render(Meer);
		expect(document.body.textContent).toContain('Blaadje test');
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

	/*
	 * Wie kan hierbij. Alleen de eigenaar kan hier iemand toelaten of eruit halen —
	 * de database weigert het anders toch, maar een knop die je niet mag indrukken
	 * hoort er niet te staan.
	 */
	it('laat de eigenaar de ploeg zien en iemand uitnodigen', async () => {
		sync.sessie!.user_id = 'u1';
		sync.sessie!.teamId = 'team-1';
		sync.leden = [
			{ gebruiker: 'u1', rol: 'eigenaar', email: 'tjaco@voorbeeld.nl' },
			{ gebruiker: 'u2', rol: 'trainer', email: 'matthijs@voorbeeld.nl' }
		];
		render(Meer);
		await tick();
		expect(document.body.textContent).toContain('Wie kan hierbij');
		expect(screen.getByRole('button', { name: 'Uitnodigen' })).toBeTruthy();
		expect(screen.getByRole('button', { name: 'Eruit halen' })).toBeTruthy();
	});

	it('geeft een tweede trainer geen knoppen die hij toch niet mag indrukken', async () => {
		sync.sessie!.user_id = 'u2';
		sync.sessie!.teamId = 'team-1';
		sync.leden = [
			{ gebruiker: 'u1', rol: 'eigenaar' },
			{ gebruiker: 'u2', rol: 'trainer' }
		];
		render(Meer);
		await tick();
		expect(document.body.textContent).toContain('Alleen de eigenaar');
		expect(screen.queryByRole('button', { name: 'Uitnodigen' })).toBeNull();
		expect(screen.queryByRole('button', { name: 'Eruit halen' })).toBeNull();
	});

	it('zet de eigenaar niet zichzelf eruit', async () => {
		sync.sessie!.user_id = 'u1';
		sync.sessie!.teamId = 'team-1';
		sync.leden = [{ gebruiker: 'u1', rol: 'eigenaar' }];
		render(Meer);
		await tick();
		expect(screen.queryByRole('button', { name: 'Eruit halen' })).toBeNull();
	});

	it('toont een uitnodiging die nog niet aangenomen is', async () => {
		sync.sessie!.user_id = 'u1';
		sync.sessie!.teamId = 'team-1';
		sync.leden = [{ gebruiker: 'u1', rol: 'eigenaar' }];
		sync.openstaand = [{ id: 'i1', email: 'matthijs@voorbeeld.nl' }];
		render(Meer);
		await tick();
		expect(document.body.textContent).toContain('matthijs@voorbeeld.nl');
		expect(screen.getByRole('button', { name: 'Intrekken' })).toBeTruthy();
	});

	/*
	 * Blaadje verstuurt zelf geen mail; daar zou een server voor nodig zijn. De
	 * uitgenodigde ziet zijn uitnodiging pas als hij inlogt, dus iemand moet het
	 * hem zeggen — en dan liever met een uitleg die klopt dan met 'ik heb je
	 * toegevoegd, zoek maar uit'.
	 */
	it('zet een mail klaar met de uitleg erin', async () => {
		metSelectie();
		sync.sessie!.user_id = 'u1';
		sync.sessie!.teamId = 'team-1';
		sync.leden = [{ gebruiker: 'u1', rol: 'eigenaar' }];
		sync.openstaand = [{ id: 'i1', email: 'matthijs@voorbeeld.nl' }];
		render(Meer);
		await tick();

		const link = screen.getByRole('link', { name: 'Laat het hem weten' }).getAttribute('href') ?? '';
		expect(link.startsWith('mailto:matthijs@voorbeeld.nl')).toBe(true);
		const tekst = decodeURIComponent(link);
		expect(tekst).toContain('O14-3');
		expect(tekst).toContain('blaadje.app');
		expect(tekst).toContain('matthijs@voorbeeld.nl');
		expect(tekst).toContain('Aannemen');
	});

	it('vraagt of je een uitnodiging aanneemt, met de naam van het team erbij', async () => {
		sync.sessie!.teamId = 'team-1';
		sync.uitgenodigdVoor = [{ id: 'team-9', naam: 'JO15-2' }];
		render(Meer);
		await tick();
		expect(document.body.textContent).toContain('JO15-2');
		expect(screen.getByRole('button', { name: 'Aannemen' })).toBeTruthy();
	});

	/* Bij meer dan één team kiest de trainer; de app gokt niet. */
	it('laat je kiezen welk team dit toestel volgt', async () => {
		sync.sessie!.teamId = undefined;
		sync.mijnTeams = [
			{ id: 'team-1', naam: 'JO13-1' },
			{ id: 'team-9', naam: 'JO15-2' }
		];
		render(Meer);
		await tick();
		expect(screen.getByRole('button', { name: 'Overstappen naar JO13-1' })).toBeTruthy();
		expect(screen.getByRole('button', { name: 'Overstappen naar JO15-2' })).toBeTruthy();
	});

	/*
	 * De lijst blijft staan nadat je gekozen hebt. Hij verdween eerst, en dat maakte
	 * er een eenrichtingsdeur van: wie twee teams heeft koos er ooit een en kwam
	 * nooit meer bij het andere.
	 */
	it('blijft laten zien welk team aanstaat', async () => {
		sync.sessie!.teamId = 'team-1';
		sync.mijnTeams = [
			{ id: 'team-1', naam: 'JO13-1' },
			{ id: 'team-9', naam: 'JO15-2' }
		];
		render(Meer);
		await tick();
		const aan = screen.getByRole('button', { name: 'JO13-1 · staat aan' }) as HTMLButtonElement;
		expect(aan.disabled).toBe(true);
		expect(screen.getByRole('button', { name: 'Overstappen naar JO15-2' })).toBeTruthy();
	});

	it('vraagt om een bevestiging voordat je overstapt', async () => {
		sync.sessie!.teamId = 'team-1';
		sync.mijnTeams = [
			{ id: 'team-1', naam: 'JO13-1' },
			{ id: 'team-9', naam: 'JO15-2' }
		];
		vi.stubGlobal('confirm', () => false);
		render(Meer);
		await tick();
		screen.getByRole('button', { name: 'Overstappen naar JO15-2' }).click();
		await tick();
		expect(sync.sessie!.teamId).toBe('team-1');
	});

	/*
	 * 'eigenaar' en 'trainer' zonder naam beantwoordt niet de vraag die je stelt
	 * als je hier kijkt: wie kan er allemaal bij mijn team?
	 */
	it('zet bij elk lid het adres, met de rol erachter', async () => {
		sync.sessie!.user_id = 'u1';
		sync.sessie!.teamId = 'team-1';
		sync.leden = [
			{ gebruiker: 'u1', rol: 'eigenaar', email: 'tjaco@voorbeeld.nl' },
			{ gebruiker: 'u2', rol: 'trainer', email: 'matthijs@voorbeeld.nl' }
		];
		render(Meer);
		await tick();
		const regels = [...document.querySelectorAll('.sregel')].map((r) => r.textContent ?? '');
		expect(regels[0]).toContain('tjaco@voorbeeld.nl');
		expect(regels[0]).toContain('eigenaar');
		expect(regels[0]).toContain('jij');
		expect(regels[1]).toContain('matthijs@voorbeeld.nl');
		expect(regels[1]).toContain('trainer');
		expect(regels[1]).not.toContain('jij');
	});

	/* Een lid van vóór deze verandering heeft nog geen adres bij zijn regel. */
	it('valt terug op iets leesbaars als het adres ontbreekt', async () => {
		sync.sessie!.user_id = 'u1';
		sync.sessie!.teamId = 'team-1';
		sync.leden = [{ gebruiker: 'u1', rol: 'eigenaar' }];
		render(Meer);
		await tick();
		expect(document.querySelector('.sregel')?.textContent).toContain('adres onbekend');
	});

	/*
	 * Wie is uitgenodigd voor het team van een ander moet ook zijn eigen ploeg
	 * kunnen beginnen. Zonder die knop is meekijken een val: je komt er nooit meer
	 * uit met een eigen team.
	 */
	it('laat je een eigen team beginnen, ook als je al bij een team hoort', async () => {
		sync.sessie!.teamId = 'team-1';
		sync.mijnTeams = [{ id: 'team-1', naam: 'JO13-1' }];
		vi.stubGlobal('confirm', () => true);
		vi.stubGlobal('prompt', () => 'JO10-4');
		render(Meer);
		await tick();
		expect(screen.getByRole('button', { name: 'Nieuw team' })).toBeTruthy();
	});

	it('begint niets als je de naam leeg laat', async () => {
		sync.sessie!.teamId = 'team-1';
		sync.mijnTeams = [{ id: 'team-1', naam: 'JO13-1' }];
		vi.stubGlobal('confirm', () => true);
		vi.stubGlobal('prompt', () => '');
		render(Meer);
		await tick();
		screen.getByRole('button', { name: 'Nieuw team' }).click();
		await tick();
		expect(sync.sessie!.teamId).toBe('team-1');
	});

	it('noemt bij één team gewoon welk team dat is', async () => {
		sync.sessie!.teamId = 'team-1';
		sync.mijnTeams = [{ id: 'team-1', naam: 'JO13-1' }];
		render(Meer);
		await tick();
		expect(document.body.textContent).toContain('JO13-1 · staat aan');
		expect(document.body.textContent).not.toContain('Overstappen naar');
	});

	/* Zolang we nog niet weten wie er lid zijn, staat er niets. Anders leest de
	   eigenaar even dat alleen de eigenaar hier iets mag. */
	it('houdt de ploeg verborgen tot hij opgehaald is', async () => {
		sync.sessie!.teamId = 'team-1';
		sync.leden = [];
		render(Meer);
		await tick();
		expect(document.body.textContent).not.toContain('Wie kan hierbij');
		expect(document.body.textContent).not.toContain('Alleen de eigenaar');
	});

	it('vraagt niets als je maar bij één team hoort', async () => {
		sync.sessie!.teamId = 'team-1';
		render(Meer);
		await tick();
		expect(document.body.textContent).not.toContain('Welk team op dit toestel');
	});
});
