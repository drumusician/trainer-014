import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import Veld from './Veld.svelte';
import { app } from '$lib/store.svelte';
import { emptyState } from '$lib/domain/types';

/**
 * Het veld is waar je tijdens een wedstrijd op tikt, en tot nu toe raakte geen
 * enkele test het aan. Elke fout die op 6 september live ging zat in deze laag:
 * Engelse woorden in Nederlandse zinnen, een stijlklasse die niet meer bestond,
 * en een klok die NaN toonde. Alle drie ongezien door 193 tests.
 */
beforeEach(() => {
	app.toestand = emptyState();
	app.toestand.players = [
		{ id: 'p1', name: 'Bram', line: '', keeper: true },
		{ id: 'p2', name: 'Cas', line: 'V' },
		{ id: 'p3', name: 'Dirk', line: 'A' }
	];
});

describe('het veld', () => {
	it('zet elke plek van de formatie neer', () => {
		render(Veld, { formation: '4-3-3', lineup: {} });
		expect(screen.getAllByRole('button')).toHaveLength(11);
	});

	it('zet de namen op de plekken waar iemand staat', () => {
		render(Veld, { formation: '4-3-3', lineup: { K: 'p1', SP: 'p3' } });
		expect(screen.getByText('Bram')).toBeTruthy();
		expect(screen.getByText('Dirk')).toBeTruthy();
	});

	it('laat een lege plek zien als zodanig', () => {
		render(Veld, { formation: '4-3-3', lineup: { K: 'p1' } });
		/* de overige tien plekken tonen een plusje */
		expect(screen.getAllByText('+', { selector: '.bol' })).toHaveLength(10);
	});

	it('geeft de aangetikte plek door', async () => {
		const getikt = vi.fn();
		render(Veld, { formation: '4-3-3', lineup: { K: 'p1' }, onplek: getikt });
		screen.getByRole('button', { name: /Bram/ }).click();
		expect(getikt).toHaveBeenCalledWith('K');
	});

	it('toont de gespeelde minuten onder de naam', () => {
		render(Veld, { formation: '4-3-3', lineup: { K: 'p1' }, tijden: { p1: 2100 } });
		expect(screen.getByText(/35′/)).toBeTruthy();
	});

	/* Dit is de klasse fouten die 6 september drie keer live ging. */
	it('toont Nederlands, geen Engelse resten van de hernoeming', () => {
		const { container } = render(Veld, { formation: '4-4-2 diamond', lineup: { K: 'p1' } });
		const tekst = container.textContent ?? '';
		for (const woord of ['player', 'match', 'lineup', 'bench', 'position', 'players']) {
			expect(tekst).not.toContain(woord);
		}
	});
});
