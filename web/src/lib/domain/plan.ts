/**
 * Het wisselplan: een spiekbriefje, geen wekker.
 *
 * Wat je vooraf weet — Casper keept de tweede helft, Alain komt rond minuut 25
 * voor Max — staat hier. Wat er in de wedstrijd gebeurt blijft de waarheid: of
 * een stap gedaan is, volgt uit de wissels die echt in het verloop staan, niet
 * uit een vinkje. Doe je dezelfde wissel met de hand, dan telt hij. Maak je hem
 * ongedaan, dan staat de stap weer open.
 *
 * Een stap die niet meer kan (hij staat niet meer in het veld, zij is er niet)
 * zegt waarom. De app wisselt nooit zelf en zegt nooit dat het nú moet: het goede
 * moment kiest de trainer.
 */
import { elapsed } from './time';
import type { Match, PlannedSub } from './types';

export type StapStatus = 'gedaan' | 'overgeslagen' | 'open';

export interface PlanStap {
	stap: PlannedSub;
	status: StapStatus;
	/** waar `on` erin zou komen: de plek van `off`, nu */
	positie: string | null;
	/** waarom hij nu niet kan; null als hij kan */
	kanNiet: 'afwezig' | 'alInHetVeld' | 'nietInHetVeld' | null;
	/** de minuut is voorbij */
	aanDeBeurt: boolean;
}

function gedaan(w: Match, s: PlannedSub): boolean {
	return w.events.some((g) => g.type === 'substitution' && g.on === s.on && g.off === s.off);
}

/** Het hele plan op volgorde van minuut, met per stap hoe het ervoor staat. */
export function planStappen(w: Match | null, nu = Date.now()): PlanStap[] {
	if (!w?.plan?.length) return [];
	const plekVan = (id: string) => Object.entries(w.lineup).find(([, p]) => p === id)?.[0] ?? null;
	const afwezig = new Set(w.absent ?? []);
	const seconden = elapsed(w, nu);
	return [...w.plan]
		.map((stap, i) => ({ stap, i }))
		.sort((a, b) => a.stap.minuut - b.stap.minuut || a.i - b.i)
		.map(({ stap }) => {
			const status: StapStatus = gedaan(w, stap) ? 'gedaan' : stap.skipped ? 'overgeslagen' : 'open';
			const positie = plekVan(stap.off);
			const kanNiet = afwezig.has(stap.on)
				? 'afwezig'
				: plekVan(stap.on)
					? 'alInHetVeld'
					: !positie
						? 'nietInHetVeld'
						: null;
			return { stap, status, positie, kanNiet, aanDeBeurt: seconden >= stap.minuut * 60 };
		});
}

/** De eerstvolgende stap die nog open staat, of niets. */
export function volgendeStap(w: Match | null, nu = Date.now()): PlanStap | null {
	return planStappen(w, nu).find((s) => s.status === 'open') ?? null;
}

export function nogOpen(w: Match | null, nu = Date.now()): number {
	return planStappen(w, nu).filter((s) => s.status === 'open').length;
}
