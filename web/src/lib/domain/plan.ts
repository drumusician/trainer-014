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
import { momentName } from './parts';
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
			/* Een pauzewissel is aan de beurt zodra de pauze er is, niet op de klok. */
			const aanDeBeurt = stap.naDeel
				? w.part > stap.naDeel || (w.part === stap.naDeel && w.inBreak)
				: seconden >= stap.minuut * 60;
			return { stap, status, positie, kanNiet, aanDeBeurt };
		});
}

/** De eerstvolgende stap die nog open staat, of niets. */
export function volgendeStap(w: Match | null, nu = Date.now()): PlanStap | null {
	return planStappen(w, nu).find((s) => s.status === 'open') ?? null;
}

export function nogOpen(w: Match | null, nu = Date.now()): number {
	return planStappen(w, nu).filter((s) => s.status === 'open').length;
}

export interface Stand {
	/** wie er in het veld staat, per plek */
	veld: { plek: string; id: string }[];
	bank: string[];
}

/**
 * Hoe het er rond deze minuut voor staat als het plan doorgaat: de opstelling
 * van nu, met de open stappen tot en met die minuut erop toegepast, op volgorde.
 *
 * Voor het maken van een plan. Wie rond minuut 35 erin kan, is wie er dan op de
 * bank zit, niet wie er nu zit. Gedane stappen zitten al in de opstelling van
 * nu; overgeslagen stappen tellen niet. Een stap die op dat moment niet kan,
 * slaan we over in plaats van te gokken.
 */
export function standOp(w: Match | null, minuut: number): Stand {
	if (!w) return { veld: [], bank: [] };
	const lineup: Record<string, string | null> = { ...w.lineup };
	const bank = [...w.bench];
	for (const s of planStappen(w)) {
		if (s.status !== 'open' || s.stap.minuut > minuut) continue;
		const plek = Object.entries(lineup).find(([, id]) => id === s.stap.off)?.[0];
		const opVeld = Object.values(lineup).includes(s.stap.on);
		if (!plek || opVeld || !bank.includes(s.stap.on)) continue;
		lineup[plek] = s.stap.on;
		bank.splice(bank.indexOf(s.stap.on), 1);
		bank.push(s.stap.off);
	}
	return {
		veld: Object.entries(lineup)
			.filter((r): r is [string, string] => !!r[1])
			.map(([plek, id]) => ({ plek, id })),
		bank
	};
}

/** Wanneer een stap valt, zoals je het zegt: '25′', 'Rust' of 'Pauze na 1e kwart'. */
export function wanneer(stap: PlannedSub, parts: number): string {
	return stap.naDeel ? momentName(stap.naDeel, parts) : `${stap.minuut}′`;
}
