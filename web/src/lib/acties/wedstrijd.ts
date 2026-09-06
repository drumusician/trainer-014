import * as klok from './klok';
import { endTime, keeperTimes, positionTimes, playingTimes, score } from '$lib/domein/tijd';
import type { ArchivedMatch, State, Match } from '$lib/domein/types';

/** Een wedstrijd opzetten, bijhouden wie er is, en hem afronden. */

export function nieuwe(t: State, tegenstander: string, thuis: boolean, vandaag: string) {
	t.wedstrijd = {
		datum: vandaag,
		tegenstander: tegenstander || 'Tegenstander',
		thuis,
		formatie: t.formatie,
		opstelling: {},
		bank: [],
		gebeurtenissen: [],
		verstreken: 0,
		sinds: null,
		loopt: false,
		delen: t.delen,
		deel: 1,
		pauze: false,
		afgelopen: false,
		afwezig: []
	};
	fillFromDefaultLineup(t);
}

/** De wedstrijd begint met de standaardopstelling, voor zover die nog klopt. */
export function fillFromDefaultLineup(t: State) {
	const w = t.wedstrijd;
	if (!w) return;
	const st = t.standaard;
	const ids = new Set(t.spelers.map((p) => p.id));
	if (st && st.formatie === w.formatie) {
		for (const [plek, id] of Object.entries(st.opstelling)) {
			if (id && ids.has(id)) w.opstelling[plek] = id;
		}
	}
	rebuildBench(t);
}

/** De bank is iedereen die er is en niet in het veld staat. */
export function rebuildBench(t: State) {
	const w = t.wedstrijd;
	if (!w) return;
	const inVeld = Object.values(w.opstelling).filter(Boolean) as string[];
	const afwezig = w.afwezig ?? [];
	w.bank = t.spelers.map((p) => p.id).filter((id) => !inVeld.includes(id) && !afwezig.includes(id));
}

export function isOnPitch(w: Match | null, spelerId: string): boolean {
	return !!w && Object.values(w.opstelling).includes(spelerId);
}

/**
 * Afmelden mag zolang het de opstelling niet met terugwerkende kracht verandert.
 *
 * Voor de aftrap: iemand uit het veld halen is prima, zijn plek valt leeg. Daarna
 * niet meer. De speeltijd wordt teruggerekend vanaf de opstelling van nu, dus wie
 * je daar weghaalt heeft volgens die berekening nooit gespeeld — een heel
 * gespeelde wedstrijd wordt dan stilletjes nul minuten. Wie speelt haal je eruit
 * met een wissel. Van de bank afmelden mag wel: dat raakt het veld niet, en
 * iemand kan nu eenmaal pas na de aftrap afhaken.
 */
export function setAbsent(t: State, spelerId: string, afwezig: boolean): boolean {
	const w = t.wedstrijd;
	if (!w) return false;
	if (afwezig && klok.kickedOff(w) && isOnPitch(w, spelerId)) return false;
	const lijst = (w.afwezig ?? []).filter((id) => id !== spelerId);
	if (afwezig) {
		lijst.push(spelerId);
		for (const plek of Object.keys(w.opstelling)) {
			if (w.opstelling[plek] === spelerId) w.opstelling[plek] = null;
		}
	}
	w.afwezig = lijst;
	rebuildBench(t);
	return true;
}

export function finish(w: Match | null, nu: number): boolean {
	if (!w || w.afgelopen) return false;
	if (w.loopt) {
		w.verstreken += (nu - (w.sinds ?? nu)) / 1000;
		w.loopt = false;
		w.sinds = null;
	}
	klok.log(w, nu, 'eind');
	w.afgelopen = true;
	return true;
}

/**
 * De wedstrijd in het archief zetten.
 *
 * De speeltijd wordt hier één keer uitgerekend en daarna bewaard. De
 * eindopstelling gaat mee: zonder die opstelling valt er niets meer terug te
 * rekenen en is een bewaarde wedstrijd voorgoed onherstelbaar.
 */
export function archiveMatch(t: State, nu: number): ArchivedMatch | null {
	const w = t.wedstrijd;
	if (!w || w.bewaard) return null;
	const tijden = playingTimes(w, t.spelers, nu);
	const keepers = keeperTimes(w, nu);
	const posities = positionTimes(w, nu);
	const namen: Record<string, string> = {};
	t.spelers.forEach((p) => (namen[p.id] = p.naam));

	const regel: ArchivedMatch = {
		datum: w.datum,
		tegenstander: w.tegenstander,
		thuis: w.thuis,
		stand: score(w),
		formatie: w.formatie,
		duur: endTime(w),
		delen: w.delen,
		notitie: w.notitie,
		teamnaam: t.teamnaam,
		gebeurtenissen: w.gebeurtenissen,
		namen,
		afwezig: [...(w.afwezig ?? [])],
		opstelling: { ...w.opstelling },
		bank: [...w.bank],
		speeltijd: t.spelers
			.filter((p) => tijden[p.id] !== undefined)
			.map((p) => ({
				id: p.id,
				naam: p.naam,
				seconden: Math.round(tijden[p.id]),
				keeper: Math.round(keepers[p.id] ?? 0),
				/* alleen plekken waar hij echt gestaan heeft; nul zegt niets */
				posities: Object.fromEntries(
					Object.entries(posities[p.id] ?? {})
						.map(([plek, sec]) => [plek, Math.round(sec)] as const)
						.filter(([, sec]) => sec > 0)
				)
			}))
	};
	t.archief.unshift(regel);
	w.bewaard = true;
	return regel;
}
