import type { Standaard, Speler } from './types';

/** Wat er meegaat naar je andere toestel: de voorbereiding, niet de geschiedenis. */
export interface OpzetPakket {
	v: 1;
	spelers: Speler[];
	formatie: string;
	helftMinuten: number;
	standaard: Standaard | null;
}

function naarBase64(tekst: string): string {
	const bytes = new TextEncoder().encode(tekst);
	let ruw = '';
	bytes.forEach((b) => (ruw += String.fromCharCode(b)));
	return btoa(ruw);
}

function vanBase64(code: string): string {
	const ruw = atob(code.trim());
	const bytes = Uint8Array.from(ruw, (c) => c.charCodeAt(0));
	return new TextDecoder().decode(bytes);
}

export function maakCode(pakket: OpzetPakket): string {
	return naarBase64(JSON.stringify(pakket));
}

export function leesCode(code: string): OpzetPakket {
	const pakket = JSON.parse(vanBase64(code));
	if (!pakket || !Array.isArray(pakket.spelers) || !pakket.spelers.length) {
		throw new Error('In deze code zit geen selectie.');
	}
	return pakket as OpzetPakket;
}
