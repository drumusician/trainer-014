import * as klok from './clock';
import { endTime, keeperTimes, positionTimes, playingTimes, score } from '$lib/domain/time';
import type { ArchivedMatch, State, Match } from '$lib/domain/types';

/** Een wedstrijd opzetten, bijhouden wie er is, en hem afronden. */

export function nieuwe(t: State, opponent: string, home: boolean, vandaag: string) {
	t.match = {
		date: vandaag,
		opponent: opponent || 'Tegenstander',
		home,
		formation: t.formation,
		lineup: {},
		bench: [],
		events: [],
		elapsed: 0,
		since: null,
		running: false,
		parts: t.parts,
		part: 1,
		inBreak: false,
		finished: false,
		absent: []
	};
	fillFromDefaultLineup(t);
}

/** De wedstrijd begint met de standaardopstelling, voor zover die nog klopt. */
export function fillFromDefaultLineup(t: State) {
	const w = t.match;
	if (!w) return;
	const st = t.defaultLineup;
	const ids = new Set(t.players.map((p) => p.id));
	if (st && st.formation === w.formation) {
		for (const [position, id] of Object.entries(st.lineup)) {
			if (id && ids.has(id)) w.lineup[position] = id;
		}
	}
	rebuildBench(t);
}

/** De bank is iedereen die er is en niet in het veld staat. */
export function rebuildBench(t: State) {
	const w = t.match;
	if (!w) return;
	const inVeld = Object.values(w.lineup).filter(Boolean) as string[];
	const absent = w.absent ?? [];
	w.bench = t.players.map((p) => p.id).filter((id) => !inVeld.includes(id) && !absent.includes(id));
}

export function isOnPitch(w: Match | null, spelerId: string): boolean {
	return !!w && Object.values(w.lineup).includes(spelerId);
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
export function setAbsent(t: State, spelerId: string, absent: boolean): boolean {
	const w = t.match;
	if (!w) return false;
	if (absent && klok.kickedOff(w) && isOnPitch(w, spelerId)) return false;
	const lijst = (w.absent ?? []).filter((id) => id !== spelerId);
	if (absent) {
		lijst.push(spelerId);
		for (const position of Object.keys(w.lineup)) {
			if (w.lineup[position] === spelerId) w.lineup[position] = null;
		}
	}
	w.absent = lijst;
	rebuildBench(t);
	return true;
}

export function finish(w: Match | null, nu: number): boolean {
	if (!w || w.finished) return false;
	if (w.running) {
		w.elapsed += (nu - (w.since ?? nu)) / 1000;
		w.running = false;
		w.since = null;
	}
	klok.log(w, nu, 'end');
	w.finished = true;
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
	const w = t.match;
	if (!w || w.archived) return null;
	const tijden = playingTimes(w, t.players, nu);
	const keepers = keeperTimes(w, nu);
	const positions = positionTimes(w, nu);
	const names: Record<string, string> = {};
	t.players.forEach((p) => (names[p.id] = p.name));

	const regel: ArchivedMatch = {
		date: w.date,
		opponent: w.opponent,
		home: w.home,
		score: score(w),
		formation: w.formation,
		duration: endTime(w),
		parts: w.parts,
		note: w.note,
		teamName: t.teamName,
		events: w.events,
		names,
		absent: [...(w.absent ?? [])],
		lineup: { ...w.lineup },
		bench: [...w.bench],
		playingTime: t.players
			.filter((p) => tijden[p.id] !== undefined)
			.map((p) => ({
				id: p.id,
				name: p.name,
				seconds: Math.round(tijden[p.id]),
				keeper: Math.round(keepers[p.id] ?? 0),
				/* alleen plekken waar hij echt gestaan heeft; nul zegt niets */
				positions: Object.fromEntries(
					Object.entries(positions[p.id] ?? {})
						.map(([position, sec]) => [position, Math.round(sec)] as const)
						.filter(([, sec]) => sec > 0)
				)
			}))
	};
	t.archive.unshift(regel);
	w.archived = true;
	return regel;
}
