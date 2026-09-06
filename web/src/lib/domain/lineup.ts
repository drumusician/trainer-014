import { LINES, positionsOf } from './formations';
import type { Line, Lineup, Player } from './types';

/**
 * The lineup as text, to send to a fellow coach. One line per line of the pitch,
 * with the position appended where that adds something.
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
	/** who no longer fitted and went to the bench */
	afgevallen: string[];
}

/**
 * Carry a lineup over to another formation. First everyone stays in a position
 * that exists in both formations; then we fill the remaining positions with
 * players from the same line. Whoever is left over goes to the bench.
 *
 * From 4-3-3 to 4-4-2 that means your four defenders and your keeper simply stay
 * put, and one of your three forwards ends up on the bench.
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

	/* step 1: positions that exist in both formations keep their player */
	const nieuweIds = new Set(nieuwePlekken.map((p) => p[0]));
	oudePlekken.forEach(([plekId, , , , line]) => {
		const player = lineup[plekId];
		if (!player) return;
		if (nieuweIds.has(plekId)) nieuw[plekId] = player;
		else vrij.push({ player, line });
	});

	/* step 2: spread the rest over empty positions in the same line */
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
