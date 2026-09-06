import { attendanceOf, type AttendanceSummary } from './attendance';
import { seasonTotals } from './season';
import type { ArchivedMatch, Player, Training } from './types';

export interface PlayerRow {
	id: string;
	name: string;
	line: string;
	/** whether he may keep — not to be confused with keeperSeconds below */
	canKeep: boolean;
	assists: number;
	/** playing time across every archived match */
	seconds: number;
	/** of which in goal */
	keeperSeconds: number;
	matches: number;
	goals: number;
	attendance: AttendanceSummary;
	/** attendance over the last four sessions */
	recent: AttendanceSummary;
}

export type Sortering = 'naam' | 'minuten' | 'presentie' | 'doelpunten';

/** Everything you know about a player, on one row. */
export function spelersOverzicht(players: Player[], archive: ArchivedMatch[], trainings: Training[]): PlayerRow[] {
	const totalen = seasonTotals(archive, players);
	const assists: Record<string, number> = {};
	archive.forEach((a) =>
		(a.events ?? []).forEach((g) => {
			if (g.type === 'goal' && g.assist) assists[g.assist] = (assists[g.assist] ?? 0) + 1;
		})
	);
	return players.map((p) => {
		const rij = totalen.find((r) => r.name === p.name);
		return {
			id: p.id,
			name: p.name,
			line: p.line,
			canKeep: !!p.keeper,
			seconds: rij?.seconds ?? 0,
			keeperSeconds: rij?.keeper ?? 0,
			matches: rij?.wedstrijden ?? 0,
			goals: rij?.doelpunten ?? 0,
			assists: assists[p.id] ?? 0,
			attendance: attendanceOf(trainings, p.id, 0),
			recent: attendanceOf(trainings, p.id, 4)
		};
	});
}

export function sorteer(rijen: PlayerRow[], hoe: Sortering): PlayerRow[] {
	/* Someone with no sessions yet does not belong at the top of an attendance list. */
	const part = (p: AttendanceSummary) => (p.totaal ? p.er / p.totaal : 2);
	return [...rijen].sort((a, b) => {
		if (hoe === 'minuten') return b.seconds - a.seconds || a.name.localeCompare(b.name);
		if (hoe === 'doelpunten')
			return b.goals - a.goals || b.assists - a.assists || b.seconds - a.seconds || a.name.localeCompare(b.name);
		if (hoe === 'presentie') return part(a.attendance) - part(b.attendance) || a.name.localeCompare(b.name);
		return a.name.localeCompare(b.name);
	});
}

/** Percentage present, or null when there has been no session yet. */
export function percentage(p: AttendanceSummary): number | null {
	return p.totaal ? Math.round((p.er / p.totaal) * 100) : null;
}
