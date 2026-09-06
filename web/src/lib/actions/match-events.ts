import * as klok from './clock';
import type { Match } from '$lib/domain/types';

/**
 * Wat er tijdens een wedstrijd gebeurt: wissels, ruilen, doelpunten.
 *
 * Alles wat de opstelling verandert komt hier óók in de gebeurtenissenlijst
 * terecht, en dat is geen administratie maar de kern: de speeltijd wordt uit
 * die lijst teruggerekend en nooit ergens ingevoerd. Wie de opstelling wijzigt
 * zonder een gebeurtenis achter te laten, herschrijft met terugwerkende kracht
 * de hele wedstrijd.
 *
 * Voor de aftrap ligt dat anders: dan ben je aan het opstellen en is er nog
 * niets om terug te rekenen.
 */

/** Iemand van de bank op een plek zetten. Tijdens een wedstrijd is dat een wissel. */
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
 * Twee spelers op het veld wisselen van plek. Wordt vastgelegd, want anders
 * klopt straks de speeltijd per plek niet meer.
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

/** De assist bij het laatste doelpunt. Mag ook later, mag ook niet. */
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

/** Per ongeluk getikt? De laatste actie kan terug, zolang er niets overheen is gegaan. */
export function undoable(w: Match | null): string | null {
	const laatste = w?.events.at(-1);
	if (!laatste) return null;
	if (laatste.type === 'goal') return 'Doelpunt';
	if (laatste.type === 'conceded') return 'Tegendoelpunt';
	if (laatste.type === 'substitution') return 'Wissel';
	/* Ook een positieruil. Wie de speler aantikt die scoorde en daarna zijn
	   aangever, maakt per ongeluk een ruil — dat moet je terug kunnen draaien. */
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
