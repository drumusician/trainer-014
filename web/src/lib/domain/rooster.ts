import type { Match, Player } from './types';
import { standOp } from './plan';
import { elapsed, playingTimes } from './time';
import { positionCount } from './formations';
import { kickedOff } from '$lib/actions/clock';

/*
 * Het wisselplan als rooster: per speler een regel, per blok een kolom, en de
 * minuten erachter. Zo zie je in één oogopslag wie wanneer speelt en of het
 * eerlijk verdeeld is. Dezelfde regels als Domain/Rooster.swift in de iPhone-app.
 *
 * Het rooster is een blik op het plan, geen tweede plan: tik je in een kolom wie
 * eruit gaat en wie erin komt, dan is dat gewoon een stap op de grens van dat blok.
 * Bij kwarten is elk kwart een blok, bij helften elke helft in tweeën.
 */

export interface Blok {
	/** de minuut waarop het blok begint, over de hele wedstrijd */
	start: number;
	eind: number;
	/** begint het blok na een pauze, dan na welk deel */
	naDeel?: number;
	/** kun je hier nog een wissel op de grens zetten: de grens komt nog */
	teVeranderen: boolean;
}

export interface RoosterRegel {
	id: string;
	/** per blok de plek in het veld, of null op de bank */
	plekken: (string | null)[];
	/** gespeeld en nog gepland, in hele minuten */
	minuten: number;
	/** duidelijk minder dan eerlijk is */
	weinig: boolean;
}

export interface Rooster {
	blokken: Blok[];
	regels: RoosterRegel[];
	/** zoveel minuten krijgt iedereen als je het helemaal gelijk verdeelt */
	eerlijk: number;
}

/** De blokken van een wedstrijd: bij vier delen of meer elk deel, anders elk deel in tweeën. */
export function roosterBlokken(parts: number, minutesPerPart: number): { start: number; naDeel?: number }[] {
	const delen = Math.max(1, parts);
	const perDeel = delen >= 4 ? 1 : 2;
	const uit: { start: number; naDeel?: number }[] = [];
	for (let d = 0; d < delen; d++) {
		for (let k = 0; k < perDeel; k++) {
			const start = Math.round(minutesPerPart * (d + k / perDeel));
			uit.push(k === 0 && d > 0 ? { start, naDeel: d } : { start });
		}
	}
	return uit;
}

/**
 * Het rooster van deze wedstrijd. Vóór de aftrap alles vooruit; daarna telt wat
 * er gespeeld is, en de blokken die al voorbij zijn vallen weg.
 */
export function rooster(w: Match, players: Player[], minutesPerPart: number, nu = Date.now()): Rooster {
	const totaal = Math.round(minutesPerPart * Math.max(1, w.parts));
	const nuMinuut = kickedOff(w) ? Math.floor(elapsed(w, nu) / 60) : 0;
	const grenzen = roosterBlokken(w.parts, minutesPerPart);
	const blokken: Blok[] = [];
	grenzen.forEach((g, i) => {
		const eind = i + 1 < grenzen.length ? grenzen[i + 1].start : totaal;
		if (eind <= nuMinuut && i !== grenzen.length - 1) return;
		blokken.push({ ...g, eind, teVeranderen: i > 0 && g.start >= nuMinuut });
	});

	/* Wie erbij hoort: wie er bij de aftrap staat, op volgorde van het veld, en dan de bank. */
	const begin = standOp(w, nuMinuut);
	const afwezig = new Set(w.absent ?? []);
	const ids = [...new Set([...begin.veld.map((r) => r.id), ...begin.bank])].filter((id) => !afwezig.has(id));

	/* De minuten: wat al gespeeld is, en per stukje tot het eind wie er dan staat. */
	const gespeeld = playingTimes(w, players, nu);
	const minuten: Record<string, number> = {};
	for (const id of ids) minuten[id] = (gespeeld[id] ?? 0) / 60;
	const momenten = new Set([nuMinuut, totaal]);
	for (const b of blokken) if (b.start > nuMinuut) momenten.add(b.start);
	for (const s of w.plan ?? []) if (s.minuut > nuMinuut && s.minuut < totaal) momenten.add(s.minuut);
	const op = [...momenten].sort((a, b) => a - b);
	for (let i = 0; i + 1 < op.length; i++) {
		for (const plek of standOp(w, op[i]).veld) minuten[plek.id] = (minuten[plek.id] ?? 0) + (op[i + 1] - op[i]);
	}

	const veldplekken = positionCount(w.formation);
	const eerlijk = ids.length ? Math.round((Math.min(veldplekken, ids.length) * totaal) / ids.length) : 0;
	const blokLengte = totaal / Math.max(1, grenzen.length);
	const regels = ids.map((id) => {
		const plekken = blokken.map(
			(b) => standOp(w, Math.max(b.start, nuMinuut)).veld.find((r) => r.id === id)?.plek ?? null
		);
		const m = Math.round(minuten[id] ?? 0);
		return { id, plekken, minuten: m, weinig: m < eerlijk - blokLengte / 2 };
	});
	return { blokken, regels, eerlijk };
}
