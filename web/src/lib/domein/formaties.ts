import type { Linie, Speler } from './types';

/** [plek-id, label op het veld, x in %, y in %, linie] */
export type Plek = [string, string, number, number, Linie];

/* De aanval staat boven, de keeper onder. De x-waarden staan zo ver uit elkaar
   dat de naambolletjes elkaar ook op een kleine telefoon niet raken. */
export const FORMATIES: Record<string, Plek[]> = {
	'4-3-3': [
		['K', 'K', 50, 92, 'K'],
		['RV', 'RV', 88, 73, 'V'], ['CVr', 'CV', 64, 79, 'V'], ['CVl', 'CV', 36, 79, 'V'], ['LV', 'LV', 12, 73, 'V'],
		['MR', 'M', 75, 55, 'M'], ['MC', 'M', 50, 61, 'M'], ['ML', 'M', 25, 55, 'M'],
		['RB', 'RB', 80, 26, 'A'], ['SP', 'SP', 50, 18, 'A'], ['LB', 'LB', 20, 26, 'A']
	],
	'4-4-2': [
		['K', 'K', 50, 92, 'K'],
		['RV', 'RV', 88, 75, 'V'], ['CVr', 'CV', 64, 80, 'V'], ['CVl', 'CV', 36, 80, 'V'], ['LV', 'LV', 12, 75, 'V'],
		['MR', 'RM', 88, 51, 'M'], ['MCr', 'M', 63, 57, 'M'], ['MCl', 'M', 37, 57, 'M'], ['ML', 'LM', 12, 51, 'M'],
		['SPr', 'SP', 62, 22, 'A'], ['SPl', 'SP', 38, 22, 'A']
	],
	'4-2-3-1': [
		['K', 'K', 50, 92, 'K'],
		['RV', 'RV', 88, 75, 'V'], ['CVr', 'CV', 64, 80, 'V'], ['CVl', 'CV', 36, 80, 'V'], ['LV', 'LV', 12, 75, 'V'],
		['VMr', 'VM', 64, 62, 'M'], ['VMl', 'VM', 36, 62, 'M'],
		['RA', 'RA', 84, 38, 'A'], ['TIEN', '10', 50, 43, 'A'], ['LA', 'LA', 16, 38, 'A'],
		['SP', 'SP', 50, 18, 'A']
	]
};

export const LINIES: Record<Linie, string> = {
	A: 'Aanval',
	M: 'Middenveld',
	V: 'Verdediging',
	K: 'Keeper',
	'': 'Zonder linie'
};

/** Van boven naar beneden, net als op het veld. */
export const LINIEVOLGORDE: Linie[] = ['A', 'M', 'V', 'K', ''];

export function plekken(formatie: string): Plek[] {
	return FORMATIES[formatie] ?? FORMATIES['4-3-3'];
}

export function plekLinie(plekId: string, formatie: string): Linie {
	return plekken(formatie).find((p) => p[0] === plekId)?.[4] ?? '';
}

export function kanKeepen(p: Speler): boolean {
	return !!p.keept;
}

/** In welk bankgroepje hoort iemand: zijn veldlinie, of Keeper als hij alleen keept. */
export function groepVan(p: Speler): Linie {
	if (p.linie === 'V' || p.linie === 'M' || p.linie === 'A') return p.linie;
	return p.keept ? 'K' : '';
}
