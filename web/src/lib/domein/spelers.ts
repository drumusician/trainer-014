import { presentie, type Presentie } from './presentie';
import { seizoenTotalen } from './seizoen';
import type { ArchiefWedstrijd, Speler, Training } from './types';

export interface SpelerRegel {
	id: string;
	naam: string;
	linie: string;
	keept: boolean;
	assists: number;
	/** speeltijd over alle bewaarde wedstrijden */
	seconden: number;
	/** waarvan in het doel */
	keeper: number;
	wedstrijden: number;
	doelpunten: number;
	presentie: Presentie;
	/** presentie over de laatste vier trainingen */
	recent: Presentie;
}

export type Sortering = 'naam' | 'minuten' | 'presentie' | 'doelpunten';

/** Alles wat je van een speler weet, op één regel. */
export function spelersOverzicht(
	spelers: Speler[],
	archief: ArchiefWedstrijd[],
	trainingen: Training[]
): SpelerRegel[] {
	const totalen = seizoenTotalen(archief, spelers);
	const assists: Record<string, number> = {};
	archief.forEach((a) =>
		(a.gebeurtenissen ?? []).forEach((g) => {
			if (g.type === 'goal' && g.assist) assists[g.assist] = (assists[g.assist] ?? 0) + 1;
		})
	);
	return spelers.map((p) => {
		const rij = totalen.find((r) => r.naam === p.naam);
		return {
			id: p.id,
			naam: p.naam,
			linie: p.linie,
			keept: !!p.keept,
			seconden: rij?.seconden ?? 0,
			keeper: rij?.keeper ?? 0,
			wedstrijden: rij?.wedstrijden ?? 0,
			doelpunten: rij?.doelpunten ?? 0,
			assists: assists[p.id] ?? 0,
			presentie: presentie(trainingen, p.id, 0),
			recent: presentie(trainingen, p.id, 4)
		};
	});
}

export function sorteer(rijen: SpelerRegel[], hoe: Sortering): SpelerRegel[] {
	/* Wie nog geen training had, hoort niet bovenaan een lijstje over presentie. */
	const deel = (p: Presentie) => (p.totaal ? p.er / p.totaal : 2);
	return [...rijen].sort((a, b) => {
		if (hoe === 'minuten') return b.seconden - a.seconden || a.naam.localeCompare(b.naam);
		if (hoe === 'doelpunten')
			return b.doelpunten - a.doelpunten || b.assists - a.assists || b.seconden - a.seconden || a.naam.localeCompare(b.naam);
		if (hoe === 'presentie') return deel(a.presentie) - deel(b.presentie) || a.naam.localeCompare(b.naam);
		return a.naam.localeCompare(b.naam);
	});
}

/** Percentage aanwezig, of null als er nog geen training geweest is. */
export function percentage(p: Presentie): number | null {
	return p.totaal ? Math.round((p.er / p.totaal) * 100) : null;
}
