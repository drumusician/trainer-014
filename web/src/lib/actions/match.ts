import * as klok from './clock';
import { endTime, keeperTimes, positionTimes, playingTimes, score } from '$lib/domain/time';
import type { ArchivedMatch, State, Match } from '$lib/domain/types';

/** Setting up a match, tracking who is there, and finishing it. */

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

/** The match starts from the default lineup, as far as it still applies. */
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

/** The bench is everyone who is present and not on the pitch. */
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
 * Marking someone absent is allowed as long as it does not change the lineup
 * retroactively.
 *
 * Before kick-off: taking someone off the pitch is fine, their position falls
 * empty. After that, no. Playing time is wound back from the lineup as it stands
 * now, so anyone you remove from it never played according to that calculation —
 * a fully played match silently becomes zero minutes. Someone who is playing you
 * take off with a substitution. From the bench it is fine: that does not touch
 * the pitch, and people do drop out after kick-off.
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
 * Put the match into the archive.
 *
 * Playing time is calculated once here and then stored. The final lineup goes
 * with it: without that lineup there is nothing left to wind back from, and an
 * archived match is beyond repair for good.
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
				/* only positions he actually stood in; a zero says nothing */
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
