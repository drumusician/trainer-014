import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import Landing from './+page.svelte';
import Fout from './+error.svelte';
import { issues } from '$lib/issues.svelte';
import { page } from '../test/sveltekit/state.svelte';

/*
 * De landingspagina is het enige stuk van Blaadje dat gemeten wordt en het enige
 * dat vreemden te zien krijgen. En de foutpagina is wat je ziet als er iets
 * omvalt — langs de lijn de slechtst denkbare plek om te moeten raden.
 */
function opDomein(host: string) {
	Object.defineProperty(window, 'location', {
		value: { ...window.location, hostname: host, host, replace: vi.fn() },
		writable: true,
		configurable: true
	});
}

beforeEach(() => {
	localStorage.clear();
	document.head.innerHTML = '';
	issues.lijst = [];
	vi.restoreAllMocks();
	opDomein('localhost');
	window.matchMedia = ((q: string) => ({
		matches: false,
		media: q,
		addEventListener() {},
		removeEventListener() {}
	})) as never;
	Object.defineProperty(navigator, 'standalone', { value: false, configurable: true });
});

describe('de landingspagina', () => {
	it('leidt overal naartoe de app in', () => {
		render(Landing);
		const naarDeApp = screen.getAllByRole('link', { name: /blaadje|openen|slag|app/i });
		expect(naarDeApp.length).toBeGreaterThan(2);
		for (const l of screen.getAllByRole('link')) {
			const href = l.getAttribute('href') ?? '';
			expect(href === '/app' || href.startsWith('mailto:')).toBe(true);
		}
	});

	/* De knoppen naar de app doen een volledige herlaad, zodat het meetscript weg
	   is voordat /app verschijnt. Dat is de belofte: in de app wordt niets gemeten. */
	it('laadt de app opnieuw in plaats van ernaartoe te springen', () => {
		render(Landing);
		for (const l of screen.getAllByRole('link')) {
			if (l.getAttribute('href') === '/app') {
				expect(l.hasAttribute('data-sveltekit-reload')).toBe(true);
			}
		}
	});

	it('vertelt de zes dingen die de app doet', () => {
		render(Landing);
		expect(document.querySelectorAll('.blokken > div')).toHaveLength(6);
	});

	it('legt uit hoe je hem op je beginscherm zet', () => {
		render(Landing);
		expect(document.querySelectorAll('.stappen li').length).toBeGreaterThan(0);
	});

	/*
	 * Wie de app vanaf het beginscherm opent kan op iOS op deze pagina uitkomen,
	 * omdat 'Zet op beginscherm' de pagina bewaart waar je op stond. Dan moet hij
	 * meteen door naar de app.
	 */
	it('stuurt door naar de app als hij vanaf het beginscherm geopend wordt', async () => {
		Object.defineProperty(navigator, 'standalone', { value: true, configurable: true });
		render(Landing);
		await tick();
		expect(location.replace).toHaveBeenCalledWith('/app');
	});

	it('meet niets op een gewone tab', async () => {
		render(Landing);
		await tick();
		expect(document.querySelector('script[src*=plausible]')).toBeNull();
	});
});

describe('de foutpagina', () => {
	beforeEach(() => {
		page.url = new URL('http://localhost/app/wedstrijd');
		page.error = { message: 'kapot' } as never;
	});

	it('wijst terug naar de wedstrijden en naar de gegevens', () => {
		render(Fout);
		const hrefs = screen.getAllByRole('link').map((l) => l.getAttribute('href'));
		expect(hrefs).toContain('/app');
		expect(hrefs).toContain('/app/meer');
	});

	/* De melding hoort in de problemenlijst te komen, zodat je hem later nog kunt
	   opzoeken als de app het weer doet. */
	it('schrijft het probleem in de lijst', async () => {
		render(Fout);
		await tick();
		expect(issues.lijst).toHaveLength(1);
		expect(issues.lijst[0].what).toContain('/app/wedstrijd');
		expect(issues.lijst[0].message).toBe('kapot');
	});

	it('laat de foutmelding zien om door te geven', () => {
		render(Fout);
		expect(document.querySelector('code')?.textContent).toBe('kapot');
	});

	/*
	 * Eén keer opschrijven, niet duizend keer.
	 *
	 * Deze effect schrijft in de problemenlijst. Zolang reportIssue die lijst ook
	 * uitlas, abonneerde de effect zich op wat hij zelf ging schrijven: schrijven
	 * maakte hem vuil, hij riep opnieuw aan. Svelte kapt dat af na duizend rondes,
	 * dus er viel niets aan te zien behalve duizend schrijfacties naar localStorage
	 * — op de ene pagina die je nooit onderuit wilt hebben.
	 */
	it('schrijft het één keer op, niet in een lus', async () => {
		let schrijfacties = 0;
		const echt = localStorage.setItem.bind(localStorage);
		localStorage.setItem = (k: string, v: string) => {
			schrijfacties++;
			echt(k, v);
		};
		render(Fout);
		await tick();
		localStorage.setItem = echt;
		expect(schrijfacties).toBe(1);
		expect(issues.lijst).toHaveLength(1);
	});

	it('doet het ook zonder foutmelding', () => {
		page.error = null;
		render(Fout);
		expect(document.querySelector('code')).toBeNull();
	});
});
