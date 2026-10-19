import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import Wedstrijd from './+page.svelte';
import { page } from '../../../../test/sveltekit/state.svelte';
import { app } from '$lib/store.svelte';
import { emptyState } from '$lib/domain/types';
import { metSelectie } from '../../../../test/wedstrijd';
import { gegaanNaar } from '../../../../test/sveltekit/navigation';

beforeEach(() => {
	localStorage.clear();
	gegaanNaar.length = 0;
	app.toestand = emptyState();
	metSelectie();
	vi.restoreAllMocks();
	vi.stubGlobal('confirm', () => true);
});

describe('één wedstrijd uit het programma', () => {
	it('thuis: limonade, fluiten en geen rijders', async () => {
		const id = app.addToProgram('2099-01-10', '10:30', 'PSV', true);
		page.params = { id };
		render(Wedstrijd);
		const sem = app.toestand.players[0];
		await fireEvent.change(screen.getByRole('combobox', { name: 'Limonade PSV' }), { target: { value: sem.id } });
		expect(app.toestand.tasks).toEqual([expect.objectContaining({ matchId: id, kind: 'limonade', player: sem.id })]);
		expect(screen.queryByRole('button', { name: 'Rijder erbij' })).toBeNull();
	});

	it('uit: open rijplekken, een rijder erbij, en geen limonade of fluiten', async () => {
		const id = app.addToProgram('2099-01-10', '10:30', 'PSV', false);
		page.params = { id };
		render(Wedstrijd);
		expect(screen.queryByRole('combobox', { name: 'Limonade PSV' })).toBeNull();
		expect(screen.queryByRole('combobox', { name: 'Fluiten PSV' })).toBeNull();
		expect(app.toestand.tasks!.filter((x) => x.kind === 'rijden')).toHaveLength(2);
		screen.getByRole('button', { name: 'Rijder erbij' }).click();
		await tick();
		expect(app.toestand.tasks!.filter((x) => x.kind === 'rijden')).toHaveLength(3);
		screen.getAllByRole('button', { name: 'Haal weg' })[0].click();
		await tick();
		expect(app.toestand.tasks!.filter((x) => x.kind === 'rijden')).toHaveLength(2);
	});

	it('laat zien wie niet kon', () => {
		const id = app.addToProgram('2099-01-10', undefined, 'PSV', false);
		page.params = { id };
		app.toestand.tasks = [{ id: 'x', matchId: id, kind: 'vlaggen', declinedBy: app.toestand.players[1].id }];
		render(Wedstrijd);
		expect(document.body.textContent).toContain(app.toestand.players[1].name + ' kan niet (vlaggen)');
	});

	it('begint de wedstrijd van vandaag', async () => {
		const id = app.addToProgram(new Date().toISOString().slice(0, 10), '10:30', 'Feyenoord', true);
		page.params = { id };
		render(Wedstrijd);
		screen.getByRole('button', { name: 'Begin deze wedstrijd' }).click();
		await tick();
		expect(app.toestand.match?.id).toBe(id);
		expect(gegaanNaar).toContain('/app/aanwezig');
	});

	it('haalt een wedstrijd uit het programma', async () => {
		page.params = { id: app.addToProgram('2099-01-10', undefined, 'PSV', false) };
		render(Wedstrijd);
		screen.getByRole('button', { name: 'Haal uit het programma' }).click();
		await tick();
		expect(app.toestand.program).toHaveLength(0);
		expect(gegaanNaar).toContain('/app/programma');
	});

	it('de vereniging kan fluiten', async () => {
		const id = app.addToProgram('2099-01-10', '10:30', 'PSV', true);
		page.params = { id };
		render(Wedstrijd);
		await fireEvent.change(screen.getByRole('combobox', { name: 'Fluiten PSV' }), { target: { value: 'vereniging' } });
		expect(app.toestand.tasks).toContainEqual(expect.objectContaining({ matchId: id, kind: 'fluiten', club: true }));
	});
});
