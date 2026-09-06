import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import Afloop from './+page.svelte';
import { app } from '$lib/store.svelte';
import { emptyState } from '$lib/domain/types';
import { lopendeWedstrijd } from '../../../test/wedstrijd';
import { gegaanNaar } from '../../../test/sveltekit/navigation';

/*
 * Na afloop. Hier komt alles samen wat tijdens de wedstrijd is bijgehouden, en
 * hier wordt het opgeborgen. Wat je hier ziet is de enige controle die je nog
 * hebt voordat de wedstrijd het archief in gaat.
 */
function gespeeldeWedstrijd() {
	const w = lopendeWedstrijd(0);
	w.events = [
		{ type: 'start', t: 0 },
		{ type: 'goal', t: 300, player: 'a1' },
		{ type: 'conceded', t: 700 },
		{ type: 'substitution', t: 1200, off: 'a1', on: 'b1', position: 'SP' },
		{ type: 'goal', t: 1500, player: 'b1' }
	] as never;
	w.lineup = { K: 'k1', LV: 'v1', RV: 'v2', CM: 'm1', SP: 'b1' };
	w.bench = ['a1'];
	w.running = false;
	w.elapsed = 2400;
	w.finished = true;
	return w;
}

beforeEach(() => {
	localStorage.clear();
	gegaanNaar.length = 0;
	app.toestand = emptyState();
});

describe('het scherm na afloop', () => {
	it('zegt het als er niets te tonen is', () => {
		render(Afloop);
		expect(document.querySelector('.uitleg')?.textContent).toBeTruthy();
	});

	it('zet de uitslag met de teamnamen erbij', () => {
		gespeeldeWedstrijd();
		render(Afloop);
		expect(document.body.textContent).toContain('O14-3');
		expect(document.body.textContent).toContain('Kampong');
		expect(document.body.textContent).toContain('2 – 1');
	});

	/* De speeltijd wordt teruggerekend uit de wissels. Finn stond twintig minuten
	   op het veld en Gijs de laatste twintig; dat moet je hier terugzien. */
	it('rekent de speeltijd uit de wissels terug', () => {
		gespeeldeWedstrijd();
		render(Afloop);
		const rijen = [...document.querySelectorAll('tr')].map((r) => r.textContent ?? '');
		expect(rijen.find((r) => r.includes('Finn'))).toContain('20 min');
		expect(rijen.find((r) => r.includes('Gijs'))).toContain('20 min');
		expect(rijen.find((r) => r.includes('Bram'))).toContain('40 min');
	});

	it('zet het verloop op volgorde neer', () => {
		gespeeldeWedstrijd();
		render(Afloop);
		const regels = [...document.querySelectorAll('.log li')].map((l) => l.textContent ?? '');
		expect(regels.length).toBeGreaterThanOrEqual(4);
		expect(regels[0]).toContain('00:00');
		expect(regels.some((r) => r.includes('Finn'))).toBe(true);
	});

	it('bewaart de notitie terwijl je typt', async () => {
		gespeeldeWedstrijd();
		render(Afloop);
		const vak = document.querySelector('textarea') as HTMLTextAreaElement;
		vak.value = 'Sterke tweede helft.';
		vak.dispatchEvent(new Event('input', { bubbles: true }));
		await tick();
		expect(app.toestand.match!.note).toBe('Sterke tweede helft.');
	});

	/* Opbergen is het enige wat hier onomkeerbaar voelt, dus het moet ook echt
	   gebeuren: in het archief én weg van dit scherm. */
	it('bergt de wedstrijd op en gaat terug naar start', async () => {
		gespeeldeWedstrijd();
		render(Afloop);
		screen.getByRole('button', { name: 'Bewaren in archief' }).click();
		await tick();
		expect(app.toestand.archive).toHaveLength(1);
		expect(app.toestand.archive[0].opponent).toBe('Kampong');
		expect(gegaanNaar).toContain('/app');
	});

	it('toont Nederlands, geen Engelse resten van de hernoeming', () => {
		gespeeldeWedstrijd();
		render(Afloop);
		const tekst = document.body.textContent ?? '';
		for (const woord of ['substitution', 'lineup', 'undefined', 'NaN']) {
			expect(tekst).not.toContain(woord);
		}
	});
});
