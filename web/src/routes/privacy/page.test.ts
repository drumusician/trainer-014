import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import Privacy from './+page.svelte';
import Landing from '../+page.svelte';

/* De App Store vraagt een openbaar adres met de privacyverklaring, en Apple
   kijkt of je daar leest hoe je je account verwijdert. */
describe('de privacyverklaring', () => {
	it('zegt hoe je je account verwijdert, op dezelfde plek als in de app', () => {
		render(Privacy);
		expect(screen.getByText(/Meer → Account → Verwijder je account/)).toBeTruthy();
	});

	it('noemt wie erachter zit en waar je terecht kunt', () => {
		render(Privacy);
		expect(screen.getByText(/SMART Code B\.V\./)).toBeTruthy();
		expect(screen.getAllByRole('link', { name: 'tjaco@blaadje.app' }).length).toBeGreaterThan(0);
		expect(screen.getByRole('link', { name: /Autoriteit Persoonsgegevens/ })).toBeTruthy();
	});

	it('is vanaf de landingspagina te vinden', () => {
		render(Landing);
		const links = screen.getAllByRole('link').filter((l) => l.getAttribute('href') === '/privacy');
		expect(links.length).toBeGreaterThanOrEqual(2);
	});
});
