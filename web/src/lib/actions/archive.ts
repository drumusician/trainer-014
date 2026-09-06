import type { ArchivedMatch, MatchEvent, State } from '$lib/domain/types';

/**
 * Een bewaarde wedstrijd bijwerken.
 *
 * Alleen de score is hier te veranderen, en dat is met opzet: doelpunten raken
 * de tijdrekening niet aan. Wissels en ruilen blijven staan, want daar hangt de
 * speeltijd aan en die kan een verkeerde lijst niet als fout herkennen — hij
 * gaat dan gokken en levert geloofwaardige, verkeerde minuten.
 */

/** De stand volgt uit de doelpunten, dus na elke wijziging opnieuw tellen. */
export function recountScore(a: ArchivedMatch) {
	a.stand = [
		a.gebeurtenissen.filter((g) => g.type === 'goal').length,
		a.gebeurtenissen.filter((g) => g.type === 'tegen').length
	];
}

/** Datum, tegenstander, thuis of uit. De cijfers blijven zoals ze waren. */
export function wijzig(
	t: State,
	i: number,
	velden: Partial<Pick<ArchivedMatch, 'datum' | 'tegenstander' | 'thuis'>>
): boolean {
	const a = t.archief[i];
	if (!a) return false;
	Object.assign(a, velden);
	return true;
}

export function setNote(t: State, i: number, notitie: string): boolean {
	const a = t.archief[i];
	if (!a) return false;
	a.notitie = notitie;
	return true;
}

export function verwijderWedstrijd(t: State, i: number) {
	t.archief.splice(i, 1);
}

/** Een doelpunt weghalen dat er niet was. */
export function removeGoal(t: State, i: number, index: number): boolean {
	const a = t.archief[i];
	const g = a?.gebeurtenissen[index];
	if (!a || !g || (g.type !== 'goal' && g.type !== 'tegen')) return false;
	a.gebeurtenissen.splice(index, 1);
	recountScore(a);
	return true;
}

/** Een doelpunt dat je miste, op de goede minuut ertussen. */
export function addGoal(t: State, i: number, minuut: number, spelerId: string | null, tegen = false): boolean {
	const a = t.archief[i];
	if (!a) return false;
	const gebeurtenis: MatchEvent = tegen
		? { type: 'tegen', t: Math.max(0, Math.round(minuut * 60)) }
		: { type: 'goal', t: Math.max(0, Math.round(minuut * 60)), speler: spelerId };
	a.gebeurtenissen = [...a.gebeurtenissen, gebeurtenis].sort((x, y) => (x.t ?? 0) - (y.t ?? 0));
	recountScore(a);
	return true;
}
