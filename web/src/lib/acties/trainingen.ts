import { sorteerTrainingen } from '$lib/domein/presentie';
import type { Aanwezigheid, Toestand, Training } from '$lib/domein/types';

/**
 * Alles wat een training verandert.
 *
 * De scheiding met domein/ is bewust: daar wordt gerekend zonder iets aan te
 * raken, hier wordt de toestand gewijzigd. Deze functies bewaren zelf niets —
 * dat doet de winkel, zodat er één plek is waar synchronisatie op gang komt.
 */

/** Kort, uniek genoeg, en te lezen als er ooit iets misgaat. */
function nieuwId(): string {
	return 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/** Iedereen staat op aanwezig; afmelden doe je bij uitzondering. */
export function nieuweTraining(t: Toestand, vandaag: string): Training {
	const status: Record<string, Aanwezigheid> = {};
	t.spelers.forEach((p) => (status[p.id] = 'ja'));
	const training: Training = { id: nieuwId(), datum: vandaag, status };
	t.trainingen = sorteerTrainingen([training, ...t.trainingen]);
	return training;
}

export function trainingMetId(t: Toestand, id: string | undefined): Training | undefined {
	return t.trainingen.find((x) => x.id === id);
}

/** Eén tik verder: aanwezig, afgemeld, niet gekomen, en weer aanwezig. */
export function tikPresentie(training: Training, spelerId: string) {
	const volgorde: Aanwezigheid[] = ['ja', 'af', 'nee'];
	const nu = training.status[spelerId] ?? 'ja';
	training.status[spelerId] = volgorde[(volgorde.indexOf(nu) + 1) % volgorde.length];
}

/** Een datum kan de volgorde omgooien, dus daarna opnieuw sorteren. */
export function zetTrainingDatum(t: Toestand, training: Training, datum: string): boolean {
	if (!datum) return false;
	training.datum = datum;
	t.trainingen = sorteerTrainingen(t.trainingen);
	return true;
}

export function verwijderTraining(t: Toestand, training: Training) {
	t.trainingen = t.trainingen.filter((x) => x.id !== training.id);
}
