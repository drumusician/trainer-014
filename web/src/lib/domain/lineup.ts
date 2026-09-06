import { LINES, positionsOf } from './formations';
import type { Line, Lineup, Player } from './types';

/**
 * De opstelling als tekst, om naar een mede-trainer te sturen. Per linie op één
 * regel, met de plek erachter waar dat iets toevoegt.
 */
export function opstellingTekst(formation: string, lineup: Lineup, bench: string[], players: Player[]): string {
	const name = (id?: string | null) => players.find((p) => p.id === id)?.name;
	const regels: string[] = ['Opstelling ' + formation];

	(['K', 'V', 'M', 'A'] as Line[]).forEach((line) => {
		const names = positionsOf(formation)
			.filter((p) => p[4] === line)
			.map((p) => {
				const n = name(lineup[p[0]]);
				return n ? (line === 'K' ? n : n + ' (' + p[1] + ')') : null;
			})
			.filter(Boolean);
		if (names.length) regels.push(LINES[line] + ': ' + names.join(', '));
	});

	const opDeBank = bench.map((id) => name(id)).filter(Boolean);
	if (opDeBank.length) regels.push('Bank: ' + opDeBank.join(', '));
	return regels.join('\n');
}

export interface Omgezet {
	lineup: Lineup;
	bench: string[];
	/** wie er niet meer paste en naar de bank ging */
	afgevallen: string[];
}

/**
 * Een opstelling meenemen naar een andere formatie. Eerst blijft iedereen staan
 * op een plek die in beide formaties bestaat; daarna vullen we de resterende
 * plekken met spelers uit dezelfde linie. Wie dan nog over is, gaat naar de bank.
 *
 * Van 4-3-3 naar 4-4-2 betekent dat je vier verdedigers en je keeper gewoon
 * blijven staan, en dat er van je drie aanvallers eentje op de bank komt.
 */
export function convertLineup(
	lineup: Lineup,
	vanFormatie: string,
	naarFormatie: string,
	bench: string[] = []
): Omgezet {
	const oudePlekken = positionsOf(vanFormatie);
	const nieuwePlekken = positionsOf(naarFormatie);
	const nieuw: Lineup = {};
	const vrij: { player: string; line: string }[] = [];

	/* stap 1: plekken die in beide formaties bestaan houden hun speler */
	const nieuweIds = new Set(nieuwePlekken.map((p) => p[0]));
	oudePlekken.forEach(([plekId, , , , line]) => {
		const player = lineup[plekId];
		if (!player) return;
		if (nieuweIds.has(plekId)) nieuw[plekId] = player;
		else vrij.push({ player, line });
	});

	/* stap 2: de rest verdelen over lege plekken van dezelfde linie */
	nieuwePlekken.forEach(([plekId, , , , line]) => {
		if (nieuw[plekId]) return;
		const i = vrij.findIndex((v) => v.line === line);
		if (i >= 0) nieuw[plekId] = vrij.splice(i, 1)[0].player;
	});

	const afgevallen = vrij.map((v) => v.player);
	return {
		lineup: nieuw,
		bench: [...bench.filter((id) => !Object.values(nieuw).includes(id)), ...afgevallen],
		afgevallen
	};
}
