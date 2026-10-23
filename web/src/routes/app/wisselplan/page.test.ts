import { beforeEach, describe, expect, it } from 'vitest';
import { tick } from 'svelte';
import { render, screen } from '@testing-library/svelte';
import Plan from './+page.svelte';
import { app } from '$lib/store.svelte';
import { emptyState } from '$lib/domain/types';
import { lopendeWedstrijd, metWedstrijd } from '../../../test/wedstrijd';
import { gegaanNaar } from '../../../test/sveltekit/navigation';

/* Het wisselplan maken: vooraf, of in de rust bijwerken. */
beforeEach(() => {
	localStorage.clear();
	gegaanNaar.length = 0;
	app.toestand = emptyState();
});

const opties = (label: string) =>
	[...(screen.getByLabelText(label) as HTMLSelectElement).options].slice(1).map((o) => o.textContent);

function kies(label: string, waarde: string) {
	const veld = screen.getByLabelText(label) as HTMLSelectElement | HTMLInputElement;
	veld.value = waarde;
	veld.dispatchEvent(new Event(veld instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
}

describe('het wisselplan maken', () => {
	/* De testwedstrijd speelt kwarten van 35 minuten (zie test/wedstrijd.ts). */
	it('biedt de pauzes aan als wisselmoment', () => {
		metWedstrijd();
		render(Plan);
		expect(opties('Wanneer')).toEqual(['Pauze na 1e kwart', 'Rust', 'Pauze na 3e kwart', 'Op een minuut…']);
		expect(screen.queryByLabelText('Minuut')).toBeNull();
	});

	it('zet een wissel met twee tikken in het rooster, en laat de minuten zien', async () => {
		metWedstrijd();
		app.toestand.minutesPerPart = 15;
		render(Plan);
		const k1 = app.playerById('k1')!.name;
		const b1 = app.playerById('b1')!.name;
		screen.getByRole('button', { name: `${k1}, 30′: speelt` }).click();
		await tick();
		screen.getByRole('button', { name: `${b1}, 30′: bank` }).click();
		await tick();
		expect(app.match!.plan).toMatchObject([{ minuut: 30, naDeel: 2, on: 'b1', off: 'k1' }]);
		expect(screen.getByRole('button', { name: `${b1}, 45′: speelt` })).toBeTruthy();
		expect(document.querySelector('table.rooster')!.textContent).toContain('30′');
	});

	it('zet een wissel in de rust', async () => {
		metWedstrijd();
		app.toestand.minutesPerPart = 15;
		render(Plan);
		kies('Wanneer', 'na-2');
		kies('Eruit', 'k1');
		kies('Erin', 'b1');
		await tick();
		screen.getByRole('button', { name: 'Toevoegen' }).click();
		await tick();
		expect(app.match!.plan).toMatchObject([{ minuut: 30, naDeel: 2, on: 'b1', off: 'k1' }]);
		expect(document.querySelector('ul.log')!.textContent).toContain('Rust');
		expect(document.body.textContent).toContain('in de rust');
	});

	it('laat twee spelers in het veld van plek ruilen, zoals de keeper met een veldspeler', async () => {
		metWedstrijd();
		render(Plan);
		kies('Wanneer', 'na-2');
		kies('Wat', 'ruil');
		await tick();
		expect(opties('Ruilt')).toEqual(['Bram (K)', 'Cas (LV)', 'Dirk (RV)', 'Eef (CM)', 'Finn (SP)']);
		kies('Ruilt', 'k1');
		await tick();
		expect(opties('Met')).not.toContain('Bram (K)');
		kies('Met', 'm1');
		await tick();
		screen.getByRole('button', { name: 'Toevoegen' }).click();
		await tick();
		expect(app.match!.plan).toMatchObject([{ naDeel: 2, soort: 'ruil', on: 'm1', off: 'k1' }]);
		/* met de plekken erbij, zoals het dan staat */
		expect(document.querySelector('ul.log')!.textContent).toContain('Bram naar CM, Eef naar K');
	});

	/* De plekken zoals ze op dat moment zijn: na de ruil in de rust staat Bram op CM. */
	it('zet bij elke stap de plekken zoals ze dan zijn', () => {
		const w = metWedstrijd();
		w.plan = [
			{ id: 's1', minuut: 70, naDeel: 2, on: 'm1', off: 'k1', soort: 'ruil' },
			{ id: 's2', minuut: 80, on: 'b1', off: 'k1' }
		];
		render(Plan);
		const regels = [...document.querySelectorAll('ul.log li')].map((li) => li.textContent);
		expect(regels[0]).toContain('Bram naar CM, Eef naar K');
		expect(regels[1]).toContain('Gijs voor Bram (CM)');
	});

	it('zegt bij een stap die op zijn moment niet kan dat hij vervallen is, en waarom', () => {
		const w = metWedstrijd({ absent: ['b1'] });
		w.bench = [];
		w.plan = [{ id: 's1', minuut: 25, on: 'b1', off: 'a1' }];
		render(Plan);
		expect(document.querySelector('ul.log')!.textContent).toContain('vervallen: Gijs is er niet');
	});

	/* Vooraf staat Bram nog in het doel; na de ruil in de rust staat hij op CM. */
	it('noemt de tweede stap van een keeperwissel niet vervallen', () => {
		const w = metWedstrijd();
		w.plan = [
			{ id: 's1', minuut: 70, naDeel: 2, on: 'b1', off: 'k1' },
			{ id: 's2', minuut: 70, naDeel: 2, on: 'k1', off: 'a1' }
		];
		render(Plan);
		expect(document.querySelector('ul.log')!.textContent).not.toContain('vervallen');
	});

	/* Eerst de keeper voor de tweede helft, dan de wissels voor de eerste: de lijst staat toch op tijd. */
	it('zet de stappen op volgorde van tijd, hoe je ze ook invoert', () => {
		const w = metWedstrijd();
		w.plan = [
			{ id: 's1', minuut: 70, naDeel: 2, on: 'b1', off: 'k1' },
			{ id: 's2', minuut: 20, on: 'b1', off: 'a1' }
		];
		render(Plan);
		const regels = [...document.querySelectorAll('ul.log li b')].map((b) => b.textContent);
		expect(regels).toEqual(['20′', 'Rust']);
	});

	it('zegt het als er geen wedstrijd is', () => {
		render(Plan);
		expect(document.body.textContent).toContain('Er is geen wedstrijd om een wisselplan voor te maken');
	});

	it('zet een stap in het plan', async () => {
		metWedstrijd();
		render(Plan);
		expect(document.body.textContent).toContain('Nog niets gepland.');
		kies('Wanneer', 'minuut');
		await tick();
		kies('Minuut', '25');
		kies('Erin', 'b1');
		kies('Eruit', 'a1');
		await tick();
		screen.getByRole('button', { name: 'Toevoegen' }).click();
		await tick();
		expect(app.match!.plan).toMatchObject([{ minuut: 25, on: 'b1', off: 'a1' }]);
		expect(document.querySelector('ul.log')!.textContent).toContain('Gijs voor Finn');
	});

	/* Niet de hele selectie: eruit wie in het veld staat, erin wie op de bank zit. */
	it('laat alleen kiezen wat kan', () => {
		metWedstrijd();
		render(Plan);
		expect(opties('Eruit')).toEqual(['Bram (K)', 'Cas (LV)', 'Dirk (RV)', 'Eef (CM)', 'Finn (SP)']);
		expect(opties('Erin')).toEqual(['Gijs']);
	});

	it('laat wie er vandaag niet is niet kiezen', () => {
		metWedstrijd({ absent: ['b1'], bench: [] });
		render(Plan);
		expect(opties('Erin')).not.toContain('Gijs');
	});

	/* Na "25′ Gijs voor Finn" staat Finn vanaf minuut 25 op de bank. */
	it('rekent de stappen die al gepland staan mee', async () => {
		const w = metWedstrijd();
		w.plan = [{ id: 's1', minuut: 25, on: 'b1', off: 'a1' }];
		render(Plan);
		expect(opties('Erin')).toEqual(['Gijs']);
		kies('Wanneer', 'minuut');
		await tick();
		kies('Minuut', '30');
		await tick();
		expect(opties('Erin')).toEqual(['Finn']);
		expect(opties('Eruit')).toContain('Gijs (SP)');
		expect(opties('Eruit')).not.toContain('Finn (SP)');
	});

	it('zet wie in dezelfde linie speelt bovenaan', async () => {
		const w = metWedstrijd();
		app.toestand.players.push({ id: 'v3', name: 'Aad', line: 'V' });
		w.bench = ['b1', 'v3'];
		render(Plan);
		expect(opties('Erin')).toEqual(['Aad', 'Gijs']);
		kies('Eruit', 'a1');
		await tick();
		expect(opties('Erin')).toEqual(['Gijs', 'Aad']);
	});

	it('laat een keuze vallen die bij een andere minuut niet meer kan', async () => {
		const w = metWedstrijd();
		w.plan = [{ id: 's1', minuut: 25, on: 'b1', off: 'a1' }];
		render(Plan);
		kies('Eruit', 'a1');
		await tick();
		expect((screen.getByLabelText('Eruit') as HTMLSelectElement).value).toBe('a1');
		kies('Wanneer', 'minuut');
		await tick();
		kies('Minuut', '30');
		await tick();
		expect((screen.getByLabelText('Eruit') as HTMLSelectElement).value).toBe('');
	});

	it('haalt een stap weg', async () => {
		const w = metWedstrijd();
		w.plan = [{ id: 's1', minuut: 25, on: 'b1', off: 'a1' }];
		render(Plan);
		screen.getByRole('button', { name: 'Weghalen' }).click();
		await tick();
		expect(app.match!.plan).toEqual([]);
	});

	it('laat zien wat al gedaan is, en haalt het terug als je het toch wilt', async () => {
		const w = lopendeWedstrijd(1800);
		w.plan = [
			{ id: 's1', minuut: 25, on: 'b1', off: 'a1' },
			{ id: 's2', minuut: 30, on: 'a1', off: 'm1', skipped: true }
		];
		w.lineup.SP = 'b1';
		w.bench = ['a1'];
		w.events.push({ type: 'substitution', t: 1500, on: 'b1', off: 'a1', position: 'SP' });
		render(Plan);
		const regels = [...document.querySelectorAll('ul.log li')].map((li) => li.textContent);
		expect(regels[0]).toContain('gedaan');
		expect(regels[1]).toContain('overgeslagen');
		screen.getByRole('button', { name: 'Toch doen' }).click();
		await tick();
		expect(app.match!.plan![1].skipped).toBeUndefined();
	});

	it('gaat terug naar de wedstrijd als die al loopt', () => {
		lopendeWedstrijd(600);
		render(Plan);
		expect(screen.getByRole('link', { name: 'Klaar' }).getAttribute('href')).toBe('/app/wedstrijd');
	});
});
