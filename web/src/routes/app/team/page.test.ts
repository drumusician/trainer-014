import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import Team from './+page.svelte';
import { app } from '$lib/store.svelte';
import { emptyState } from '$lib/domain/types';
import { metSelectie } from '../../../test/wedstrijd';

/*
 * Het teamscherm is waar de selectie ontstaat en waar je ziet of je genoeg
 * spelers per linie hebt. Dat laatste is de reden dat dit scherm bestaat: een
 * tekort wil je in de week zien, niet zaterdagochtend op het veld.
 */
beforeEach(() => {
	localStorage.clear();
	app.toestand = emptyState();
	vi.restoreAllMocks();
});

describe('het teamscherm', () => {
	it('vraagt om namen als de selectie leeg is', async () => {
		render(Team);
		const vak = document.querySelector('textarea') as HTMLTextAreaElement;
		vak.value = 'Bram\nCas\nDirk';
		vak.dispatchEvent(new Event('input', { bubbles: true }));
		await tick();
		screen.getByRole('button', { name: 'Toevoegen' }).click();
		await tick();
		expect(app.toestand.players.map((p) => p.name)).toEqual(['Bram', 'Cas', 'Dirk']);
	});

	it('zet elke speler met zijn linieknoppen neer', () => {
		metSelectie();
		render(Team);
		expect(screen.getByRole('button', { name: 'Bram' })).toBeTruthy();
		/* K, V, M en A voor elk van de zes spelers */
		expect(document.querySelectorAll('.keuze button')).toHaveLength(24);
	});

	it('zet een speler in een andere linie', async () => {
		metSelectie();
		render(Team);
		const rij = [...document.querySelectorAll('.sregel')].find((r) => r.textContent?.includes('Cas'))!;
		(rij.querySelectorAll('.keuze button')[3] as HTMLButtonElement).click();
		await tick();
		expect(app.playerById('v1')!.line).toBe('A');
	});

	it('maakt iemand keeper en weer niet', async () => {
		metSelectie();
		render(Team);
		const rij = [...document.querySelectorAll('.sregel')].find((r) => r.textContent?.includes('Cas'))!;
		const k = rij.querySelector('.keuze button') as HTMLButtonElement;
		k.click();
		await tick();
		expect(app.playerById('v1')!.keeper).toBe(true);
		k.click();
		await tick();
		expect(app.playerById('v1')!.keeper).toBe(false);
	});

	it('hernoemt een speler', async () => {
		metSelectie();
		vi.stubGlobal('prompt', () => 'Bramz');
		render(Team);
		screen.getByRole('button', { name: 'Bram' }).click();
		await tick();
		expect(app.playerById('k1')!.name).toBe('Bramz');
	});

	/* Een lege naam betekent: weghalen. Dat vraagt om een bevestiging. */
	it('haalt een speler weg als je de naam leegmaakt en bevestigt', async () => {
		metSelectie();
		vi.stubGlobal('prompt', () => '');
		vi.stubGlobal('confirm', () => true);
		render(Team);
		screen.getByRole('button', { name: 'Cas' }).click();
		await tick();
		expect(app.toestand.players.map((p) => p.id)).not.toContain('v1');
	});

	it('laat een speler staan als je de verwijdering afbreekt', async () => {
		metSelectie();
		vi.stubGlobal('prompt', () => '');
		vi.stubGlobal('confirm', () => false);
		render(Team);
		screen.getByRole('button', { name: 'Cas' }).click();
		await tick();
		expect(app.toestand.players.map((p) => p.id)).toContain('v1');
	});

	/*
	 * De bezettingstabel. Met zes spelers voor een formatie van elf is er overal
	 * tekort, en dat hoort er met zoveel woorden te staan.
	 */
	it('waarschuwt voor een tekort in een linie', () => {
		metSelectie();
		app.toestand.formation = '4-3-3';
		render(Team);
		expect(document.querySelectorAll('.mager').length).toBeGreaterThan(0);
	});

	it('waarschuwt zolang het team nog geen naam heeft', () => {
		metSelectie();
		app.toestand.teamName = 'Ons team';
		render(Team);
		expect(document.querySelector('.uitleg .mager')).toBeTruthy();
	});

	it('neemt de teamnaam over', async () => {
		metSelectie();
		render(Team);
		const vak = document.querySelector('input') as HTMLInputElement;
		vak.value = 'JO14-3';
		vak.dispatchEvent(new Event('change', { bubbles: true }));
		await tick();
		expect(app.toestand.teamName).toBe('JO14-3');
	});

	it('toont Nederlands, geen Engelse resten van de hernoeming', () => {
		metSelectie();
		render(Team);
		const tekst = document.body.textContent ?? '';
		for (const woord of ['player', 'squad', 'undefined', 'NaN']) {
			expect(tekst).not.toContain(woord);
		}
	});
});
