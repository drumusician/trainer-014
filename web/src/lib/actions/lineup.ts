import { FORMATIONS } from '$lib/domain/formations';
import { convertLineup } from '$lib/domain/lineup';
import type { DefaultLineup, State, Match } from '$lib/domain/types';

/**
 * Opstellen buiten een lopende wedstrijd om: de standaardopstelling, en het
 * schuiven voor de aftrap.
 *
 * Deze functies raken de gebeurtenissenlijst niet aan. Wat tijdens een wedstrijd
 * gebeurt hoort daar wél in en staat daarom niet hier maar in de winkel zelf.
 */

/** Waar je aan het opstellen bent: de wedstrijd van vandaag of de standaard. */
export type Bron = 'wedstrijd' | 'standaard';

export function doelVan(t: State, bron: Bron): Match | DefaultLineup | null {
	return bron === 'standaard' ? t.defaultLineup : t.match;
}

/** Zorgt dat er een standaard is die klopt met de selectie en de formatie. */
export function ensureDefaultLineup(t: State): DefaultLineup {
	if (!t.defaultLineup) t.defaultLineup = { formation: t.formation, lineup: {}, bench: [] };
	const st = t.defaultLineup;
	if (!FORMATIONS[st.formation]) st.formation = t.formation;
	moveDefaultToFormation(t, t.formation);
	const ids = t.players.map((p) => p.id);
	for (const position of Object.keys(st.lineup)) {
		if (!ids.includes(st.lineup[position] as string)) delete st.lineup[position];
	}
	const inVeld = Object.values(st.lineup).filter(Boolean) as string[];
	st.bench = ids.filter((id) => !inVeld.includes(id));
	return st;
}

/** Twee plekken omwisselen. Is er een leeg, dan verhuist die ene ernaartoe. */
export function swapPositions(t: State, bron: Bron, positionA: string, positionB: string): boolean {
	const doel = doelVan(t, bron);
	if (!doel || positionA === positionB) return false;
	const a = doel.lineup[positionA] ?? null;
	const b = doel.lineup[positionB] ?? null;
	if (!a && !b) return false;
	doel.lineup[positionA] = b;
	doel.lineup[positionB] = a;
	return true;
}

/** Iemand van het veld halen zonder dat er meteen een ander in komt. */
export function takeOffPitch(t: State, bron: Bron, position: string): boolean {
	const doel = doelVan(t, bron);
	const id = doel?.lineup[position];
	if (!doel || !id) return false;
	doel.lineup[position] = null;
	if (!doel.bench.includes(id)) doel.bench.push(id);
	return true;
}

/** Iemand op de gekozen plek zetten; wie daar stond gaat naar de bank. */
export function zetOpPlekInOpzet(t: State, bron: Bron, position: string, spelerId: string): boolean {
	const doel = doelVan(t, bron);
	if (!doel) return false;
	const oud = doel.lineup[position];
	doel.lineup[position] = spelerId;
	doel.bench = doel.bench.filter((x) => x !== spelerId);
	if (oud) doel.bench.push(oud);
	return true;
}

/**
 * De standaardopstelling meenemen naar een andere formatie. Wie op een plek
 * staat die ook in de nieuwe formatie bestaat blijft staan; de rest schuift door
 * binnen zijn eigen linie. Wat niet past gaat naar de bank, en plekken die
 * overblijven laten we leeg: die vult de trainer zelf.
 */
export function moveDefaultToFormation(t: State, formation: string): boolean {
	const st = t.defaultLineup;
	if (!st || st.formation === formation || !FORMATIONS[formation]) return false;
	const uit = convertLineup(st.lineup, st.formation, formation, st.bench);
	st.formation = formation;
	st.lineup = uit.lineup;
	st.bench = uit.bench;
	return true;
}

/**
 * De formatie van het team. Er is er maar één: je standaardopstelling staat erin
 * en je volgende wedstrijd begint ermee. Waar je hem ook omzet, hij verhuist mee.
 */
export function chooseFormation(t: State, formation: string): boolean {
	if (!FORMATIONS[formation]) return false;
	t.formation = formation;
	moveDefaultToFormation(t, formation);
	return true;
}

export function clearDefaultLineup(t: State) {
	t.defaultLineup = null;
}
