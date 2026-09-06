import { beforeEach, describe, expect, it } from 'vitest';
import { app } from './toestand.svelte';
import { emptyState } from './domein/types';
import { playingTimes, keeperTimes, elapsed } from './domein/tijd';
import opgeslagen from '../test/opslag-september-2026.json';

/**
 * Kan de app lezen wat er in september 2026 is opgeslagen?
 *
 * Dit bestand is een echte export van een echt seizoen, met verzonnen namen
 * erin. De structuur is onaangeraakt, want daar gaat het om.
 *
 * Waarom dit bestaat: bij het hernoemen naar het Engels bleek verstreken zowel
 * een functienaam als een veldnaam in de opslag te zijn. Ik hernoemde allebei,
 * en de app las w.elapsed terwijl er verstreken in de opslag staat. De klok gaf
 * NaN:NaN. Alle 172 tests bleven groen, want een test bouwt zijn eigen objecten
 * en leest nooit echte opslag. Dat gat dicht deze test.
 *
 * Wie het opslagformaat verandert, verandert wat er op het toestel van een
 * ander staat. Dan hoort hier een migratie bij, en blijft deze test groen.
 */
beforeEach(() => {
	localStorage.clear();
	app.toestand = emptyState();
});

function zetKlaar() {
	localStorage.setItem('o14-app-v1', JSON.stringify(opgeslagen));
	app.load();
}

describe('opslag van september 2026', () => {
	it('leest de selectie, het archief en de trainingen', () => {
		zetKlaar();
		expect(app.toestand.spelers.length).toBe(16);
		expect(app.toestand.archief.length).toBe(1);
		expect(app.toestand.teamnaam).toBe('JO13-1');
	});

	it('rekent de bewaarde wedstrijd na uit zijn eigen gegevens', () => {
		zetKlaar();
		const a = app.toestand.archief[0];
		const spelers = app.toestand.spelers;

		const w = {
			...a,
			opstelling: a.opstelling!,
			bank: a.bank ?? [],
			verstreken: a.duur,
			sinds: null,
			loopt: false,
			deel: a.delen ?? 2,
			pauze: false,
			afgelopen: true
		} as unknown as Parameters<typeof playingTimes>[0];

		const tijden = playingTimes(w, spelers);
		const totaal = Object.values(tijden).reduce((s, x) => s + x, 0);
		/* Elf spelers in het veld, elke seconde van de wedstrijd. */
		expect(Math.round(totaal)).toBe(11 * a.duur);

		/* En op elk moment precies één keeper, geen seconde dubbel of leeg. */
		const keepers = keeperTimes(w);
		expect(Math.round(Object.values(keepers).reduce((s, x) => s + x, 0))).toBe(a.duur);
	});

	it('geeft dezelfde speeltijd als toen hij bewaard werd', () => {
		zetKlaar();
		const a = app.toestand.archief[0];
		const w = {
			...a,
			opstelling: a.opstelling!,
			bank: a.bank ?? [],
			verstreken: a.duur,
			sinds: null,
			loopt: false,
			deel: a.delen ?? 2,
			pauze: false,
			afgelopen: true
		} as unknown as Parameters<typeof playingTimes>[0];
		const tijden = playingTimes(w, app.toestand.spelers);
		for (const regel of a.speeltijd) {
			expect(Math.round(tijden[regel.id!])).toBe(regel.seconden);
		}
	});

	/* Dit is de test die NaN:NaN gevangen zou hebben. */
	it('leest de klok van een wedstrijd die nog loopt', () => {
		const met = JSON.parse(JSON.stringify(opgeslagen));
		met.wedstrijd = {
			datum: '2026-09-06',
			tegenstander: 'Testclub',
			thuis: true,
			formatie: met.formatie,
			opstelling: {},
			bank: [],
			gebeurtenissen: [{ type: 'start', t: 0 }],
			verstreken: 1234,
			sinds: null,
			loopt: false,
			delen: 2,
			deel: 1,
			pauze: false,
			afgelopen: false,
			afwezig: []
		};
		localStorage.setItem('o14-app-v1', JSON.stringify(met));
		app.load();
		expect(Number.isFinite(elapsed(app.wedstrijd!, Date.now()))).toBe(true);
		expect(Math.round(elapsed(app.wedstrijd!, Date.now()))).toBe(1234);
	});
});
