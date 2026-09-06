import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { meld, startMeten } from './analytics';

/*
 * Meten gebeurt alleen op de landingspagina, en alleen op het echte domein. Dat
 * is een belofte aan de gebruiker: in de app zelf gaat er niets naar een server.
 *
 * Deze test bestaat ook om een andere reden: bij het omzetten naar TypeScript
 * werd init een lege functie, en toen mat Plausible maandenlang niets. Alles zag
 * er goed uit. Wat er ontbrak was dat init de opties in plausible.o zet.
 */
function opDomein(host: string) {
	Object.defineProperty(window, 'location', {
		value: { ...window.location, hostname: host, host },
		writable: true,
		configurable: true
	});
}

beforeEach(() => {
	document.head.innerHTML = '';
	delete window.plausible;
});
afterEach(() => vi.restoreAllMocks());

describe('meten', () => {
	it('doet niets op een ander domein dan blaadje.app', () => {
		opDomein('localhost');
		const stop = startMeten();
		expect(document.querySelector('script')).toBeNull();
		expect(window.plausible).toBeUndefined();
		stop();
	});

	it('laadt het script op blaadje.app', () => {
		opDomein('blaadje.app');
		startMeten();
		const script = document.querySelector('script') as HTMLScriptElement;
		expect(script.src).toContain('plausible.io');
		expect(script.async).toBe(true);
	});

	/* Dit is de regel die er ooit uitviel. Zonder plausible.o begint het script
	   nooit te meten, en er is niets aan te zien. */
	it('zet de opties klaar waar het script ze zoekt', () => {
		opDomein('blaadje.app');
		startMeten();
		expect(window.plausible?.o).toEqual({});
	});

	it('laadt het script niet twee keer', () => {
		opDomein('blaadje.app');
		startMeten();
		startMeten();
		expect(document.querySelectorAll('script')).toHaveLength(1);
	});

	it('ruimt het script op als je weggaat', () => {
		opDomein('blaadje.app');
		const stop = startMeten();
		stop();
		expect(document.querySelector('script')).toBeNull();
	});

	/* Gebeurtenissen die nog in de wachtrij komen omdat het script er nog niet is. */
	it('bewaart een melding tot het script er is', () => {
		opDomein('blaadje.app');
		startMeten();
		meld('App geopend');
		expect(window.plausible?.q).toEqual([['App geopend']]);
	});

	it('valt stil als er niet gemeten wordt', () => {
		opDomein('localhost');
		expect(() => meld('App geopend')).not.toThrow();
	});
});
