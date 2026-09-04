/**
 * Een wedstrijd loopt in helften of in kwarten. In de jeugd tot en met 8 tegen 8
 * speelt de KNVB in vier kwarten, en trainers wisselen dan per kwart.
 */
const RANGTELWOORD = ['', '1e', '2e', '3e', '4e'];

export function deelNaam(deel: number, delen: number): string {
	const soort = delen === 4 ? 'kwart' : 'helft';
	return (RANGTELWOORD[deel] ?? deel + 'e') + ' ' + soort;
}

/** De pauze halverwege heet rust; de andere onderbrekingen zijn gewoon pauzes. */
export function pauzeNaam(naDeel: number, delen: number): string {
	return naDeel === Math.floor(delen / 2) ? 'Rust' : 'Pauze';
}

/** Hoe lang de wedstrijd duurt volgens de instelling. */
export function speelduur(minutenPerDeel: number, delen: number): number {
	return minutenPerDeel * delen;
}
