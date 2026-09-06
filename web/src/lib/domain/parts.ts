/**
 * A match runs in halves or in quarters. In Dutch youth football up to 8-a-side
 * the KNVB plays four quarters, and coaches substitute per quarter.
 */
const RANGTELWOORD = ['', '1e', '2e', '3e', '4e'];

export function partName(part: number, parts: number): string {
	const soort = parts === 4 ? 'kwart' : 'helft';
	return (RANGTELWOORD[part] ?? part + 'e') + ' ' + soort;
}

/** The break at the midpoint is half-time; the others are just breaks. */
export function breakName(naDeel: number, parts: number): string {
	return naDeel === Math.floor(parts / 2) ? 'Rust' : 'Pauze';
}

/** How long the match lasts according to the settings. */
export function speelduur(minutenPerDeel: number, parts: number): number {
	return minutenPerDeel * parts;
}
