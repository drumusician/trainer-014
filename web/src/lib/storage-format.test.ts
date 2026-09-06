import { beforeEach, describe, expect, it } from 'vitest';
import { app } from './store.svelte';
import { emptyState } from './domain/types';
import { playingTimes, keeperTimes, elapsed } from './domain/time';
import { readBackup } from './domain/backup';
import { readTransferCode } from './domain/transfer';
import { clearIssues, issues } from './issues.svelte';
import opgeslagen from '../test/opslag-september-2026.json';

/**
 * Can the app read what was stored in September 2026?
 *
 * This file is a real export of a real season, with invented names in it. The
 * structure is untouched, because that is what matters.
 *
 * Why this exists: while renaming to English, "verstreken" turned out to be both
 * a function name and a stored field name. I renamed both, and the app read
 * w.elapsed while storage held verstreken. The clock showed NaN:NaN. All 172
 * tests stayed green, because a test builds its own objects and never reads real
 * storage. This test closes that gap.
 *
 * Change the storage format and you change what sits on someone else's device.
 * A migration belongs with that change, and this test stays green.
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
		/* Eleven players on the pitch, every second of the match. */
		expect(Math.round(totaal)).toBe(11 * a.duration);

		/* And exactly one keeper at every moment, not a second doubled or empty. */
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
	/* Three ways in, and all three can deliver something from before the
	   translation: a backup file someone saved, a transfer code from a device that
	   has not been updated, and the server. */
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

describe('opslag die we niet kunnen lezen', () => {
	/*
	 * Dit is de gevaarlijkste weg die er is, en hij is niet theoretisch: een
	 * toestel dat nog oudere code draait leest de omgezette opslag niet, start
	 * leeg, en schrijft die lege staat bij de eerste tik over het seizoen heen.
	 * Onleesbaar mag nooit betekenen: overschrijven.
	 */
	it('gooit een seizoen niet weg als het formaat onbekend is', () => {
		localStorage.setItem('o14-app-v1', JSON.stringify({ eenNieuwerFormaat: true, spullen: [1, 2, 3] }));
		app.toestand = emptyState();
		app.load();

		/* De app start leeg — dat mag — maar wat er stond moet te redden zijn. */
		app.setTeamName('Iets anders'); /* een gewone actie, die bewaart */
		const apart = localStorage.getItem('o14-app-v1-onleesbaar');
		expect(apart).toContain('eenNieuwerFormaat');
	});

	it('meldt het ook, zodat je het achteraf kunt zien', () => {
		clearIssues();
		localStorage.setItem('o14-app-v1', JSON.stringify({ eenNieuwerFormaat: true }));
		app.toestand = emptyState();
		app.load();
		expect(issues.lijst.some((p) => p.what.includes('apart gezet'))).toBe(true);
	});
});
