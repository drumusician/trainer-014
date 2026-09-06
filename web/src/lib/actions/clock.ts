import { elapsed } from '$lib/domain/time';
import type { MatchEvent, MatchEventType, Match } from '$lib/domain/types';

/**
 * De klok, en de gebeurtenissen die eraan hangen.
 *
 * De klok is de enige plek waar de tijd wordt vastgelegd, en daarom ook waar de
 * aftrap in de lijst komt. Dat luistert nauw: de rest van de app leest 'is er
 * afgetrapt' niet van de klok maar uit de gebeurtenissenlijst, en die twee
 * mogen niet uit elkaar lopen.
 */

/** Is er afgetrapt? Pas dan ligt de opstelling vast en gaat de klok tellen. */
export function kickedOff(w: Match | null): boolean {
	return !!w?.gebeurtenissen.some((g) => g.type === 'start');
}

/** Een gebeurtenis op de stand van de klok van dit moment. */
export function log(w: Match | null, nu: number, type: MatchEventType, extra: Partial<MatchEvent> = {}) {
	if (!w) return;
	w.gebeurtenissen.push({ type, t: elapsed(w, nu), ...extra } as MatchEvent);
}

/** Bijstellen als de scheidsrechter er anders over denkt. Nooit onder nul. */
export function verschuif(w: Match | null, seconden: number): boolean {
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
export function toggleRunning(w: Match | null, nu: number, vandaag: string): boolean {
	if (!w || w.afgelopen) return false;
	if (w.loopt) {
		w.verstreken += (nu - (w.sinds ?? nu)) / 1000;
		w.loopt = false;
		w.sinds = null;
	} else {
		if (!kickedOff(w)) {
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
export function togglePart(w: Match | null, nu: number, vandaag: string): boolean {
	if (!w || w.afgelopen) return false;
	if (w.pauze) {
		w.deel = Math.min(w.deel + 1, w.delen);
		w.pauze = false;
		if (!w.loopt) toggleRunning(w, nu, vandaag);
	} else if (w.deel < w.delen) {
		if (w.loopt) toggleRunning(w, nu, vandaag);
		log(w, nu, 'rust', { deel: w.deel });
		w.pauze = true;
	}
	return true;
}

/**
 * De klok op een bepaalde minuut zetten.
 *
 * Bestond alleen als ±1′, en dat is prima als de scheidsrechter er een minuut
 * naast zit. Het werkt niet als je een wedstrijd achteraf invoert: dan tik je
 * een heel uur bij elkaar. Loopt de klok, dan verzetten we ook het ijkpunt,
 * anders telt de tijd sinds de laatste start er nog eens bovenop.
 */
export function zetOp(w: Match | null, nu: number, minuten: number): boolean {
	if (!w || w.afgelopen || !Number.isFinite(minuten)) return false;
	w.verstreken = Math.max(0, Math.round(minuten * 60));
	if (w.loopt) w.sinds = nu;
	return true;
}

/** Kan er nog een deel bij, of is dit het laatste? */
export function canStartNextPart(w: Match | null): boolean {
	return !!w && !w.afgelopen && (w.pauze || w.deel < w.delen);
}
