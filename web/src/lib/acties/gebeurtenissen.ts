import * as klok from './klok';
import type { Match } from '$lib/domein/types';

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
export function putOnPosition(w: Match | null, nu: number, plek: string, spelerId: string): boolean {
	if (!w) return false;
	const eruit = w.opstelling[plek];
	w.opstelling[plek] = spelerId;
	w.bank = w.bank.filter((x) => x !== spelerId);
	if (eruit) {
		w.bank.push(eruit);
		if (klok.kickedOff(w)) klok.log(w, nu, 'wissel', { eruit, erin: spelerId, plek });
	}
	return true;
}

/**
 * Twee spelers op het veld wisselen van plek. Wordt vastgelegd, want anders
 * klopt straks de speeltijd per plek niet meer.
 */
export function ruil(w: Match | null, nu: number, plekA: string, plekB: string): boolean {
	if (!w || plekA === plekB) return false;
	const a = w.opstelling[plekA] ?? null;
	const b = w.opstelling[plekB] ?? null;
	if (!a && !b) return false;
	w.opstelling[plekA] = b;
	w.opstelling[plekB] = a;
	if (klok.kickedOff(w)) klok.log(w, nu, 'ruil', { plekA, plekB, spelerA: a, spelerB: b });
	return true;
}

export function goal(w: Match | null, nu: number, spelerId: string | null) {
	klok.log(w, nu, 'goal', { speler: spelerId });
}

export function concede(w: Match | null, nu: number) {
	klok.log(w, nu, 'tegen');
}

/** De assist bij het laatste doelpunt. Mag ook later, mag ook niet. */
export function setAssist(w: Match | null, spelerId: string | null): boolean {
	if (!w) return false;
	for (let i = w.gebeurtenissen.length - 1; i >= 0; i--) {
		if (w.gebeurtenissen[i].type === 'goal') {
			w.gebeurtenissen[i].assist = spelerId;
			return true;
		}
	}
	return false;
}

/** Per ongeluk getikt? De laatste actie kan terug, zolang er niets overheen is gegaan. */
export function undoable(w: Match | null): string | null {
	const laatste = w?.gebeurtenissen.at(-1);
	if (!laatste) return null;
	if (laatste.type === 'goal') return 'Doelpunt';
	if (laatste.type === 'tegen') return 'Tegendoelpunt';
	if (laatste.type === 'wissel') return 'Wissel';
	/* Ook een positieruil. Wie de speler aantikt die scoorde en daarna zijn
	   aangever, maakt per ongeluk een ruil — dat moet je terug kunnen draaien. */
	if (laatste.type === 'ruil') return 'Positiewissel';
	return null;
}

export function undoLast(w: Match | null): boolean {
	if (!w || !undoable(w)) return false;
	const laatste = w.gebeurtenissen[w.gebeurtenissen.length - 1];
	if (laatste.type === 'wissel' && laatste.plek) {
		w.opstelling[laatste.plek] = laatste.eruit ?? null;
		w.bank = w.bank.filter((x) => x !== laatste.eruit);
		if (laatste.erin && !w.bank.includes(laatste.erin)) w.bank.push(laatste.erin);
	}
	if (laatste.type === 'ruil' && laatste.plekA && laatste.plekB) {
		const a = w.opstelling[laatste.plekA] ?? null;
		w.opstelling[laatste.plekA] = w.opstelling[laatste.plekB] ?? null;
		w.opstelling[laatste.plekB] = a;
	}
	w.gebeurtenissen.pop();
	return true;
}
