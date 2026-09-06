/**
 * Een wedstrijd loopt in helften of in kwarten. In de jeugd tot en met 8 tegen 8
 * speelt de KNVB in vier kwarten, en trainers wisselen dan per kwart.
 */
const RANGTELWOORD = ['', '1e', '2e', '3e', '4e'];

export function partName(part: number, parts: number): string {
	const soort = parts === 4 ? 'kwart' : 'helft';
	return (RANGTELWOORD[part] ?? part + 'e') + ' ' + soort;
}

/** De pauze halverwege heet rust; de andere onderbrekingen zijn gewoon pauzes. */
export function breakName(naDeel: number, parts: number): string {
	return naDeel === Math.floor(parts / 2) ? 'Rust' : 'Pauze';
}

/** Hoe lang de wedstrijd duurt volgens de instelling. */
export function speelduur(minutenPerDeel: number, parts: number): number {
	return minutenPerDeel * parts;
}
