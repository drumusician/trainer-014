import { migreerToestand } from './migrate-storage';
import type { State } from './types';

/**
 * What travels to another device: everything the app remembers, except the match
 * currently running. That one belongs to the device you are playing it on.
 *
 * Exactly the same content as a backup and as what goes to the server, because
 * otherwise you have to remember which button takes what along. That is precisely
 * what went wrong before.
 */
export type Overzetbaar = Partial<Omit<State, 'match'>>;

export interface TransferPackage extends Overzetbaar {
	v: 1 | 2;
}

function toBase64(tekst: string): string {
	const bytes = new TextEncoder().encode(tekst);
	let ruw = '';
	bytes.forEach((b) => (ruw += String.fromCharCode(b)));
	return btoa(ruw);
}

function fromBase64(code: string): string {
	const ruw = atob(code.trim());
	const bytes = Uint8Array.from(ruw, (c) => c.charCodeAt(0));
	return new TextDecoder().decode(bytes);
}

export function makeTransferCode(t: State): string {
	const { match: _weg, ...rest } = t;
	const pakket: TransferPackage = { v: 2, ...rest };
	return toBase64(JSON.stringify(pakket));
}

/**
 * Reads a code or a backup; either is fine. What is not in it stays as it was:
 * an old code without sessions therefore does not wipe your sessions.
 */
export function readTransferCode(tekst: string): TransferPackage {
	const ruw = tekst.trim();
	const json = ruw.startsWith('{') ? ruw : fromBase64(ruw);
	const d = JSON.parse(json);
	/* A code from a device that has not been updated yet is still in Dutch. */
	const binnen = migreerToestand(d?.toestand ?? d) as Partial<TransferPackage>;
	const pakket = (d?.toestand ? { v: 2, ...binnen } : binnen) as TransferPackage;
	if (!pakket || !Array.isArray(pakket.players) || !pakket.players.length) {
		throw new Error('hier staat geen selectie in');
	}
	return pakket;
}

/** What is in this package, to show before you adopt it. */
/**
 * What a package contains, in one sentence for the confirmation prompt.
 *
 * Takes only what it reads, so both a transfer code and a restored backup file
 * can go through it.
 */
export function describePackage(
	p: Partial<Pick<State, 'players' | 'archive' | 'trainings' | 'defaultLineup'>>
): string {
	const aantal = p.players?.length ?? 0;
	const stukjes = [aantal + (aantal === 1 ? ' speler' : ' spelers')];
	if (p.archive) stukjes.push(p.archive.length + (p.archive.length === 1 ? ' wedstrijd' : ' wedstrijden'));
	if (p.trainings) stukjes.push(p.trainings.length + (p.trainings.length === 1 ? ' training' : ' trainingen'));
	if (p.defaultLineup) stukjes.push('een standaardopstelling');
	return stukjes.join(', ');
}
