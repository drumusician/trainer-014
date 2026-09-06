import { beforeEach, describe, expect, it, vi } from 'vitest';
import { tick } from 'svelte';
import { render, screen } from '@testing-library/svelte';
import Wedstrijd from './+page.svelte';
import { app } from '$lib/store.svelte';
import { emptyState } from '$lib/domain/types';
import { lopendeWedstrijd, metSelectie, metWedstrijd } from '../../../test/wedstrijd';
import { gegaanNaar } from '../../../test/sveltekit/navigation';
import { sync } from '$lib/supabase/sync.svelte';

/*
 * Het wedstrijdscherm is het enige scherm dat langs de lijn in de hand wordt
 * gehouden, en het was tot nu toe het enige scherm zonder één test. De drie
 * fouten die op 6 september ongezien live gingen zaten alle drie hier: Engelse
 * woorden in Nederlandse zinnen, een klok die NaN toonde op echte opgeslagen
 * gegevens, en een wissel die geen gebeurtenis wegschreef.
 */

beforeEach(() => {
	localStorage.clear();
	gegaanNaar.length = 0;
	sync.sessie = null;
	app.whoIsKeeping = null;
	app.toestand = emptyState();
	app.chosenPosition = null;
});

describe('het wedstrijdscherm zonder wedstrijd', () => {
	it('stuurt je naar de selectie als er nog geen spelers zijn', () => {
		render(Wedstrijd);
		expect(screen.getByText('Nog geen spelers')).toBeTruthy();
	});

	it('zegt dat er nog geen wedstrijd is als de selectie er wel is', () => {
		metSelectie();
		render(Wedstrijd);
		expect(screen.getByText('Nog geen wedstrijd')).toBeTruthy();
	});

	it('wijst naar het overzicht als de wedstrijd al afgelopen is', () => {
		lopendeWedstrijd();
		app.toestand.match!.finished = true;
		render(Wedstrijd);
		expect(screen.getByText('Wedstrijd afgelopen')).toBeTruthy();
	});
});

