import type { ArchivedMatch, MatchEvent, State } from '$lib/domain/types';

/**
 * Amending an archived match.
 *
 * Only the score can be changed here, and that is deliberate: goals do not touch
 * the time calculation at all. Substitutions and swaps stay put, because playing
 * time hangs off them — and the calculation cannot recognise a wrong list as
 * wrong. It starts guessing instead, and returns believable, incorrect minutes.
 */

/** The score follows from the goals, so recount after every change. */
export function recountScore(a: ArchivedMatch) {
	a.score = [a.events.filter((g) => g.type === 'goal').length, a.events.filter((g) => g.type === 'conceded').length];
}

/** Date, opponent, home or away. The numbers stay as they were. */
export function wijzig(
	t: State,
	i: number,
	velden: Partial<Pick<ArchivedMatch, 'date' | 'opponent' | 'home'>>
): boolean {
	const a = t.archive[i];
	if (!a) return false;
	Object.assign(a, velden);
	return true;
}

export function setNote(t: State, i: number, note: string): boolean {
	const a = t.archive[i];
	if (!a) return false;
	a.note = note;
	return true;
}

export function verwijderWedstrijd(t: State, i: number) {
	t.archive.splice(i, 1);
}

/** Remove a goal that never happened. */
export function removeGoal(t: State, i: number, index: number): boolean {
	const a = t.archive[i];
	const g = a?.events[index];
	if (!a || !g || (g.type !== 'goal' && g.type !== 'conceded')) return false;
	a.events.splice(index, 1);
	recountScore(a);
	return true;
}

/** A goal you missed, slotted in at the right minute. */
export function addGoal(t: State, i: number, minuut: number, spelerId: string | null, tegen = false): boolean {
	const a = t.archive[i];
	if (!a) return false;
	const gebeurtenis: MatchEvent = tegen
		? { type: 'conceded', t: Math.max(0, Math.round(minuut * 60)) }
		: { type: 'goal', t: Math.max(0, Math.round(minuut * 60)), player: spelerId };
	a.events = [...a.events, gebeurtenis].sort((x, y) => (x.t ?? 0) - (y.t ?? 0));
	recountScore(a);
	return true;
}
