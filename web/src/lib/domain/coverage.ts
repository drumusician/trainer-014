import { groupOf, linesIn, LINES, positionsOf } from './formations';
import type { Line, Player } from './types';

export interface LineCoverage {
	linie: Line;
	naam: string;
	/** hoeveel spelers je voor deze linie hebt gemarkeerd */
	spelers: number;
	/** hoeveel plekken de formatie er heeft */
	positionsOf: number;
}

/**
 * Hoeveel spelers je per linie hebt tegenover hoeveel plekken je formatie heeft.
 * Zo zie je zonder tellen dat zeven middenvelders voor drie plekken scheef is.
 *
 * Keepers tellen apart: keepen is een kunnen, geen plek in het veld.
 */
export function bezetting(spelers: Player[], formatie: string): LineCoverage[] {
	const plekkenPerLinie: Record<string, number> = {};
	positionsOf(formatie).forEach((p) => {
		plekkenPerLinie[p[4]] = (plekkenPerLinie[p[4]] ?? 0) + 1;
	});

	return linesIn(formatie).map((linie) => ({
		linie,
		naam: LINES[linie],
		spelers: linie === 'K' ? spelers.filter((p) => p.keept).length : spelers.filter((p) => groupOf(p) === linie).length,
		positionsOf: plekkenPerLinie[linie] ?? 0
	}));
}

/** Te weinig voor deze linie: dan krijg je hem niet eens vol. */
export function tekort(b: LineCoverage): boolean {
	return b.spelers < b.positionsOf;
}

/**
 * Ruim meer dan twee keer zoveel spelers als plekken. Dan zit er structureel
 * iemand op de bank die zichzelf in die linie ziet.
 *
 * Geldt niet voor de keeper: keepen is een kunnen en geen plek in het veld. Vier
 * spelers die kunnen keepen is geen gedrang maar precies wat je wilt, want dan
 * kun je rouleren en sta je niet stil als er eentje ziek is.
 */
export function gedrang(b: LineCoverage): boolean {
	return b.linie !== 'K' && b.positionsOf > 0 && b.spelers > b.positionsOf * 2;
}

/** Eén keeper is genoeg tot hij er een keer niet is. */
export function dunneKeepersbezetting(rijen: LineCoverage[]): boolean {
	const k = rijen.find((b) => b.linie === 'K');
	return !!k && k.spelers === 1;
}
