import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import BankKolom from './BankKolom.svelte';
import { app } from '$lib/store.svelte';
import { emptyState } from '$lib/domain/types';

beforeEach(() => {
	app.toestand = emptyState();
	app.toestand.players = [
		{ id: 'p1', name: 'Bram', line: '', keeper: true },
		{ id: 'p2', name: 'Cas', line: 'V' },
		{ id: 'p3', name: 'Dirk', line: 'M' },
		{ id: 'p4', name: 'Eef', line: 'A' }
	];
});

/* De naam staat in de eerste span van de chip; daarachter komt de speeltijd. */
const namenOpDeBank = () => screen.getAllByRole('button').map((k) => k.querySelector('span')?.textContent);

describe('de bank', () => {
	it('groepeert de spelers per linie', () => {
		render(BankKolom, { bench: ['p1', 'p2', 'p3', 'p4'], formation: '4-3-3', ontik: () => {} });
		for (const kop of ['Keeper', 'Verdediging', 'Middenveld', 'Aanval']) {
			expect(screen.getByText(kop)).toBeTruthy();
		}
	});

	it('laat weten dat de bank leeg is', () => {
		render(BankKolom, { bench: [], formation: '4-3-3', ontik: () => {} });
		expect(screen.getByText('Iedereen speelt.')).toBeTruthy();
	});

	it('geeft de aangetikte speler door', () => {
		const getikt = vi.fn();
		render(BankKolom, { bench: ['p2'], formation: '4-3-3', ontik: getikt });
		screen.getByRole('button', { name: /Cas/ }).click();
		expect(getikt).toHaveBeenCalledWith('p2');
	});

	/*
	 * Tijdens een wedstrijd staat de speler die het minst gespeeld heeft vooraan.
	 * Dat is de hele reden dat de bank bestaat: je hoeft niet te zoeken wie er nu
	 * in moet.
	 */
	it('zet tijdens een wedstrijd de minst gespeelde speler vooraan', () => {
		app.toestand.players = [
			{ id: 'a', name: 'Aap', line: 'V' },
			{ id: 'b', name: 'Beer', line: 'V' },
			{ id: 'c', name: 'Cavia', line: 'V' }
		];
		render(BankKolom, {
			bench: ['a', 'b', 'c'],
			formation: '4-3-3',
			tijden: { a: 2400, b: 300, c: 1200 },
			ontik: () => {}
		});
		expect(namenOpDeBank()).toEqual(['Beer', 'Cavia', 'Aap']);
	});

	it('zet ze buiten de wedstrijd op naam', () => {
		app.toestand.players = [
			{ id: 'a', name: 'Cavia', line: 'V' },
			{ id: 'b', name: 'Aap', line: 'V' },
			{ id: 'c', name: 'Beer', line: 'V' }
		];
		render(BankKolom, { bench: ['a', 'b', 'c'], formation: '4-3-3', ontik: () => {} });
		expect(namenOpDeBank()).toEqual(['Aap', 'Beer', 'Cavia']);
	});

	it('markeert wie op de gekozen plek past', () => {
		const { container } = render(BankKolom, {
			bench: ['p1', 'p2', 'p4'],
			formation: '4-3-3',
			gekozen: 'K',
			ontik: () => {}
		});
		/* Bram is de enige keeper, dus de enige die op K past. */
		expect(container.querySelector('.chip.doel')?.textContent).toContain('Bram');
		expect(container.querySelectorAll('.chip.andere')).toHaveLength(2);
	});

	it('toont Nederlands, geen Engelse resten van de hernoeming', () => {
		const { container } = render(BankKolom, {
			bench: ['p1', 'p2'],
			formation: '4-3-3',
			ontik: () => {}
		});
		const tekst = container.textContent ?? '';
		for (const woord of ['player', 'bench', 'keeper', 'defence', 'attack', 'midfield']) {
			expect(tekst).not.toContain(woord);
		}
	});
});
