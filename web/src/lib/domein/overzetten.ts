import type { Toestand } from './types';

/**
 * Wat er meegaat naar een ander toestel: alles wat de app onthoudt, behalve de
 * wedstrijd die nu loopt. Die hoort bij het toestel waar je hem speelt.
 *
 * Precies dezelfde inhoud als een back-up en als wat er naar de server gaat, want
 * anders moet je onthouden welke knop wat meeneemt. Dat is precies wat er misging.
 */
export type Overzetbaar = Partial<Omit<Toestand, 'wedstrijd'>>;

export interface OpzetPakket extends Overzetbaar {
	v: 1 | 2;
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

export function maakCode(t: Toestand): string {
	const { wedstrijd: _weg, ...rest } = t;
	const pakket: OpzetPakket = { v: 2, ...rest };
	return naarBase64(JSON.stringify(pakket));
}

/**
 * Leest een code of een back-up; allebei mag. Wat er niet in staat blijft staan
 * zoals het was: een oude code zonder trainingen wist je trainingen dus niet.
 */
export function leesCode(tekst: string): OpzetPakket {
	const ruw = tekst.trim();
	const json = ruw.startsWith('{') ? ruw : vanBase64(ruw);
	const d = JSON.parse(json);
	const pakket: OpzetPakket = d?.toestand ? { v: 2, ...d.toestand } : d;
	if (!pakket || !Array.isArray(pakket.spelers) || !pakket.spelers.length) {
		throw new Error('hier staat geen selectie in');
	}
	return pakket;
}

/** Wat er in dit pakket zit, om te laten zien voor je het overneemt. */
export function beschrijf(p: OpzetPakket): string {
	const stukjes = [p.spelers!.length + (p.spelers!.length === 1 ? ' speler' : ' spelers')];
	if (p.archief) stukjes.push(p.archief.length + (p.archief.length === 1 ? ' wedstrijd' : ' wedstrijden'));
	if (p.trainingen) stukjes.push(p.trainingen.length + (p.trainingen.length === 1 ? ' training' : ' trainingen'));
	if (p.standaard) stukjes.push('een standaardopstelling');
	return stukjes.join(', ');
}
