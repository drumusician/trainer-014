import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import Programma from './+page.svelte';
import { app } from '$lib/store.svelte';
import { emptyState } from '$lib/domain/types';
import { metSelectie } from '../../../test/wedstrijd';
import { gegaanNaar } from '../../../test/sveltekit/navigation';

beforeEach(() => {
	localStorage.clear();
	gegaanNaar.length = 0;
	app.toestand = emptyState();
	metSelectie();
	vi.restoreAllMocks();
	vi.stubGlobal('confirm', () => true);
});

describe('het programma op het web', () => {
	it('zet een wedstrijd erin', async () => {
		render(Programma);
		await fireEvent.input(screen.getByPlaceholderText('Sparta'), { target: { value: 'Ajax' } });
		screen.getByRole('button', { name: 'Zet erin' }).click();
		await tick();
		expect(app.toestand.program).toHaveLength(1);
		expect(app.toestand.program![0].opponent).toBe('Ajax');
		expect(document.body.textContent).toContain('Thuis tegen Ajax');
	});

	it('zegt dat ouders het nog niet zien, en laat zien wie wat deed', async () => {
		const id = app.addToProgram('2099-01-10', '10:30', 'PSV', false);
		const sem = app.toestand.players[0];
		app.setTask(id, 'fluiten', sem.id);
		render(Programma);
		await tick();
		expect(document.body.textContent).toContain('Ouders zien dit nog niet');
		expect(screen.getByRole('heading', { name: 'Wie deed wat' })).toBeTruthy();
		expect(document.body.textContent).toContain(sem.name + '1×');
	});

	it('is een lijst, met per wedstrijd wie wat regelt en een link naar de wedstrijd', async () => {
		const id = app.addToProgram('2099-01-10', '10:30', 'PSV', false);
		app.setTask(id, 'limonade', app.toestand.players[0].id);
		render(Programma);
		await tick();
		const link = screen.getByRole('link', { name: /Uit tegen PSV/ });
		expect(link.getAttribute('href')).toBe('/app/programma/' + id);
		expect(link.textContent).toContain('Limonade ' + app.toestand.players[0].name);
		expect(screen.queryByRole('combobox', { name: 'Limonade PSV' })).toBeNull();
	});
});
