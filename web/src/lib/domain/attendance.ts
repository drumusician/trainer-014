import type { Training } from './types';

export interface AttendanceSummary {
	/** hoe vaak aanwezig */
	er: number;
	/** hoeveel trainingen meetellen */
	totaal: number;
}

/** Trainingen staan op datum, nieuwste eerst. */
export function sortTrainings(trainings: Training[]): Training[] {
	return [...trainings].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
}

/**
 * Presentie over de laatste n trainingen waar deze speler in stond.
 * n = 0 betekent alles.
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

/** Minder dan de helft van de laatste keren: dat is het gesprek waard. */
export function thinAttendance(p: AttendanceSummary): boolean {
	return p.totaal >= 2 && p.er * 2 < p.totaal;
}
