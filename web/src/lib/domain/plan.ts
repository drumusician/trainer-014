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
export type KanNiet = 'afwezig' | 'alInHetVeld' | 'nietInHetVeld' | 'nietBeideInHetVeld' | null;

/** Binnen zoveel minuten na erin of eruit is een geplande stap met hem opvallend. */
export const PAS_GELEDEN = 10;

/**
 * Zoveel minuten van tevoren komt een stap onder het veld in beeld. Eerder is
 * het ruis: in minuut 10 hoef je nog niet te lezen wat er in de rust gebeurt.
 */
export const VOORUIT = 5;

export interface PlanStap {
	stap: PlannedSub;
	status: StapStatus;
	/** waar `on` erin zou komen: de plek van `off`, nu */
	positie: string | null;
	/** bij een ruil: waar `on` nu staat */
	positieOn: string | null;
	/** waarom hij nu niet kan; null als hij kan */
	kanNiet: KanNiet;
	/** de minuut is voorbij */
	aanDeBeurt: boolean;
	/** zo dichtbij dat hij onder het veld hoort te staan: VOORUIT minuten ervoor, of al aan de beurt */
	inZicht: boolean;
	/**
	 * Kan wel, maar is vreemd: wie eruit moet kwam er pas zoveel minuten geleden
	 * in, of wie erin moet ging er net uit. Na een rommelige wedstrijd met wissels
	 * die niet gepland waren. Null als er niets opvalt.
	 */
	pasErin: number | null;
	pasEruit: number | null;
}

function redenKanNiet(stap: PlannedSub, plekVan: (id: string) => string | null, afwezig: Set<string>): KanNiet {
	const plekOff = plekVan(stap.off);
	const plekOn = plekVan(stap.on);
	if (stap.soort === 'ruil') return !plekOff || !plekOn ? 'nietBeideInHetVeld' : null;
	if (afwezig.has(stap.on)) return 'afwezig';
	if (plekOn) return 'alInHetVeld';
	if (!plekOff) return 'nietInHetVeld';
	return null;
}

/** Hoeveel minuten geleden, als het minder is dan PAS_GELEDEN; anders null. */
function pasGeleden(w: Match, seconden: number, id: string, kant: 'on' | 'off'): number | null {
	const laatste = [...w.events].reverse().find((g) => g.type === 'substitution' && g[kant] === id);
	if (!laatste) return null;
	const min = Math.floor((seconden - (laatste.t ?? 0)) / 60);
	return min < PAS_GELEDEN ? Math.max(1, min) : null;
}

/* Gedaan als het in het verloop staat, ook als je het met de hand deed. */
function gedaan(w: Match, s: PlannedSub): boolean {
	if (s.soort === 'ruil') {
		return w.events.some(
			(g) =>
				g.type === 'swap' &&
				((g.playerA === s.on && g.playerB === s.off) || (g.playerA === s.off && g.playerB === s.on))
		);
	}
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
			const positieOn = plekVan(stap.on);
			const kanNiet = redenKanNiet(stap, plekVan, afwezig);
			/* Een pauzewissel is aan de beurt zodra de pauze er is, niet op de klok. */
			const aanDeBeurt = stap.naDeel
				? w.part > stap.naDeel || (w.part === stap.naDeel && w.inBreak)
				: seconden >= stap.minuut * 60;
			const inZicht = aanDeBeurt || seconden >= (stap.minuut - VOORUIT) * 60;
			const vreemd = status === 'open' && !kanNiet;
			return {
				stap,
				status,
				positie,
				positieOn,
				kanNiet,
				aanDeBeurt,
				inZicht,
				pasErin: vreemd ? pasGeleden(w, seconden, stap.off, 'on') : null,
				pasEruit: vreemd && stap.soort !== 'ruil' ? pasGeleden(w, seconden, stap.on, 'off') : null
			};
		});
}

/**
 * De eerstvolgende stap die nu kan. Wat niet meer kan schuift stil opzij in
 * plaats van dat je het langs de lijn moet wegtikken; wordt hij later weer
 * mogelijk, dan komt hij vanzelf terug.
 */
export function volgendeStap(w: Match | null, nu = Date.now()): PlanStap | null {
	return planStappen(w, nu).find((s) => s.status === 'open' && !s.kanNiet) ?? null;
}

/** Hoeveel stappen er nu nog kunnen, de volgende meegeteld. */
export function nogOpen(w: Match | null, nu = Date.now()): number {
	return planStappen(w, nu).filter((s) => s.status === 'open' && !s.kanNiet).length;
}

/**
 * Kan deze stap op zijn eigen moment, met de stappen daarvoor meegerekend? Voor
 * de lijst in het plan: vóór de wedstrijd staat Kasper nog in het doel, maar na
 * de keeperwissel in de rust kan hij best het veld in.
 */
export function kanNietOpMoment(w: Match | null, stap: PlannedSub): KanNiet {
	if (!w) return null;
	const stand = standOp(w, stap.minuut, stap.id);
	const plekVan = (id: string) => stand.veld.find((r) => r.id === id)?.plek ?? null;
	return redenKanNiet(stap, plekVan, new Set(w.absent ?? []));
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
export function standOp(w: Match | null, minuut: number, voorStap?: string): Stand {
	if (!w) return { veld: [], bank: [] };
	const lineup: Record<string, string | null> = { ...w.lineup };
	const bank = [...w.bench];
	for (const s of planStappen(w)) {
		/* voorStap: hoe het ervoor staat vlak vóór die stap, voor de plekken in de lijst */
		if (s.stap.id === voorStap) break;
		if (s.status !== 'open' || s.stap.minuut > minuut) continue;
		const plek = Object.entries(lineup).find(([, id]) => id === s.stap.off)?.[0];
		if (s.stap.soort === 'ruil') {
			const plekOn = Object.entries(lineup).find(([, id]) => id === s.stap.on)?.[0];
			if (!plek || !plekOn) continue;
			lineup[plek] = s.stap.on;
			lineup[plekOn] = s.stap.off;
			continue;
		}
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
