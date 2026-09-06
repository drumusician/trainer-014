import { beforeEach, describe, expect, it } from 'vitest';
import { app } from './store.svelte';
import { emptyState } from './domain/types';
import { playingTimes, keeperTimes, elapsed } from './domain/time';
import { readBackup } from './domain/backup';
import { readTransferCode } from './domain/transfer';
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
		expect(app.toestand.players.length).toBe(16);
		expect(app.toestand.archive.length).toBe(1);
		expect(app.toestand.teamName).toBe('JO13-1');
	});

	it('rekent de bewaarde wedstrijd na uit zijn eigen gegevens', () => {
		zetKlaar();
		const a = app.toestand.archive[0];
		const players = app.toestand.players;

		const w = {
			...a,
			lineup: a.lineup!,
			bench: a.bench ?? [],
			elapsed: a.duration,
			since: null,
			running: false,
			part: a.parts ?? 2,
			inBreak: false,
			finished: true
		} as unknown as Parameters<typeof playingTimes>[0];

		const tijden = playingTimes(w, players);
		const totaal = Object.values(tijden).reduce((s, x) => s + x, 0);
		/* Elf spelers in het veld, elke seconde van de wedstrijd. */
		expect(Math.round(totaal)).toBe(11 * a.duration);

		/* En op elk moment precies één keeper, geen seconde dubbel of leeg. */
		const keepers = keeperTimes(w);
		expect(Math.round(Object.values(keepers).reduce((s, x) => s + x, 0))).toBe(a.duration);
	});

	it('geeft dezelfde speeltijd als toen hij bewaard werd', () => {
		zetKlaar();
		const a = app.toestand.archive[0];
		const w = {
			...a,
			lineup: a.lineup!,
			bench: a.bench ?? [],
			elapsed: a.duration,
			since: null,
			running: false,
			part: a.parts ?? 2,
			inBreak: false,
			finished: true
		} as unknown as Parameters<typeof playingTimes>[0];
		const tijden = playingTimes(w, app.toestand.players);
		for (const regel of a.playingTime) {
			expect(Math.round(tijden[regel.id!])).toBe(regel.seconds);
		}
	});

	/* Dit is de test die NaN:NaN gevangen zou hebben. */
	it('leest de klok van een wedstrijd die nog loopt', () => {
		const met = JSON.parse(JSON.stringify(opgeslagen));
		met.match = {
			date: '2026-09-06',
			opponent: 'Testclub',
			home: true,
			formation: met.formation,
			lineup: {},
			bench: [],
			events: [{ type: 'start', t: 0 }],
			elapsed: 1234,
			since: null,
			running: false,
			parts: 2,
			part: 1,
			inBreak: false,
			finished: false,
			absent: []
		};
		localStorage.setItem('o14-app-v1', JSON.stringify(met));
		app.load();
		expect(Number.isFinite(elapsed(app.match!, Date.now()))).toBe(true);
		expect(Math.round(elapsed(app.match!, Date.now()))).toBe(1234);
	});
});

describe('oude gegevens die van buiten binnenkomen', () => {
	/* Drie wegen naar binnen, en alle drie kunnen ze iets van voor de vertaling
	   aanleveren: een back-upbestand dat iemand bewaarde, een overzetcode van een
	   toestel dat nog niet is bijgewerkt, en de server. */
	it('leest een back-upbestand van voor de vertaalslag', () => {
		const bestand = JSON.stringify({ blaadje: 1, gemaakt: '2026-09-06T10:00:00.000Z', toestand: opgeslagen });
		const terug = readBackup(bestand);
		expect(terug.players.length).toBe(16);
		expect(terug.teamName).toBe('JO13-1');
		expect(terug.archive.length).toBe(1);
		expect(terug.archive[0].duration).toBeGreaterThan(0);
	});

	it('leest een overzetcode van voor de vertaalslag', () => {
		const pakket = readTransferCode(JSON.stringify(opgeslagen));
		expect(pakket.players?.length).toBe(16);
		expect(pakket.teamName).toBe('JO13-1');
	});

	it('neemt een syncpakket van voor de vertaalslag over', () => {
		app.toestand = emptyState();
		const gelukt = app.adoptSyncPayload(opgeslagen as never);
		expect(gelukt).toBe(true);
		expect(app.toestand.players.length).toBe(16);
		expect(app.toestand.teamName).toBe('JO13-1');
		expect(app.toestand.archive.length).toBe(1);
	});

	it('schrijft na het lezen het nieuwe formaat terug', () => {
		zetKlaar();
		const opnieuw = JSON.parse(localStorage.getItem('o14-app-v1')!);
		expect(opnieuw).toHaveProperty('teamName');
		expect(opnieuw).not.toHaveProperty('teamnaam');
		expect(opnieuw.archive[0]).toHaveProperty('duration');
	});
});
