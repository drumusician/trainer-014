import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import Trainingen from './+page.svelte';
import Training from './[id]/+page.svelte';
import { app } from '$lib/store.svelte';
import { emptyState } from '$lib/domain/types';
import { metSelectie } from '../../../test/wedstrijd';
import { page } from '../../../test/sveltekit/state.svelte';
import { gegaanNaar } from '../../../test/sveltekit/navigation';

/*
 * De trainingen zijn de reden dat de app weet wie er de laatste weken weinig is
 * geweest. Die telling loopt door naar het opstelscherm en de bank, dus wat hier
 * geteld wordt bepaalt daar wat je te zien krijgt.
 */
beforeEach(() => {
	localStorage.clear();
	gegaanNaar.length = 0;
	app.toestand = emptyState();
	vi.restoreAllMocks();
});

describe('de lijst met trainingen', () => {
	it('vraagt eerst om een selectie', () => {
		render(Trainingen);
		screen.getByRole('button', { name: 'Nieuwe training' }).click();
		expect(gegaanNaar).toContain('/app/opzetten');
	});

	it('zegt dat er nog geen training is', () => {
		metSelectie();
		render(Trainingen);
		expect(document.querySelectorAll('.log li')).toHaveLength(0);
	});

	it('maakt een training en gaat er meteen naartoe', () => {
		metSelectie();
		render(Trainingen);
		screen.getByRole('button', { name: 'Nieuwe training' }).click();
		expect(app.toestand.trainings).toHaveLength(1);
		expect(gegaanNaar[0]).toBe('/app/trainingen/' + app.toestand.trainings[0].id);
	});

	it('vat elke training samen met de telling erbij', () => {
		metSelectie();
		app.toestand.trainings = [
			{ id: 't1', date: '2026-09-01', status: { k1: 'present', v1: 'excused', v2: 'absent' } }
		] as never;
		render(Trainingen);
		const regel = document.querySelector('.log li')?.textContent ?? '';
		expect(regel).toContain('1 aanwezig');
		expect(regel).toContain('1 afgemeld');
		expect(regel).toContain('1 niet gekomen');
	});

	/* Wie de laatste vier keer weinig is geweest hoort hier apart te staan. */
	it('zet wie er weinig is geweest apart', () => {
		metSelectie();
		app.toestand.trainings = [1, 2, 3, 4].map((n) => ({
			id: 't' + n,
			date: '2026-09-0' + n,
			status: { k1: 'present', v1: 'absent', v2: 'present', m1: 'present', a1: 'present', b1: 'present' }
		})) as never;
		render(Trainingen);
		const tabel = document.querySelector('table')?.textContent ?? '';
		expect(tabel).toContain('Cas');
		expect(tabel).not.toContain('Bram');
	});
});

describe('één training', () => {
	function metTraining() {
		metSelectie();
		app.toestand.trainings = [{ id: 't1', date: '2026-09-01', status: {} }] as never;
		page.params = { id: 't1' };
	}

	it('zegt het als de training niet meer bestaat', () => {
		metSelectie();
		page.params = { id: 'weg' };
		render(Training);
		expect(screen.getByRole('link', { name: 'Terug' })).toBeTruthy();
	});

	it('zet iedereen op aanwezig tot je anders zegt', () => {
		metTraining();
		render(Training);
		expect(screen.getAllByRole('button', { name: 'Aanwezig' })).toHaveLength(6);
		expect(document.querySelector('.telling')?.textContent).toContain('0 aanwezig');
	});

	/*
	 * Eén knop per speler die rondloopt: aanwezig, afgemeld, niet gekomen. Dat is
	 * sneller dan kiezen uit een lijst, maar alleen als de volgorde vaststaat.
	 */
	it('loopt met één knop langs de drie mogelijkheden', async () => {
		metTraining();
		render(Training);
		const knop = screen.getAllByRole('button')[0];
		const gezien: string[] = [];
		for (let i = 0; i < 4; i++) {
			knop.click();
			await tick();
			gezien.push(knop.textContent?.trim() ?? '');
		}
		expect(gezien).toEqual(['Afgemeld', 'Niet gekomen', 'Aanwezig', 'Afgemeld']);
	});

	it('telt mee terwijl je langsloopt', async () => {
		metTraining();
		render(Training);
		screen.getAllByRole('button')[0].click();
		await tick();
		expect(document.querySelector('.telling')?.textContent).toContain('1 afgemeld');
	});

	it('verzet de datum', async () => {
		metTraining();
		render(Training);
		const vak = document.querySelector('input[type=date]') as HTMLInputElement;
		vak.value = '2026-09-08';
		vak.dispatchEvent(new Event('change', { bubbles: true }));
		await tick();
		expect(app.toestand.trainings[0].date).toBe('2026-09-08');
	});

	it('verwijdert de training na bevestiging', async () => {
		metTraining();
		vi.stubGlobal('confirm', () => true);
		render(Training);
		screen.getByRole('button', { name: 'Verwijderen' }).click();
		await tick();
		expect(app.toestand.trainings).toHaveLength(0);
		expect(gegaanNaar).toContain('/app/trainingen');
	});

	it('laat de training staan als je afbreekt', async () => {
		metTraining();
		vi.stubGlobal('confirm', () => false);
		render(Training);
		screen.getByRole('button', { name: 'Verwijderen' }).click();
		await tick();
		expect(app.toestand.trainings).toHaveLength(1);
	});
});
