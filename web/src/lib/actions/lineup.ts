import { FORMATIONS } from '$lib/domain/formations';
import { convertLineup } from '$lib/domain/lineup';
import type { DefaultLineup, State, Match } from '$lib/domain/types';

/**
 * Picking a lineup outside a running match: the default lineup, and the
 * shuffling you do before kick-off.
 *
 * These functions never touch the event list. What happens during a match does
 * belong in that list, and therefore lives in the store rather than here.
 */

/** What you are picking: today's match, or the default lineup. */
export type Bron = 'wedstrijd' | 'standaard';

export function doelVan(t: State, bron: Bron): Match | DefaultLineup | null {
	return bron === 'standaard' ? t.defaultLineup : t.match;
}

/** Makes sure a default lineup exists that matches the squad and the formation. */
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

/** Swap two positions. If one is empty, the other player simply moves there. */
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

/** Take someone off the pitch without anyone coming on in their place. */
export function takeOffPitch(t: State, bron: Bron, position: string): boolean {
	const doel = doelVan(t, bron);
	const id = doel?.lineup[position];
	if (!doel || !id) return false;
	doel.lineup[position] = null;
	if (!doel.bench.includes(id)) doel.bench.push(id);
	return true;
}

/** Put someone in the chosen position; whoever stood there goes to the bench. */
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
 * Carry the default lineup over to another formation. Anyone in a position that
 * also exists in the new formation stays put; the rest shift along within their
 * own line. What does not fit goes to the bench, and positions left over stay
 * empty: the coach fills those in.
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
 * The team's formation. There is only one: your default lineup is in it and your
 * next match starts from it. Wherever you change it, it moves along.
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
