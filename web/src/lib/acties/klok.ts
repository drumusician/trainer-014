import { verstreken } from '$lib/domein/tijd';
import type { Gebeurtenis, GebeurtenisType, Wedstrijd } from '$lib/domein/types';

/**
 * De klok, en de gebeurtenissen die eraan hangen.
 *
 * De klok is de enige plek waar de tijd wordt vastgelegd, en daarom ook waar de
 * aftrap in de lijst komt. Dat luistert nauw: de rest van de app leest 'is er
 * afgetrapt' niet van de klok maar uit de gebeurtenissenlijst, en die twee
 * mogen niet uit elkaar lopen.
 */

/** Is er afgetrapt? Pas dan ligt de opstelling vast en gaat de klok tellen. */
export function gestart(w: Wedstrijd | null): boolean {
	return !!w?.gebeurtenissen.some((g) => g.type === 'start');
}

/** Een gebeurtenis op de stand van de klok van dit moment. */
export function log(w: Wedstrijd | null, nu: number, type: GebeurtenisType, extra: Partial<Gebeurtenis> = {}) {
	if (!w) return;
	w.gebeurtenissen.push({ type, t: verstreken(w, nu), ...extra } as Gebeurtenis);
}

/** Bijstellen als de scheidsrechter er anders over denkt. Nooit onder nul. */
export function verschuif(w: Wedstrijd | null, seconden: number): boolean {
	if (!w || w.afgelopen) return false;
	w.verstreken = Math.max(0, w.verstreken + seconden);
	return true;
}

/**
 * Starten of pauzeren.
 *
 * Bij de eerste start komt de aftrap in de lijst en wordt de speeldag gestempeld
 * — niet bij het aanmaken, want je kunt een wedstrijd de avond ervoor klaarzetten.
 * De voorwaarde kijkt of er al een start-gebeurtenis is en niet of de lijst leeg
 * is: wie voor het fluitsignaal nog schuift heeft die lijst al gevuld, en dan
 * werd de aftrap nooit vastgelegd.
 */
export function loopToggle(w: Wedstrijd | null, nu: number, vandaag: string): boolean {
	if (!w || w.afgelopen) return false;
	if (w.loopt) {
		w.verstreken += (nu - (w.sinds ?? nu)) / 1000;
		w.loopt = false;
		w.sinds = null;
	} else {
		if (!gestart(w)) {
			w.datum = vandaag;
			log(w, nu, 'start');
		}
		w.loopt = true;
		w.sinds = nu;
	}
	return true;
}

/**
 * Het huidige deel afsluiten, of het volgende beginnen. Werkt hetzelfde voor
 * twee helften als voor vier kwarten.
 */
export function deelToggle(w: Wedstrijd | null, nu: number, vandaag: string): boolean {
	if (!w || w.afgelopen) return false;
	if (w.pauze) {
		w.deel = Math.min(w.deel + 1, w.delen);
		w.pauze = false;
		if (!w.loopt) loopToggle(w, nu, vandaag);
	} else if (w.deel < w.delen) {
		if (w.loopt) loopToggle(w, nu, vandaag);
		log(w, nu, 'rust', { deel: w.deel });
		w.pauze = true;
	}
	return true;
}

/** Kan er nog een deel bij, of is dit het laatste? */
export function magVolgendDeel(w: Wedstrijd | null): boolean {
	return !!w && !w.afgelopen && (w.pauze || w.deel < w.delen);
}
