import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import Archief from './[i]/+page.svelte';
import Seizoen from './seizoen/+page.svelte';
import { app } from '$lib/store.svelte';
import { emptyState, type ArchivedMatch } from '$lib/domain/types';
import { metSelectie } from '../../../test/wedstrijd';
import { page } from '../../../test/sveltekit/state.svelte';
import { gegaanNaar } from '../../../test/sveltekit/navigation';

/*
 * Een bewaarde wedstrijd. Dit scherm bestaat omdat er na afloop altijd iets
 * blijkt te missen: een doelpunt dat je in de drukte niet hebt getikt, een
 * verkeerde tegenstander. Het is het enige scherm dat opgeborgen gegevens nog
 * mag veranderen, en daarom hoort precies vast te liggen wat het wel en niet kan.
 */
const WEDSTRIJD: ArchivedMatch = {
	date: '2026-09-06',
	opponent: 'Kampong',
	home: true,
	score: [2, 1],
	formation: '1-2-1-1',
	duration: 2400,
	teamName: 'O14-3',
	parts: 2,
	events: [
		{ type: 'start', t: 0 },
		{ type: 'goal', t: 300, player: 'a1' },
		{ type: 'conceded', t: 700 },
		{ type: 'goal', t: 1500, player: 'b1' }
	] as never,
	playingTime: [
		{ id: 'k1', name: 'Bram', seconds: 2400, keeper: 2400 },
		{ id: 'a1', name: 'Finn', seconds: 1200 },
		{ id: 'b1', name: 'Gijs', seconds: 1200 }
	] as never
};

function metArchief(overschrijf: Partial<ArchivedMatch> = {}) {
	metSelectie();
	app.toestand.archive = [{ ...WEDSTRIJD, ...overschrijf }];
	page.params = { i: '0' };
}

beforeEach(() => {
	localStorage.clear();
	gegaanNaar.length = 0;
	app.toestand = emptyState();
	vi.restoreAllMocks();
});

describe('een bewaarde wedstrijd', () => {
	it('zegt het als hij er niet meer is', () => {
		metSelectie();
		page.params = { i: '7' };
		render(Archief);
		expect(screen.getByRole('link', { name: 'Terug' })).toBeTruthy();
	});

	it('zet de uitslag met de teamnaam van toen', () => {
		metArchief({ teamName: 'O13-3' });
		render(Archief);
		expect(document.body.textContent).toContain('O13-3');
		expect(document.body.textContent).toContain('2 – 1');
	});

	/* Wie na de wedstrijd hernoemd is, staat hier onder zijn nieuwe naam. */
	it('gebruikt de naam van nu, niet die van toen', () => {
		metArchief();
		app.playerById('a1')!.name = 'Finnegan';
		render(Archief);
		expect(document.querySelector('table')?.textContent).toContain('Finnegan');
	});

	it('zet de keeperminuten onder de naam', () => {
		metArchief();
		render(Archief);
		expect(document.querySelector('table')?.textContent).toContain('in het doel');
	});

	it('houdt het bewerken verborgen tot je erom vraagt', async () => {
		metArchief();
		render(Archief);
		expect(document.querySelector('input[type=date]')).toBeNull();
		screen.getByRole('button', { name: 'Bijwerken' }).click();
		await tick();
		expect(document.querySelector('input[type=date]')).toBeTruthy();
	});

	it('verzet de tegenstander', async () => {
		metArchief();
		render(Archief);
		screen.getByRole('button', { name: 'Bijwerken' }).click();
		await tick();
		const vak = [...document.querySelectorAll('input')].find(
			(i) => (i as HTMLInputElement).value === 'Kampong'
		) as HTMLInputElement;
		vak.value = 'Hercules';
		vak.dispatchEvent(new Event('change', { bubbles: true }));
		await tick();
		expect(app.toestand.archive[0].opponent).toBe('Hercules');
	});

	/* Een doelpunt weghalen verandert de uitslag, want die wordt geteld. */
	it('haalt een doelpunt weg en telt de uitslag opnieuw', async () => {
		metArchief();
		render(Archief);
		screen.getByRole('button', { name: 'Bijwerken' }).click();
		await tick();
		/* 'Weg' staat bij elk doelpunt in het verloop; 'Verwijderen' onderaan haalt
		   de hele wedstrijd weg. Dat verschil is hier het punt. */
		screen.getAllByRole('button', { name: 'Weg' })[0].click();
		await tick();
		expect(app.toestand.archive[0].score).toEqual([1, 1]);
	});

	it('bewaart de notitie terwijl je typt', async () => {
		metArchief();
		render(Archief);
		const vak = document.querySelector('textarea') as HTMLTextAreaElement;
		vak.value = 'Regen.';
		vak.dispatchEvent(new Event('input', { bubbles: true }));
		await tick();
		expect(app.toestand.archive[0].note).toBe('Regen.');
	});

	it('toont Nederlands, geen Engelse resten van de hernoeming', () => {
		metArchief();
		render(Archief);
		const tekst = document.body.textContent ?? '';
		for (const woord of ['undefined', 'NaN', 'lineup', 'playingTime']) {
			expect(tekst).not.toContain(woord);
		}
	});
});

describe('het seizoen', () => {
	it('zegt dat er nog niets is', () => {
		metSelectie();
		render(Seizoen);
		expect(document.querySelector('.uitleg')?.textContent).toBeTruthy();
	});

	it('telt gewonnen, gelijk en verloren', () => {
		metSelectie();
		app.toestand.archive = [
			{ ...WEDSTRIJD, score: [2, 1] },
			{ ...WEDSTRIJD, score: [1, 1] },
			{ ...WEDSTRIJD, score: [0, 3] }
		];
		render(Seizoen);
		const kop = document.querySelector('p')?.textContent ?? '';
		expect(kop).toContain('3 wedstrijden');
		expect(kop).toContain('1W 1G 1V');
	});

	it('zet de doelpuntenmakers op volgorde', () => {
		metSelectie();
		app.toestand.archive = [WEDSTRIJD, { ...WEDSTRIJD, date: '2026-09-13' }];
		render(Seizoen);
		const regels = [...document.querySelectorAll('.log li')].map((l) => l.textContent ?? '');
		expect(regels).toHaveLength(2);
		expect(regels[0]).toContain('2×');
	});
});
