import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import OpBeginscherm from './OpBeginscherm.svelte';

/*
 * De uitleg om Blaadje op je beginscherm te zetten. Dat is geen bijzaak: op iOS
 * is dat het verschil tussen een app die het hele scherm gebruikt en een tab met
 * een adresbalk eroverheen. De uitleg per toestel verschilt volledig, dus het
 * raden van het toestel moet kloppen.
 */
function alsToestel(ua: string, aanraakpunten = 0, alsApp = false) {
	Object.defineProperty(navigator, 'userAgent', { value: ua, configurable: true });
	Object.defineProperty(navigator, 'maxTouchPoints', { value: aanraakpunten, configurable: true });
	Object.defineProperty(navigator, 'standalone', { value: alsApp, configurable: true });
	window.matchMedia = ((q: string) => ({
		matches: alsApp && q.includes('standalone'),
		media: q,
		addEventListener() {},
		removeEventListener() {}
	})) as never;
}

beforeEach(() => vi.restoreAllMocks());

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8)';
const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)';

describe('op je beginscherm zetten', () => {
	it('toont de iPhone-uitleg op een iPhone', async () => {
		alsToestel(IPHONE);
		render(OpBeginscherm);
		await tick();
		expect(document.querySelector('.keuze button.aan')?.textContent?.trim()).toBe('iPhone of iPad');
		expect(document.querySelectorAll('.stappen li')).toHaveLength(3);
	});

	it('toont de Android-uitleg op Android', async () => {
		alsToestel(ANDROID);
		render(OpBeginscherm);
		await tick();
		const aan = document.querySelector('.keuze button.aan');
		expect(aan?.textContent?.trim()).toBe('Android');
	});

	/* Op een laptop bereid je voor; de uitleg is dan toch voor je telefoon, dus
	   die van de iPhone is de beste gok. */
	it('gokt op de iPhone-uitleg vanaf een laptop', async () => {
		alsToestel(MAC);
		render(OpBeginscherm);
		await tick();
		expect(document.querySelector('.keuze button.aan')?.textContent?.trim()).toBe('iPhone of iPad');
	});

	it('laat je zelf een ander toestel kiezen', async () => {
		alsToestel(IPHONE);
		render(OpBeginscherm);
		await tick();
		screen.getByRole('button', { name: 'Android' }).click();
		await tick();
		expect(document.querySelector('.keuze button.aan')?.textContent?.trim()).toBe('Android');
	});

	/*
	 * Wie hier al met Blaadje werkt vindt straks een lege app op zijn beginscherm:
	 * die heeft eigen opslag. Zonder waarschuwing denkt hij dat hij alles kwijt is,
	 * en dat is precies het moment waarop iemand stopt met de app.
	 */
	it('zegt dat je je gegevens eerst moet overzetten', async () => {
		alsToestel(IPHONE);
		localStorage.setItem('o14-app-v1', JSON.stringify({ players: [{ id: 'p1', name: 'Bram' }] }));
		render(OpBeginscherm);
		await tick();
		expect(document.body.textContent).toContain('begint leeg');
		expect(document.body.textContent).toContain('code bij Gegevens');
	});

	it('zwijgt daarover als er hier nog niets staat', async () => {
		alsToestel(IPHONE);
		localStorage.clear();
		render(OpBeginscherm);
		await tick();
		expect(document.body.textContent).not.toContain('begint leeg');
	});

	it('houdt op met uitleggen als de app er al staat', async () => {
		alsToestel(IPHONE, 0, true);
		render(OpBeginscherm);
		await tick();
		expect(document.querySelectorAll('.stappen li')).toHaveLength(0);
		expect(document.body.textContent).toContain('staat al op je beginscherm');
	});

	/*
	 * Chrome biedt zelf aan om te installeren. Die kans grijpen we: dan hoeft
	 * niemand de drie stappen te lezen.
	 */
	it('gebruikt het aanbod van Chrome als dat langskomt', async () => {
		alsToestel(ANDROID);
		render(OpBeginscherm);
		await tick();
		expect(screen.queryByRole('button', { name: 'Op mijn beginscherm zetten' })).toBeNull();

		const vraag = vi.fn().mockResolvedValue(undefined);
		const e = new Event('beforeinstallprompt');
		(e as Event & { prompt?: () => Promise<void> }).prompt = vraag;
		window.dispatchEvent(e);
		await tick();

		const knop = screen.getByRole('button', { name: 'Op mijn beginscherm zetten' });
		knop.click();
		await Promise.resolve();
		expect(vraag).toHaveBeenCalled();
	});
});
