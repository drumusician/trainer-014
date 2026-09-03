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
