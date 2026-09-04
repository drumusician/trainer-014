import { LINIES, plekken } from './formaties';
import type { Linie, Opstelling, Speler } from './types';

/**
 * De opstelling als tekst, om naar een mede-trainer te sturen. Per linie op één
 * regel, met de plek erachter waar dat iets toevoegt.
 */
export function opstellingTekst(
	formatie: string,
	opstelling: Opstelling,
	bank: string[],
	spelers: Speler[]
): string {
	const naam = (id?: string | null) => spelers.find((p) => p.id === id)?.naam;
	const regels: string[] = ['Opstelling ' + formatie];

	(['K', 'V', 'M', 'A'] as Linie[]).forEach((linie) => {
		const namen = plekken(formatie)
			.filter((p) => p[4] === linie)
			.map((p) => {
				const n = naam(opstelling[p[0]]);
				return n ? (linie === 'K' ? n : n + ' (' + p[1] + ')') : null;
			})
			.filter(Boolean);
		if (namen.length) regels.push(LINIES[linie] + ': ' + namen.join(', '));
	});

	const opDeBank = bank.map((id) => naam(id)).filter(Boolean);
	if (opDeBank.length) regels.push('Bank: ' + opDeBank.join(', '));
	return regels.join('\n');
}

export interface Omgezet {
	opstelling: Opstelling;
	bank: string[];
	/** wie er niet meer paste en naar de bank ging */
	afgevallen: string[];
}

/**
 * Een opstelling meenemen naar een andere formatie. Eerst blijft iedereen staan
 * op een plek die in beide formaties bestaat; daarna vullen we de resterende
 * plekken met spelers uit dezelfde linie. Wie dan nog over is, gaat naar de bank.
 *
 * Van 4-3-3 naar 4-4-2 betekent dat je vier verdedigers en je keeper gewoon
 * blijven staan, en dat er van je drie aanvallers eentje op de bank komt.
 */
export function zetOpstellingOm(
	opstelling: Opstelling,
	vanFormatie: string,
	naarFormatie: string,
	bank: string[] = []
): Omgezet {
	const oudePlekken = plekken(vanFormatie);
	const nieuwePlekken = plekken(naarFormatie);
	const nieuw: Opstelling = {};
	const vrij: { speler: string; linie: string }[] = [];

	/* stap 1: plekken die in beide formaties bestaan houden hun speler */
	const nieuweIds = new Set(nieuwePlekken.map((p) => p[0]));
	oudePlekken.forEach(([plekId, , , , linie]) => {
		const speler = opstelling[plekId];
		if (!speler) return;
		if (nieuweIds.has(plekId)) nieuw[plekId] = speler;
		else vrij.push({ speler, linie });
	});

	/* stap 2: de rest verdelen over lege plekken van dezelfde linie */
	nieuwePlekken.forEach(([plekId, , , , linie]) => {
		if (nieuw[plekId]) return;
		const i = vrij.findIndex((v) => v.linie === linie);
		if (i >= 0) nieuw[plekId] = vrij.splice(i, 1)[0].speler;
	});

	const afgevallen = vrij.map((v) => v.speler);
	return {
		opstelling: nieuw,
		bank: [...bank.filter((id) => !Object.values(nieuw).includes(id)), ...afgevallen],
		afgevallen
	};
}
