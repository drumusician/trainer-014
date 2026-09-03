import { plekLinie } from './formaties';
import type { Gebeurtenis, Speler, Wedstrijd } from './types';

export function mmss(sec: number): string {
	const m = Math.floor(sec / 60);
	const r = Math.floor(sec % 60);
	return String(m).padStart(2, '0') + ':' + String(r).padStart(2, '0');
}

/** Hoeveel er gespeeld is, inclusief de periode die nu loopt. */
export function verstreken(w: Wedstrijd | null, nu = Date.now()): number {
	if (!w) return 0;
	let t = w.verstreken;
	if (w.loopt && w.sinds) t += (nu - w.sinds) / 1000;
	return Math.floor(t);
}

export function eindTijd(w: Wedstrijd): number {
	const e = w.gebeurtenissen.filter((g) => g.type === 'eind').pop();
	return e ? e.t : w.verstreken;
}

export interface Interval {
	speler: string;
	plek: string;
	van: number;
	tot: number;
}

/**
 * Wie stond wanneer op welke plek. Alles wat met tijd te maken heeft komt
 * hieruit: speeltijd per speler, en apart de minuten in het doel.
 *
 * De opstelling die we bewaren is die van NU, dus we rekenen eerst terug naar
 * de aftrap door de wissels in omgekeerde volgorde ongedaan te maken.
 */
export function veldIntervallen(w: Wedstrijd | null, nu = Date.now()): Interval[] {
	if (!w) return [];
	const eind = w.afgelopen ? eindTijd(w) : verstreken(w, nu);
	/* Wissels en ruilen samen: allebei veranderen ze wie waar staat. */
	const beurten = w.gebeurtenissen.filter((g) => g.type === 'wissel' || g.type === 'ruil');

	const start: Record<string, string | null> = { ...w.opstelling };
	[...beurten].reverse().forEach((g) => {
		if (g.type === 'ruil') {
			if (!g.plekA || !g.plekB) return;
			const a = start[g.plekA] ?? null;
			start[g.plekA] = start[g.plekB] ?? null;
			start[g.plekB] = a;
			return;
		}
		if (g.plek && start[g.plek] === g.erin) {
			start[g.plek] = g.eruit ?? null;
			return;
		}
		for (const plek of Object.keys(start)) {
			if (start[plek] === g.erin) {
				start[plek] = g.eruit ?? null;
				return;
			}
		}
	});

	const bezet: Record<string, { speler: string; sinds: number }> = {};
	for (const plek of Object.keys(start)) {
		const id = start[plek];
		if (id) bezet[plek] = { speler: id, sinds: 0 };
	}

	const uit: Interval[] = [];
	beurten.forEach((g) => {
		if (g.type === 'ruil') {
			/* Allebei de plekken sluiten en meteen weer openen, met de ander erop. */
			const a = g.plekA && bezet[g.plekA];
			const b = g.plekB && bezet[g.plekB];
			if (a) uit.push({ speler: a.speler, plek: g.plekA!, van: a.sinds, tot: g.t });
			if (b) uit.push({ speler: b.speler, plek: g.plekB!, van: b.sinds, tot: g.t });
			if (a && g.plekB) bezet[g.plekB] = { speler: a.speler, sinds: g.t };
			else if (g.plekB) delete bezet[g.plekB];
			if (b && g.plekA) bezet[g.plekA] = { speler: b.speler, sinds: g.t };
			else if (g.plekA) delete bezet[g.plekA];
			return;
		}
		let plek = g.plek;
		if (!plek || bezet[plek]?.speler !== g.eruit) {
			plek = Object.keys(bezet).find((k) => bezet[k].speler === g.eruit) ?? plek;
		}
		if (plek && bezet[plek]) {
			uit.push({ speler: bezet[plek].speler, plek, van: bezet[plek].sinds, tot: g.t });
		}
		if (plek && g.erin) bezet[plek] = { speler: g.erin, sinds: g.t };
	});

	for (const plek of Object.keys(bezet)) {
		uit.push({ speler: bezet[plek].speler, plek, van: bezet[plek].sinds, tot: eind });
	}
	return uit;
}

/** Seconden per speler. Iedereen uit de selectie komt erin, ook met nul. */
export function speeltijden(
	w: Wedstrijd | null,
	spelers: Speler[],
	nu = Date.now()
): Record<string, number> {
	const totaal: Record<string, number> = {};
	spelers.forEach((p) => (totaal[p.id] = 0));
	veldIntervallen(w, nu).forEach((i) => {
		totaal[i.speler] = (totaal[i.speler] ?? 0) + (i.tot - i.van);
	});
	return totaal;
}

/** Seconden in het doel. Een helft keepen is geen halve wedstrijd voetballen. */
export function keepertijden(w: Wedstrijd | null, nu = Date.now()): Record<string, number> {
	const uit: Record<string, number> = {};
	if (!w) return uit;
	veldIntervallen(w, nu).forEach((i) => {
		if (plekLinie(i.plek, w.formatie) === 'K') {
			uit[i.speler] = (uit[i.speler] ?? 0) + (i.tot - i.van);
		}
	});
	return uit;
}

export function stand(w: Wedstrijd | null): [number, number] {
	if (!w) return [0, 0];
	const g: Gebeurtenis[] = w.gebeurtenissen;
	return [g.filter((x) => x.type === 'goal').length, g.filter((x) => x.type === 'tegen').length];
}
