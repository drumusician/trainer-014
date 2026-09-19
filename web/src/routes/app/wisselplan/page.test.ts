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

function kies(label: string, waarde: string) {
	const veld = screen.getByLabelText(label) as HTMLSelectElement | HTMLInputElement;
	veld.value = waarde;
	veld.dispatchEvent(new Event(veld instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
}

describe('het wisselplan maken', () => {
	it('zegt het als er geen wedstrijd is', () => {
		render(Plan);
		expect(document.body.textContent).toContain('Er is geen wedstrijd om een wisselplan voor te maken');
	});

	it('zet een stap in het plan', async () => {
		metWedstrijd();
		render(Plan);
		expect(document.body.textContent).toContain('Nog niets gepland.');
		kies('Minuut', '25');
		kies('Erin', 'b1');
		kies('Eruit', 'a1');
		await tick();
		screen.getByRole('button', { name: 'Toevoegen' }).click();
		await tick();
		expect(app.match!.plan).toMatchObject([{ minuut: 25, on: 'b1', off: 'a1' }]);
		expect(document.querySelector('ul.log')!.textContent).toContain('Gijs voor Finn');
	});

	it('laat wie er vandaag niet is niet kiezen', () => {
		metWedstrijd({ absent: ['b1'] });
		render(Plan);
		const opties = [...(screen.getByLabelText('Erin') as HTMLSelectElement).options].map((o) => o.textContent);
		expect(opties).not.toContain('Gijs');
		expect(opties).toContain('Finn');
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
