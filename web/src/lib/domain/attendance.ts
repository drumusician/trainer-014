import type { Training } from './types';

export interface AttendanceSummary {
	/** how often present */
	er: number;
	/** how many sessions count towards this */
	totaal: number;
}

/** Sessions are ordered by date, newest first. */
export function sortTrainings(trainings: Training[]): Training[] {
	return [...trainings].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
}

/**
 * Attendance over the last n sessions this player appeared in.
 * n = 0 means all of them.
 */
export function attendanceOf(trainings: Training[], spelerId: string, n = 0): AttendanceSummary {
	let er = 0;
	let totaal = 0;
	for (const t of trainings) {
		if (n && totaal >= n) break;
		const st = t.status[spelerId];
		if (!st) continue;
		totaal++;
		if (st === 'present') er++;
	}
	return { er, totaal };
}

/** Under half of the recent sessions: that is worth a conversation. */
export function thinAttendance(p: AttendanceSummary): boolean {
	return p.totaal >= 2 && p.er * 2 < p.totaal;
}
