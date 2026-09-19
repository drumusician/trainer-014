import type { KanNiet } from '$lib/domain/plan';
import type { PlannedSub } from '$lib/domain/types';
import { text } from '$lib/text/nl';

/**
 * Een stap uit het wisselplan in woorden, met de plekken erbij zoals ze op dat
 * moment zijn: 'Alain voor Max (SP)', of bij een ruil 'Maher naar K, Kasper naar
 * LM'. Zonder plekken (al gedaan, of hij kan niet meer) de kale tekst.
 *
 * `plek` geeft het label van waar iemand staat, of null.
 */
export function stapTekst(stap: PlannedSub, naam: (id: string) => string, plek: (id: string) => string | null): string {
	const plekOff = plek(stap.off);
	if (stap.soort === 'ruil') {
		const plekOn = plek(stap.on);
		return plekOff && plekOn
			? text.plan.swapTo(naam(stap.off), plekOn, naam(stap.on), plekOff)
			: text.plan.swapStep(naam(stap.off), naam(stap.on));
	}
	return plekOff
		? text.plan.stepAt(naam(stap.on), naam(stap.off), plekOff)
		: text.plan.step(naam(stap.on), naam(stap.off));
}

/** Waarom een stap niet kan, in woorden; leeg als hij wel kan. */
export function redenTekst(kanNiet: KanNiet, stap: PlannedSub, naam: (id: string) => string): string {
	switch (kanNiet) {
		case 'afwezig':
			return text.plan.absent(naam(stap.on));
		case 'alInHetVeld':
			return text.plan.alreadyOn(naam(stap.on));
		case 'nietInHetVeld':
			return text.plan.notOn(naam(stap.off));
		case 'nietBeideInHetVeld':
			return text.plan.notBothOn(naam(stap.off), naam(stap.on));
		default:
			return '';
	}
}
