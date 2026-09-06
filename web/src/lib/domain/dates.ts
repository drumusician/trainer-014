/** Dates the way you say them, not the way they are stored. */
function lees(date: string): Date | null {
	/* Midday, so a time zone can never be a day out. */
	const d = new Date(date + 'T12:00:00');
	return Number.isNaN(d.getTime()) ? null : d;
}

/** "4 sep". If the date cannot be read, it stays as it was. */
export function shortDate(date: string): string {
	return lees(date)?.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' }) ?? date;
}

/** "4 september 2026". */
export function datumMetJaar(date: string): string {
	return lees(date)?.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' }) ?? date;
}
