import { elapsed } from '$lib/domain/time';
import type { MatchEvent, MatchEventType, Match } from '$lib/domain/types';

/**
 * The clock, and the events that hang off it.
 *
 * The clock is the only place where time is recorded, and therefore also where
 * kick-off enters the event list. That is delicate: the rest of the app does not
 * read "has it kicked off" from the clock but from the event list, and those two
 * must never drift apart.
 */

/** Has it kicked off? Only then is the lineup fixed and does the clock count. */
export function kickedOff(w: Match | null): boolean {
	return !!w?.events.some((g) => g.type === 'start');
}

/** An event stamped with the clock as it reads right now. */
export function log(w: Match | null, nu: number, type: MatchEventType, extra: Partial<MatchEvent> = {}) {
	if (!w) return;
	w.events.push({ type, t: elapsed(w, nu), ...extra } as MatchEvent);
}

/** Adjust when the referee disagrees. Never below zero. */
export function verschuif(w: Match | null, seconds: number): boolean {
	if (!w || w.finished) return false;
	w.elapsed = Math.max(0, w.elapsed + seconds);
	return true;
}

/**
 * Start or pause.
 *
 * On the first start, kick-off enters the list and the match day is stamped —
 * not on creation, because you can set a match up the evening before. The
 * condition asks whether a start event already exists, not whether the list is
 * empty: anyone still shuffling players before the whistle has already filled
 * that list, and then kick-off was never recorded at all.
 */
export function toggleRunning(w: Match | null, nu: number, vandaag: string): boolean {
	if (!w || w.finished) return false;
	if (w.running) {
		w.elapsed += (nu - (w.since ?? nu)) / 1000;
		w.running = false;
		w.since = null;
	} else {
		if (!kickedOff(w)) {
			w.date = vandaag;
			log(w, nu, 'start');
		}
		w.running = true;
		w.since = nu;
	}
	return true;
}

/**
 * End the current part, or begin the next one. Works the same for two halves as
 * for four quarters.
 */
export function togglePart(w: Match | null, nu: number, vandaag: string): boolean {
	if (!w || w.finished) return false;
	if (w.inBreak) {
		w.part = Math.min(w.part + 1, w.parts);
		w.inBreak = false;
		if (!w.running) toggleRunning(w, nu, vandaag);
	} else if (w.part < w.parts) {
		if (w.running) toggleRunning(w, nu, vandaag);
		log(w, nu, 'break', { part: w.part });
		w.inBreak = true;
	}
	return true;
}

/**
 * Set the clock to a given minute.
 *
 * This existed only as ±1′, which is fine when the referee is a minute out. It
 * does not work when you enter a match afterwards: then you tap a whole hour
 * together. If the clock is running we also move the reference point, otherwise
 * the time since the last start would be added on top.
 */
export function zetOp(w: Match | null, nu: number, minuten: number): boolean {
	if (!w || w.finished || !Number.isFinite(minuten)) return false;
	w.elapsed = Math.max(0, Math.round(minuten * 60));
	if (w.running) w.since = nu;
	return true;
}

/** Is there another part to come, or is this the last one? */
export function canStartNextPart(w: Match | null): boolean {
	return !!w && !w.finished && (w.inBreak || w.part < w.parts);
}
