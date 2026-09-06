import { groupOf, linesIn, LINES, positionsOf } from './formations';
import type { Line, Player } from './types';

export interface LineCoverage {
	line: Line;
	name: string;
	/** how many players you marked for this line */
	players: number;
	/** how many positions the formation has for it */
	positionsOf: number;
}

/**
 * How many players you have per line against how many positions your formation
 * offers. That way you see without counting that seven midfielders for three
 * positions is lopsided.
 *
 * Keepers count separately: keeping is an ability, not a position on the pitch.
 */
export function bezetting(players: Player[], formation: string): LineCoverage[] {
	const plekkenPerLinie: Record<string, number> = {};
	positionsOf(formation).forEach((p) => {
		plekkenPerLinie[p[4]] = (plekkenPerLinie[p[4]] ?? 0) + 1;
	});

	return linesIn(formation).map((line) => ({
		line,
		name: LINES[line],
		players: line === 'K' ? players.filter((p) => p.keeper).length : players.filter((p) => groupOf(p) === line).length,
		positionsOf: plekkenPerLinie[line] ?? 0
	}));
}

/** Too few for this line: you cannot even fill it. */
export function tekort(b: LineCoverage): boolean {
	return b.players < b.positionsOf;
}

/**
 * Well over twice as many players as positions. Then someone who sees themselves
 * in that line is structurally on the bench.
 *
 * Does not apply to the keeper: keeping is an ability, not a position on the
 * pitch. Four players who can keep is not a crowd but exactly what you want,
 * because then you can rotate and are not stuck when one is ill.
 */
export function gedrang(b: LineCoverage): boolean {
	return b.line !== 'K' && b.positionsOf > 0 && b.players > b.positionsOf * 2;
}

/** One keeper is enough until the day he is not there. */
export function dunneKeepersbezetting(rijen: LineCoverage[]): boolean {
	const k = rijen.find((b) => b.line === 'K');
	return !!k && k.players === 1;
}
