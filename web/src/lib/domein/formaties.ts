import type { Linie, Speler } from './types';

/** [plek-id, label op het veld, x in %, y in %, linie] */
export type Plek = [string, string, number, number, Linie];

/**
 * Formaties per speelvorm. De app rekent nergens met een vast aantal spelers:
 * hoeveel er op het veld staan volgt uit de lijst plekken hieronder. Zo werkt
 * hetzelfde scherm voor 11 tegen 11 als voor de kleintjes.
 *
 * De x-waarden staan ver genoeg uit elkaar dat de naambolletjes elkaar ook op
 * een kleine telefoon niet raken. Verander je die, kijk dan of de breedste
 * linie nog past.
 */
export const FORMATIES: Record<string, Plek[]> = {
	/* ---------- 11 tegen 11 ---------- */
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
	],

	/* ---------- 8 tegen 8 ---------- */
	'1-3-3-1': [
		['K', 'K', 50, 91, 'K'],
		['RV', 'RV', 80, 74, 'V'], ['CV', 'CV', 50, 79, 'V'], ['LV', 'LV', 20, 74, 'V'],
		['MR', 'M', 78, 52, 'M'], ['MC', 'M', 50, 58, 'M'], ['ML', 'M', 22, 52, 'M'],
		['SP', 'SP', 50, 22, 'A']
	],
	'1-3-2-2': [
		['K', 'K', 50, 91, 'K'],
		['RV', 'RV', 80, 76, 'V'], ['CV', 'CV', 50, 81, 'V'], ['LV', 'LV', 20, 76, 'V'],
		['MR', 'M', 70, 55, 'M'], ['ML', 'M', 30, 55, 'M'],
		['SPr', 'SP', 66, 24, 'A'], ['SPl', 'SP', 34, 24, 'A']
	],
	'1-2-3-2': [
		['K', 'K', 50, 91, 'K'],
		['RV', 'RV', 70, 78, 'V'], ['LV', 'LV', 30, 78, 'V'],
		['MR', 'M', 80, 54, 'M'], ['MC', 'M', 50, 60, 'M'], ['ML', 'M', 20, 54, 'M'],
		['SPr', 'SP', 66, 24, 'A'], ['SPl', 'SP', 34, 24, 'A']
	],

	/* ---------- 6 tegen 6 ---------- */
	'1-2-2-1': [
		['K', 'K', 50, 90, 'K'],
		['RV', 'RV', 70, 73, 'V'], ['LV', 'LV', 30, 73, 'V'],
		['MR', 'M', 70, 49, 'M'], ['ML', 'M', 30, 49, 'M'],
		['SP', 'SP', 50, 24, 'A']
	],
	'1-1-3-1': [
		['K', 'K', 50, 90, 'K'],
		['CV', 'CV', 50, 75, 'V'],
		['MR', 'M', 78, 51, 'M'], ['MC', 'M', 50, 57, 'M'], ['ML', 'M', 22, 51, 'M'],
		['SP', 'SP', 50, 22, 'A']
	],
	'1-2-1-2': [
		['K', 'K', 50, 90, 'K'],
		['RV', 'RV', 70, 75, 'V'], ['LV', 'LV', 30, 75, 'V'],
		['MC', 'M', 50, 54, 'M'],
		['SPr', 'SP', 66, 25, 'A'], ['SPl', 'SP', 34, 25, 'A']
	],

	/* ---------- 4 tegen 4, zonder keeper ---------- */
	'1-2-1': [
		['V', 'V', 50, 80, 'V'],
		['MR', 'M', 72, 52, 'M'], ['ML', 'M', 28, 52, 'M'],
		['SP', 'SP', 50, 22, 'A']
	],
	'2-2': [
		['RV', 'RV', 68, 76, 'V'], ['LV', 'LV', 32, 76, 'V'],
		['SPr', 'SP', 66, 28, 'A'], ['SPl', 'SP', 34, 28, 'A']
	]
};

/**
 * Welke formaties bij welke speelvorm horen, in de volgorde van het menu.
 *
 * In de jeugd schrijf je de keeper mee in de naam (1-3-3-1 voor 8 tegen 8);
 * bij 11 tegen 11 doe je dat niet (4-3-3). Dat is verwarrend, maar het is hoe
 * trainers het zeggen, dus houden we het aan.
 */
export const SPEELVORMEN: { naam: string; uitleg?: string; formaties: { sleutel: string; uitleg?: string }[] }[] = [
	{
		naam: '11 tegen 11',
		formaties: [{ sleutel: '4-3-3' }, { sleutel: '4-4-2' }, { sleutel: '4-2-3-1' }]
	},
	{
		naam: '8 tegen 8',
		formaties: [
			{ sleutel: '1-3-3-1', uitleg: 'meest gespeeld' },
			{ sleutel: '1-3-2-2' },
			{ sleutel: '1-2-3-2' }
		]
	},
	{
		naam: '6 tegen 6',
		formaties: [
			{ sleutel: '1-2-2-1', uitleg: 'meest gespeeld' },
			{ sleutel: '1-1-3-1' },
			{ sleutel: '1-2-1-2' }
		]
	},
	{
		naam: '4 tegen 4',
		uitleg: 'zonder keeper',
		formaties: [{ sleutel: '1-2-1', uitleg: 'ruit' }, { sleutel: '2-2', uitleg: 'blok' }]
	}
];

/** Alle formatienamen, in menuvolgorde. */
export function alleFormaties(): string[] {
	return SPEELVORMEN.flatMap((s) => s.formaties.map((f) => f.sleutel));
}

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

/** Hoeveel spelers er in deze formatie op het veld staan. */
export function aantalPlekken(formatie: string): number {
	return plekken(formatie).length;
}

/** Welke linies in deze formatie voorkomen. Bij 4 tegen 4 is dat geen keeper. */
export function liniesIn(formatie: string): Linie[] {
	const gevonden = new Set(plekken(formatie).map((p) => p[4]));
	return LINIEVOLGORDE.filter((l) => l && gevonden.has(l));
}

/** Bij welke speelvorm hoort deze formatie. */
export function speelvormVan(formatie: string): string {
	return SPEELVORMEN.find((s) => s.formaties.some((f) => f.sleutel === formatie))?.naam ?? '';
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