describe('het wedstrijdscherm tijdens een wedstrijd', () => {
	it('zet het veld en de bank neer', () => {
		lopendeWedstrijd();
		render(Wedstrijd);
		expect(screen.getByText('Bram')).toBeTruthy();
		expect(screen.getByText('Gijs')).toBeTruthy();
		expect(screen.getByText('Bank')).toBeTruthy();
	});

	/* De klok toonde ooit NaN:NaN omdat een opgeslagen veld hernoemd was. Alle
	   191 tests bleven groen; alleen het scherm zelf liet het zien. */
	it('toont een leesbare klok, geen NaN', () => {
		lopendeWedstrijd(125);
		const { container } = render(Wedstrijd);
		const klok = container.querySelector('.klok')?.textContent ?? '';
		expect(klok).toMatch(/^\d{2,3}:\d{2}$/);
		expect(klok).toBe('02:05');
	});

	it('noemt de knop Stop zolang de klok loopt', () => {
		lopendeWedstrijd();
		render(Wedstrijd);
		expect(screen.getByRole('button', { name: 'Stop' })).toBeTruthy();
	});

	/*
	 * De klokknop en de deelknop staan naast elkaar. Toen de klokknop nog 'Pauze'
	 * heette, stond er in het eerste kwart twee keer 'Pauze': de een zette de klok
	 * stil, de ander beëindigde het kwart. Deze test is hoe dat aan het licht kwam.
	 */
	it('geeft de klokknop en de deelknop verschillende namen', () => {
		lopendeWedstrijd();
		render(Wedstrijd);
		const namen = [...document.querySelectorAll('.klokbalk button')].map((k) => k.textContent?.trim());
		expect(new Set(namen).size).toBe(namen.length);
	});

	it('noemt de knop Start als de klok stilstaat', () => {
		lopendeWedstrijd();
		app.toestand.match!.running = false;
		app.toestand.match!.elapsed = 60;
		render(Wedstrijd);
		expect(screen.getByRole('button', { name: 'Start' })).toBeTruthy();
	});

	/*
	 * Een wissel: eerst de plek aantikken, dan de speler op de bank. Er moet een
	 * gebeurtenis staan, anders klopt de speeltijd van iedereen na afloop niet —
	 * die wordt teruggerekend uit deze rij.
	 */
	it('schrijft een wissel weg als je een plek en dan een bankspeler aantikt', async () => {
		lopendeWedstrijd(600);
		render(Wedstrijd);

		screen.getByRole('button', { name: /Finn/ }).click();
		expect(app.chosenPosition).toBe('SP');

		screen.getByRole('button', { name: /Gijs/ }).click();

		const w = app.toestand.match!;
		expect(w.lineup.SP).toBe('b1');
		expect(w.bench).toContain('a1');
		const laatste = w.events.at(-1)!;
		expect(laatste.type).toBe('substitution');
		expect(laatste).toMatchObject({ off: 'a1', on: 'b1', position: 'SP' });
	});

	/*
	 * Twee plekken achter elkaar is geen wissel maar een ruil. Dat onderscheid
	 * was er eerst niet, waardoor een misgetikte ruil niet ongedaan te maken was.
	 */
	it('ruilt twee plekken als je ze allebei aantikt', () => {
		lopendeWedstrijd(600);
		render(Wedstrijd);

		screen.getByRole('button', { name: /Bram/ }).click();
		screen.getByRole('button', { name: /Finn/ }).click();

		const w = app.toestand.match!;
		expect(w.lineup.K).toBe('a1');
		expect(w.lineup.SP).toBe('k1');
		expect(w.events.at(-1)!.type).toBe('swap');
		expect(app.chosenPosition).toBeNull();
	});

	it('laat de plek weer los als je hem nog eens aantikt', () => {
		lopendeWedstrijd();
		render(Wedstrijd);
		const knop = screen.getByRole('button', { name: /Cas/ });
		knop.click();
		expect(app.chosenPosition).toBe('LV');
		knop.click();
		expect(app.chosenPosition).toBeNull();
	});

	/* Doelpunt: eerst de knop, dan de maker op het veld. */
	it('boekt een doelpunt op de speler die je aantikt', () => {
		lopendeWedstrijd(900);
		render(Wedstrijd);

		screen.getByRole('button', { name: 'Doelpunt' }).click();
		screen.getByRole('button', { name: /Finn/ }).click();

		const doelpunt = app.toestand.match!.events.at(-1)!;
		expect(doelpunt.type).toBe('goal');
		expect(doelpunt.player).toBe('a1');
	});

	it('boekt een tegendoelpunt zonder speler', () => {
		lopendeWedstrijd(900);
		render(Wedstrijd);
		screen.getByRole('button', { name: 'Tegen' }).click();
		expect(app.toestand.match!.events.at(-1)!.type).toBe('conceded');
	});

	it('toont Nederlands, geen Engelse resten van de hernoeming', () => {
		lopendeWedstrijd(300);
		const { container } = render(Wedstrijd);
		const tekst = container.textContent ?? '';
		for (const woord of ['substitution', 'goal', 'conceded', 'bench', 'lineup', 'match', 'undefined', 'NaN']) {
			expect(tekst).not.toContain(woord);
		}
	});

	/*
	 * Wie gaf de assist? Die vraag komt vanzelf na een doelpunt, en je mag hem
	 * overslaan — langs de lijn gaat het spel gewoon door.
	 */
	it('vraagt na een doelpunt om de assist', async () => {
		lopendeWedstrijd(900);
		render(Wedstrijd);
		screen.getByRole('button', { name: 'Doelpunt' }).click();
		await tick();
		screen.getByRole('button', { name: /Finn/ }).click();
		await tick();
		expect(document.querySelector('.melding')?.textContent).toContain('Finn');

		screen.getByRole('button', { name: /Cas/ }).click();
		await tick();
		expect(app.toestand.match!.events.at(-1)!.assist).toBe('v1');
	});

	it('laat je de assist overslaan', async () => {
		lopendeWedstrijd(900);
		render(Wedstrijd);
		screen.getByRole('button', { name: 'Doelpunt' }).click();
		await tick();
		screen.getByRole('button', { name: /Finn/ }).click();
		await tick();
		screen.getByRole('button', { name: 'Geen assist' }).click();
		await tick();
		expect(app.toestand.match!.events.at(-1)!.assist).toBeUndefined();
	});

	it('boekt een doelpunt waarvan je de maker niet zag', async () => {
		lopendeWedstrijd(900);
		render(Wedstrijd);
		screen.getByRole('button', { name: 'Doelpunt' }).click();
		await tick();
		screen.getByRole('button', { name: 'Weet ik niet' }).click();
		await tick();
		const laatste = app.toestand.match!.events.at(-1)!;
		expect(laatste.type).toBe('goal');
		expect(laatste.player).toBeFalsy();
	});

	/*
	 * De andere volgorde: eerst de speler aantikken, dan pas wat hij deed. Aan de
	 * lijn gaat je hand eerst naar het kind, en dat mag geen wissel worden.
	 */
	it('laat je vanuit een gekozen speler alsnog een doelpunt boeken', async () => {
		lopendeWedstrijd(900);
		render(Wedstrijd);
		screen.getByRole('button', { name: /Finn/ }).click();
		await tick();
		screen.getByRole('button', { name: 'Finn scoorde' }).click();
		await tick();
		expect(app.toestand.match!.events.at(-1)!.type).toBe('goal');
		expect(app.chosenPosition).toBeNull();
	});

	/* Een misgetikte wissel of ruil moet met één tik terug. */
	it('maakt de laatste wissel ongedaan', async () => {
		lopendeWedstrijd(600);
		render(Wedstrijd);
		screen.getByRole('button', { name: /Finn/ }).click();
		screen.getByRole('button', { name: /Gijs/ }).click();
		await tick();
		expect(app.toestand.match!.lineup.SP).toBe('b1');

		screen.getByRole('button', { name: /terug/ }).click();
		await tick();
		expect(app.toestand.match!.lineup.SP).toBe('a1');
		expect(app.toestand.match!.events.at(-1)!.type).toBe('start');
	});

	it('biedt niets om terug te draaien als er nog niets gebeurd is', () => {
		lopendeWedstrijd(60);
		render(Wedstrijd);
		expect(screen.queryByRole('button', { name: /terug/ })).toBeNull();
	});

	/* 'Wie is er?' hoort alleen vóór de aftrap in de knoprij; daarna zou het een
	   mistik zijn tijdens het coachen. */
	it('verbergt Wie is er? zodra er afgetrapt is', () => {
		lopendeWedstrijd(600);
		render(Wedstrijd);
		/* het veld staat er wel, de knop niet meer */
		expect(screen.getByText('Bram')).toBeTruthy();
		expect(screen.queryByRole('link', { name: 'Wie is er?' })).toBeNull();
	});

	it('toont Wie is er? zolang de klok stilstaat', () => {
		metWedstrijd({ running: false });
		render(Wedstrijd);
		expect(screen.getByRole('link', { name: 'Wie is er?' }).getAttribute('href')).toBe('/app/aanwezig');
	});

	/* De klok bijstellen zit verstopt tot je erom vraagt: het is bijna nooit nodig. */
	it('houdt het bijstellen van de klok verborgen tot je erop tikt', async () => {
		lopendeWedstrijd(300);
		render(Wedstrijd);
		expect(document.querySelector('.klokzetrij')).toBeNull();
		(document.querySelector('.kloktik') as HTMLButtonElement).click();
		await tick();
		expect(document.querySelector('.klokzetrij')).toBeTruthy();
	});

	it('schuift de klok een minuut op of terug', async () => {
		lopendeWedstrijd(300);
		render(Wedstrijd);
		(document.querySelector('.kloktik') as HTMLButtonElement).click();
		await tick();
		screen.getByRole('button', { name: '+1′' }).click();
		await tick();
		expect(document.querySelector('.klok')?.textContent).toBe('06:00');
		screen.getByRole('button', { name: '−1′' }).click();
		await tick();
		expect(document.querySelector('.klok')?.textContent).toBe('05:00');
	});

	it('zet de klok op een hele minuut', async () => {
		lopendeWedstrijd(300);
		render(Wedstrijd);
		(document.querySelector('.kloktik') as HTMLButtonElement).click();
		await tick();
		const vak = document.querySelector('.klokzet input') as HTMLInputElement;
		vak.value = '22';
		vak.dispatchEvent(new Event('change', { bubbles: true }));
		await tick();
		expect(document.querySelector('.klok')?.textContent).toBe('22:00');
	});

	it('start en stopt de klok', async () => {
		metWedstrijd();
		render(Wedstrijd);
		screen.getByRole('button', { name: 'Start' }).click();
		await tick();
		expect(app.toestand.match!.running).toBe(true);
		expect(app.toestand.match!.events[0].type).toBe('start');

		screen.getByRole('button', { name: 'Stop' }).click();
		await tick();
		expect(app.toestand.match!.running).toBe(false);
	});

	/* Naar het volgende deel en terug: bij vier kwarten drie keer per wedstrijd. */
	it('gaat naar de pauze en het volgende kwart', async () => {
		lopendeWedstrijd(900);
		render(Wedstrijd);
		screen.getByRole('button', { name: 'Pauze' }).click();
		await tick();
		expect(app.toestand.match!.inBreak).toBe(true);

		screen.getByRole('button', { name: '2e kwart' }).click();
		await tick();
		expect(app.toestand.match!.part).toBe(2);
		expect(app.toestand.match!.inBreak).toBe(false);
	});

	it('sluit de wedstrijd af na bevestiging', async () => {
		lopendeWedstrijd(2400);
		vi.stubGlobal('confirm', () => true);
		render(Wedstrijd);
		screen.getByRole('button', { name: 'Wedstrijd afsluiten' }).click();
		await tick();
		expect(app.toestand.match!.finished).toBe(true);
		expect(gegaanNaar).toContain('/app/afloop');
	});

	it('sluit niets af als je afbreekt', async () => {
		lopendeWedstrijd(2400);
		vi.stubGlobal('confirm', () => false);
		render(Wedstrijd);
		screen.getByRole('button', { name: 'Wedstrijd afsluiten' }).click();
		await tick();
		expect(app.toestand.match!.finished).toBe(false);
	});

	/*
	 * Wie houdt deze wedstrijd bij.
	 *
	 * Sinds er twee trainers bij een team kunnen, kunnen er ook twee tegelijk gaan
	 * tikken. Dan duwen twee toestellen om beurten hun eigen versie naar de server
	 * en raakt de helft van de wissels zoek. De app lost dat niet op — dat kan hij
	 * ook niet — maar hij laat het wel zien voordat het misgaat.
	 */
	it('legt bij de aftrap vast wie er tikt', async () => {
		metWedstrijd();
		app.whoIsKeeping = 'tjaco@voorbeeld.nl';
		render(Wedstrijd);
		screen.getByRole('button', { name: 'Start' }).click();
		await tick();
		expect(app.toestand.match!.keptBy).toBe('tjaco@voorbeeld.nl');
	});

	it('laat het leeg als je niet ingelogd bent', async () => {
		metWedstrijd();
		render(Wedstrijd);
		screen.getByRole('button', { name: 'Start' }).click();
		await tick();
		expect(app.toestand.match!.keptBy).toBeUndefined();
	});

	/* Wie begonnen is maakt hem af: bij een pauze en een herstart verandert het niet. */
	it('wisselt onderweg niet van eigenaar', async () => {
		metWedstrijd();
		app.whoIsKeeping = 'tjaco@voorbeeld.nl';
		render(Wedstrijd);
		screen.getByRole('button', { name: 'Start' }).click();
		await tick();
		app.whoIsKeeping = 'matthijs@voorbeeld.nl';
		screen.getByRole('button', { name: 'Stop' }).click();
		await tick();
		screen.getByRole('button', { name: 'Start' }).click();
		await tick();
		expect(app.toestand.match!.keptBy).toBe('tjaco@voorbeeld.nl');
	});

	it('waarschuwt als een ander deze wedstrijd al bijhoudt', () => {
		lopendeWedstrijd(600, { keptBy: 'tjaco@voorbeeld.nl' });
		sync.sessie = { access_token: 'x', refresh_token: 'y', email: 'matthijs@voorbeeld.nl' } as never;
		render(Wedstrijd);
		const melding = document.querySelector('.waarschuwing')?.textContent ?? '';
		expect(melding).toContain('tjaco@voorbeeld.nl');
		expect(melding).toContain('wissels zoek');
	});

	it('waarschuwt jezelf niet', () => {
		lopendeWedstrijd(600, { keptBy: 'tjaco@voorbeeld.nl' });
		sync.sessie = { access_token: 'x', refresh_token: 'y', email: 'tjaco@voorbeeld.nl' } as never;
		render(Wedstrijd);
		expect(document.querySelector('.waarschuwing')).toBeNull();
	});

	it('zwijgt als je niet ingelogd bent en dus niets kunt weten', () => {
		lopendeWedstrijd(600, { keptBy: 'tjaco@voorbeeld.nl' });
		render(Wedstrijd);
		expect(document.querySelector('.waarschuwing')).toBeNull();
	});
});
