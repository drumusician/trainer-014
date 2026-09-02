import type { Training } from './types';

export interface Presentie {
	/** hoe vaak aanwezig */
	er: number;
	/** hoeveel trainingen meetellen */
	totaal: number;
}

/** Trainingen staan op datum, nieuwste eerst. */
export function sorteerTrainingen(trainingen: Training[]): Training[] {
	return [...trainingen].sort((a, b) => (b.datum ?? '').localeCompare(a.datum ?? ''));
}

/**
 * Presentie over de laatste n trainingen waar deze speler in stond.
 * n = 0 betekent alles.
 */
export function presentie(trainingen: Training[], spelerId: string, n = 0): Presentie {
	let er = 0;
	let totaal = 0;
	for (const t of trainingen) {
		if (n && totaal >= n) break;
		const st = t.status[spelerId];
		if (!st) continue;
		totaal++;
		if (st === 'ja') er++;
	}
	return { er, totaal };
}

/** Minder dan de helft van de laatste keren: dat is het gesprek waard. */
export function mager(p: Presentie): boolean {
	return p.totaal >= 2 && p.er * 2 < p.totaal;
}
