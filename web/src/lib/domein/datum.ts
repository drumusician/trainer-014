/** Datums zoals je ze zegt, niet zoals ze zijn opgeslagen. */
function lees(datum: string): Date | null {
	/* Middaguur, zodat een tijdzone er nooit een dag naast zit. */
	const d = new Date(datum + 'T12:00:00');
	return Number.isNaN(d.getTime()) ? null : d;
}

/** "4 sep". Kan de datum niet gelezen worden, dan blijft hij zoals hij was. */
export function datumKort(datum: string): string {
	return lees(datum)?.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' }) ?? datum;
}

/** "4 september 2026". */
export function datumMetJaar(datum: string): string {
	return (
		lees(datum)?.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' }) ?? datum
	);
}
