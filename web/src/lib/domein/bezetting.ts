import { groepVan, liniesIn, LINIES, plekken } from './formaties';
import type { Linie, Speler } from './types';

export interface LinieBezetting {
	linie: Linie;
	naam: string;
	/** hoeveel spelers je voor deze linie hebt gemarkeerd */
	spelers: number;
	/** hoeveel plekken de formatie er heeft */
	plekken: number;
}

/**
 * Hoeveel spelers je per linie hebt tegenover hoeveel plekken je formatie heeft.
 * Zo zie je zonder tellen dat zeven middenvelders voor drie plekken scheef is.
 *
 * Keepers tellen apart: keepen is een kunnen, geen plek in het veld.
 */
export function bezetting(spelers: Speler[], formatie: string): LinieBezetting[] {
	const plekkenPerLinie: Record<string, number> = {};
	plekken(formatie).forEach((p) => {
		plekkenPerLinie[p[4]] = (plekkenPerLinie[p[4]] ?? 0) + 1;
	});

	return liniesIn(formatie).map((linie) => ({
		linie,
		naam: LINIES[linie],
		spelers:
			linie === 'K'
				? spelers.filter((p) => p.keept).length
				: spelers.filter((p) => groepVan(p) === linie).length,
		plekken: plekkenPerLinie[linie] ?? 0
	}));
}

/** Te weinig voor deze linie: dan krijg je hem niet eens vol. */
export function tekort(b: LinieBezetting): boolean {
	return b.spelers < b.plekken;
}

/**
 * Ruim meer dan twee keer zoveel spelers als plekken. Dan zit er structureel
 * iemand op de bank die zichzelf in die linie ziet.
 */
export function gedrang(b: LinieBezetting): boolean {
	return b.plekken > 0 && b.spelers > b.plekken * 2;
}
