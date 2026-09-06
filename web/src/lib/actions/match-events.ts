import * as klok from './clock';
import type { Match } from '$lib/domain/types';

/**
 * What happens during a match: substitutions, swaps, goals.
 *
 * Everything that changes the lineup also lands in the event list, and that is
 * not bookkeeping but the heart of it: playing time is derived from that list
 * and never typed in anywhere. Change the lineup without leaving an event
 * behind, and you rewrite the whole match retroactively.
 *
 * Before kick-off it is different: then you are simply picking a lineup, and
 * there is nothing yet to wind back to.
 */

/** Put someone from the bench into a position. During a match that is a substitution. */
export function putOnPosition(w: Match | null, nu: number, position: string, spelerId: string): boolean {
	if (!w) return false;
	const off = w.lineup[position];
	w.lineup[position] = spelerId;
	w.bench = w.bench.filter((x) => x !== spelerId);
	if (off) {
		w.bench.push(off);
		if (klok.kickedOff(w)) klok.log(w, nu, 'substitution', { off, on: spelerId, position });
	}
	return true;
}

/**
 * Two players on the pitch swap positions. Recorded, because otherwise the time
 * per position stops adding up.
 */
export function ruil(w: Match | null, nu: number, positionA: string, positionB: string): boolean {
	if (!w || positionA === positionB) return false;
	const a = w.lineup[positionA] ?? null;
	const b = w.lineup[positionB] ?? null;
	if (!a && !b) return false;
	w.lineup[positionA] = b;
	w.lineup[positionB] = a;
	if (klok.kickedOff(w)) klok.log(w, nu, 'swap', { positionA, positionB, playerA: a, playerB: b });
	return true;
}

export function goal(w: Match | null, nu: number, spelerId: string | null) {
	klok.log(w, nu, 'goal', { player: spelerId });
}

export function concede(w: Match | null, nu: number) {
	klok.log(w, nu, 'conceded');
}

/** The assist on the last goal. May come later, may be skipped entirely. */
export function setAssist(w: Match | null, spelerId: string | null): boolean {
	if (!w) return false;
	for (let i = w.events.length - 1; i >= 0; i--) {
		if (w.events[i].type === 'goal') {
			w.events[i].assist = spelerId;
			return true;
		}
	}
	return false;
}

/** Tapped by mistake? The last action can be undone, as long as nothing came after it. */
export function undoable(w: Match | null): string | null {
	const laatste = w?.events.at(-1);
	if (!laatste) return null;
	if (laatste.type === 'goal') return 'Doelpunt';
	if (laatste.type === 'conceded') return 'Tegendoelpunt';
	if (laatste.type === 'substitution') return 'Wissel';
	/* A position swap too. Tap the player who scored and then the one who set it
	   up, and you have accidentally made a swap — that has to be undoable. */
	if (laatste.type === 'swap') return 'Positiewissel';
	return null;
}

export function undoLast(w: Match | null): boolean {
	if (!w || !undoable(w)) return false;
	const laatste = w.events[w.events.length - 1];
	if (laatste.type === 'substitution' && laatste.position) {
		w.lineup[laatste.position] = laatste.off ?? null;
		w.bench = w.bench.filter((x) => x !== laatste.off);
		if (laatste.on && !w.bench.includes(laatste.on)) w.bench.push(laatste.on);
	}
	if (laatste.type === 'swap' && laatste.positionA && laatste.positionB) {
		const a = w.lineup[laatste.positionA] ?? null;
		w.lineup[laatste.positionA] = w.lineup[laatste.positionB] ?? null;
		w.lineup[laatste.positionB] = a;
	}
	w.events.pop();
	return true;
}
