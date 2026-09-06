import type { ArchiefWedstrijd, Gebeurtenis, Toestand } from '$lib/domein/types';

/**
 * Een bewaarde wedstrijd bijwerken.
 *
 * Alleen de score is hier te veranderen, en dat is met opzet: doelpunten raken
 * de tijdrekening niet aan. Wissels en ruilen blijven staan, want daar hangt de
 * speeltijd aan en die kan een verkeerde lijst niet als fout herkennen — hij
 * gaat dan gokken en levert geloofwaardige, verkeerde minuten.
 */

/** De stand volgt uit de doelpunten, dus na elke wijziging opnieuw tellen. */
export function telStand(a: ArchiefWedstrijd) {
	a.stand = [
		a.gebeurtenissen.filter((g) => g.type === 'goal').length,
		a.gebeurtenissen.filter((g) => g.type === 'tegen').length
	];
}

/** Datum, tegenstander, thuis of uit. De cijfers blijven zoals ze waren. */
export function wijzig(
	t: Toestand,
	i: number,
	velden: Partial<Pick<ArchiefWedstrijd, 'datum' | 'tegenstander' | 'thuis'>>
): boolean {
	const a = t.archief[i];
	if (!a) return false;
	Object.assign(a, velden);
	return true;
}

export function zetNotitie(t: Toestand, i: number, notitie: string): boolean {
	const a = t.archief[i];
	if (!a) return false;
	a.notitie = notitie;
	return true;
}

export function verwijderWedstrijd(t: Toestand, i: number) {
	t.archief.splice(i, 1);
}

/** Een doelpunt weghalen dat er niet was. */
export function verwijderDoelpunt(t: Toestand, i: number, index: number): boolean {
	const a = t.archief[i];
	const g = a?.gebeurtenissen[index];
	if (!a || !g || (g.type !== 'goal' && g.type !== 'tegen')) return false;
	a.gebeurtenissen.splice(index, 1);
	telStand(a);
	return true;
}

/** Een doelpunt dat je miste, op de goede minuut ertussen. */
export function voegDoelpuntToe(
	t: Toestand,
	i: number,
	minuut: number,
	spelerId: string | null,
	tegen = false
): boolean {
	const a = t.archief[i];
	if (!a) return false;
	const gebeurtenis: Gebeurtenis = tegen
		? { type: 'tegen', t: Math.max(0, Math.round(minuut * 60)) }
		: { type: 'goal', t: Math.max(0, Math.round(minuut * 60)), speler: spelerId };
	a.gebeurtenissen = [...a.gebeurtenissen, gebeurtenis].sort((x, y) => (x.t ?? 0) - (y.t ?? 0));
	telStand(a);
	return true;
}
