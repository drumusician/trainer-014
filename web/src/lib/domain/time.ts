import { positionLine, positionLabel } from './formations';
import type { MatchEvent, Player, Match } from './types';

export function mmss(sec: number): string {
	const m = Math.floor(sec / 60);
	const r = Math.floor(sec % 60);
	return String(m).padStart(2, '0') + ':' + String(r).padStart(2, '0');
}

/** How much has been played, including the period currently running. */
export function elapsed(w: Match | null, nu = Date.now()): number {
	if (!w) return 0;
	let t = w.elapsed;
	if (w.running && w.since) t += (nu - w.since) / 1000;
	return Math.floor(t);
}

export function endTime(w: Match): number {
	const e = w.events.filter((g) => g.type === 'end').pop();
	return e ? e.t : w.elapsed;
}

export interface Interval {
	player: string;
	position: string;
	van: number;
	tot: number;
}

/**
 * Who stood where, and when. Everything to do with time comes out of this:
 * playing time per player, and goalkeeping minutes counted separately.
 *
 * The lineup we store is the one from RIGHT NOW, so we first wind back to
 * kick-off by undoing the substitutions in reverse order.
 */
export function fieldIntervals(w: Match | null, nu = Date.now()): Interval[] {
	if (!w) return [];
	const eind = w.finished ? endTime(w) : elapsed(w, nu);
	/* Substitutions and swaps together: both change who stands where. */
	const beurten = w.events.filter((g) => g.type === 'substitution' || g.type === 'swap');

	const start: Record<string, string | null> = { ...w.lineup };
	[...beurten].reverse().forEach((g) => {
		if (g.type === 'swap') {
			if (!g.positionA || !g.positionB) return;
			const a = start[g.positionA] ?? null;
			start[g.positionA] = start[g.positionB] ?? null;
			start[g.positionB] = a;
			return;
		}
		if (g.position && start[g.position] === g.on) {
			start[g.position] = g.off ?? null;
			return;
		}
		for (const position of Object.keys(start)) {
			if (start[position] === g.on) {
				start[position] = g.off ?? null;
				return;
			}
		}
	});

	const bezet: Record<string, { player: string; since: number }> = {};
	for (const position of Object.keys(start)) {
		const id = start[position];
		if (id) bezet[position] = { player: id, since: 0 };
	}

	const uit: Interval[] = [];
	beurten.forEach((g) => {
		if (g.type === 'swap') {
			/* Close both positions and reopen them at once, with the other player on. */
			const a = g.positionA && bezet[g.positionA];
			const b = g.positionB && bezet[g.positionB];
			if (a) uit.push({ player: a.player, position: g.positionA!, van: a.since, tot: g.t });
			if (b) uit.push({ player: b.player, position: g.positionB!, van: b.since, tot: g.t });
			if (a && g.positionB) bezet[g.positionB] = { player: a.player, since: g.t };
			else if (g.positionB) delete bezet[g.positionB];
			if (b && g.positionA) bezet[g.positionA] = { player: b.player, since: g.t };
			else if (g.positionA) delete bezet[g.positionA];
			return;
		}
		let position = g.position;
		if (!position || bezet[position]?.player !== g.off) {
			position = Object.keys(bezet).find((k) => bezet[k].player === g.off) ?? position;
		}
		if (position && bezet[position]) {
			uit.push({ player: bezet[position].player, position, van: bezet[position].since, tot: g.t });
		}
		if (position && g.on) bezet[position] = { player: g.on, since: g.t };
	});

	for (const position of Object.keys(bezet)) {
		uit.push({ player: bezet[position].player, position, van: bezet[position].since, tot: eind });
	}
	return uit;
}

/** Seconds per player. Everyone in the squad is listed, zero included. */
export function playingTimes(w: Match | null, players: Player[], nu = Date.now()): Record<string, number> {
	const totaal: Record<string, number> = {};
	players.forEach((p) => (totaal[p.id] = 0));
	fieldIntervals(w, nu).forEach((i) => {
		totaal[i.player] = (totaal[i.player] ?? 0) + (i.tot - i.van);
	});
	return totaal;
}

/** Seconds in goal. Keeping for a half is not half a match of football. */
export function keeperTimes(w: Match | null, nu = Date.now()): Record<string, number> {
	const uit: Record<string, number> = {};
	if (!w) return uit;
	fieldIntervals(w, nu).forEach((i) => {
		if (positionLine(i.position, w.formation) === 'K') {
			uit[i.player] = (uit[i.player] ?? 0) + (i.tot - i.van);
		}
	});
	return uit;
}

/** Seconds per player per position. Who stood where, and for how long. */
export function positionTimes(w: Match | null, nu = Date.now()): Record<string, Record<string, number>> {
	const uit: Record<string, Record<string, number>> = {};
	fieldIntervals(w, nu).forEach((i) => {
		const perPlek = (uit[i.player] ??= {});
		perPlek[i.position] = (perPlek[i.position] ?? 0) + (i.tot - i.van);
	});
	return uit;
}

/**
 * A player's positions as one readable line, longest first:
 * "35 min K · 35 min LV". More than three positions becomes unreadable, so the
 * rest is collapsed into "overig".
 */
export function positionText(perPlek: Record<string, number> | undefined, formation: string): string {
	if (!perPlek) return '';
	const label = (position: string) => positionLabel(position, formation);
	const rijen = Object.entries(perPlek)
		.filter(([, sec]) => sec > 0)
		.sort((a, b) => b[1] - a[1]);
	if (!rijen.length) return '';
	const eerste = rijen.slice(0, 3).map(([position, sec]) => Math.round(sec / 60) + ' min ' + label(position));
	const rest = rijen.slice(3).reduce((a, [, sec]) => a + sec, 0);
	if (rest > 0) eerste.push(Math.round(rest / 60) + ' min overig');
	return eerste.join(' · ');
}

export function score(w: Match | null): [number, number] {
	if (!w) return [0, 0];
	const g: MatchEvent[] = w.events;
	return [g.filter((x) => x.type === 'goal').length, g.filter((x) => x.type === 'conceded').length];
}
