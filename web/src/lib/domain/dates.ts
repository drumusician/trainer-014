/** Datums zoals je ze zegt, niet zoals ze zijn opgeslagen. */
function lees(date: string): Date | null {
	/* Middaguur, zodat een tijdzone er nooit een dag naast zit. */
	const d = new Date(date + 'T12:00:00');
	return Number.isNaN(d.getTime()) ? null : d;
}

/** "4 sep". Kan de datum niet gelezen worden, dan blijft hij zoals hij was. */
export function shortDate(date: string): string {
	return lees(date)?.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' }) ?? date;
}

/** "4 september 2026". */
export function datumMetJaar(date: string): string {
	return lees(date)?.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' }) ?? date;
}
