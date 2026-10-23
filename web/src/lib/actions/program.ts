import type { Match, Player, State, TaskKind, TeamTask } from '$lib/domain/types';
import { fillFromDefaultLineup, rebuildBench, zonderAfwezigen } from './match';
import { kickedOff } from './clock';
import { knowsFormation } from '$lib/domain/formations';

/**
 * Het programma en de taken: wat er aan wedstrijden komt, en wie wat regelt.
 * Dezelfde regels als in de iPhone-app (`ProgramActions.swift`).
 *
 * Een wedstrijd in het programma is een gewone wedstrijd. Open je hem
 * (`open`), dan wordt hij `t.match`: daar maak je de opstelling, en daar speel
 * je hem. Open je een andere voordat de aftrap was, dan gaat deze terug in het
 * programma, met zijn opstelling. Het kenmerk blijft hetzelfde, zodat de taken
 * eraan vast blijven zitten.
 */

const nieuwKenmerk = (): string => crypto.randomUUID();

function eerder(a: Match, b: Match): number {
	if (a.date !== b.date) return a.date < b.date ? -1 : 1;
	const x = a.time ?? '';
	const y = b.time ?? '';
	return x < y ? -1 : x > y ? 1 : 0;
}

function sorteer(t: State) {
	t.program = [...(t.program ?? [])].sort(eerder);
}

/** Een aftrap als "10:30", of niets als het geen tijd is. */
export function tijd(s: string | null | undefined): string | undefined {
	const t = (s ?? '').trim();
	const m = /^(\d\d):(\d\d)$/.exec(t);
	if (!m) return undefined;
	return Number(m[1]) <= 23 && Number(m[2]) <= 59 ? t : undefined;
}

/**
 * Een wedstrijd uit oudere opslag, met alleen wanneer en tegen wie: maak er een
 * hele wedstrijd van, met de opstelling nog leeg.
 */
export function alsWedstrijd(t: State, p: Partial<Match> & { date: string; opponent: string; home: boolean }): Match {
	return {
		...p,
		formation: p.formation || t.formation,
		lineup: p.lineup ?? {},
		bench: p.bench ?? [],
		events: p.events ?? [],
		elapsed: p.elapsed ?? 0,
		since: p.since ?? null,
		running: p.running ?? false,
		parts: p.parts ?? t.parts,
		part: p.part ?? 1,
		inBreak: p.inBreak ?? false,
		finished: p.finished ?? false
	};
}

/**
 * Een wedstrijd erbij. Thuis staat de limonade al open, zodat een ouder hem
 * pakt; uit zegt een ouder zelf dat hij rijdt.
 */
export function voegToe(
	t: State,
	datum: string,
	aanvang: string | undefined,
	tegenstander: string,
	thuis: boolean,
	nieuwId = nieuwKenmerk,
	taakId = nieuwKenmerk
): string {
	const id = nieuwId();
	const p = alsWedstrijd(t, { id, date: datum, opponent: tegenstander.trim() || 'Tegenstander', home: thuis });
	const tt = tijd(aanvang);
	if (tt) p.time = tt;
	t.program = [...(t.program ?? []), p];
	zetStandaardTaken(t, id, thuis, taakId);
	sorteer(t);
	return id;
}

/**
 * Welke taken er bij een wedstrijd horen. Uit regelt de thuisclub de limonade
 * en het fluiten, en is er geen velddienst; thuis rijdt niemand.
 */
export function soorten(thuis: boolean): TaskKind[] {
	return thuis ? ['limonade', 'fluiten', 'vlaggen', 'velddienst', 'teamtas'] : ['rijden', 'vlaggen', 'teamtas'];
}

/** Thuis staat de limonade al open, zodat een ouder hem pakt; uit zegt een ouder zelf dat hij rijdt. */
function zetStandaardTaken(t: State, wedstrijd: string, thuis: boolean, taakId: () => string) {
	if (!thuis || (t.tasks ?? []).some((x) => x.matchId === wedstrijd && x.kind === 'limonade')) return;
	t.tasks = [...(t.tasks ?? []), { id: taakId(), matchId: wedstrijd, kind: 'limonade' }];
}

/** De wedstrijd die open staat, als die nog niet begonnen is. */
function openNogNiet(t: State): Match | null {
	const w = t.match;
	return w && !w.archived && !kickedOff(w) ? w : null;
}

/** Een wedstrijd die nog komt: uit het programma, of de wedstrijd die open staat en nog niet begon. */
export function wedstrijd(t: State, id: string): Match | undefined {
	return t.program?.find((x) => x.id === id) ?? (openNogNiet(t)?.id === id ? t.match! : undefined);
}

/** Wat nog komt en nog niet begon, vroegste eerst: het programma, met de wedstrijd die open staat. */
export function nogTeSpelen(t: State): Match[] {
	const open = openNogNiet(t);
	return [...(open ? [open] : []), ...(t.program ?? [])].sort(eerder);
}

export function wijzig(
	t: State,
	id: string,
	velden: { datum?: string; aanvang?: string | null; tegenstander?: string; thuis?: boolean }
): boolean {
	const p = wedstrijd(t, id);
	if (!p) return false;
	if (velden.datum !== undefined) p.date = velden.datum;
	if (velden.aanvang !== undefined) {
		const tt = tijd(velden.aanvang);
		if (tt) p.time = tt;
		else delete p.time;
	}
	if (velden.tegenstander !== undefined) p.opponent = velden.tegenstander.trim() || 'Tegenstander';
	if (velden.thuis !== undefined && velden.thuis !== p.home) {
		/* Van thuis naar uit of andersom: wat niet meer past gaat weg, wat open hoort komt erbij. */
		p.home = velden.thuis;
		const passend = soorten(velden.thuis);
		t.tasks = (t.tasks ?? []).filter((x) => x.matchId !== id || passend.includes(x.kind));
		zetStandaardTaken(t, id, velden.thuis, nieuwKenmerk);
	}
	sorteer(t);
	return true;
}

/** Een wedstrijd die toch niet doorgaat, met zijn taken. */
export function haalWeg(t: State, id: string): boolean {
	if (openNogNiet(t)?.id === id) {
		t.match = null;
	} else {
		if (!t.program?.some((p) => p.id === id)) return false;
		t.program = t.program.filter((p) => p.id !== id);
	}
	t.tasks = (t.tasks ?? []).filter((x) => x.matchId !== id);
	return true;
}

/**
 * Een wedstrijd uit het programma openen: Wie is er, de opstelling, het
 * wisselplan, en op de dag zelf de aftrap. Staat er een andere open die nog
 * niet begon, dan gaat die terug in het programma; een wedstrijd die bezig is
 * gaat voor.
 */
export function open(t: State, id: string): boolean {
	const gevonden = t.program?.find((x) => x.id === id);
	if (!gevonden) return false;
	if (t.match && !t.match.archived) {
		if (kickedOff(t.match)) return false;
		terugInProgramma(t);
	}
	const p = alsWedstrijd(t, gevonden);
	if (!p.formation || !knowsFormation(p.formation)) {
		p.formation = t.formation;
		p.parts = t.parts;
	}
	p.absent = (p.absent ?? []).filter((a) => t.players.some((s) => s.id === a));
	delete p.archived;
	p.fromProgram = true;
	zonderAfwezigen(p);
	t.program = (t.program ?? []).filter((x) => x.id !== id);
	t.match = p;
	if (Object.values(p.lineup).some(Boolean)) rebuildBench(t);
	else fillFromDefaultLineup(t);
	return true;
}

/** Een wedstrijd die open staat en nog niet begon, terug in het programma: met zijn opstelling, en zijn taken. */
export function terugInProgramma(t: State) {
	const w = t.match;
	if (!w || w.archived || kickedOff(w)) return;
	const p: Match = { ...w, id: w.id || nieuwKenmerk() };
	delete p.fromProgram;
	delete p.keptBy;
	t.match = null;
	t.program = [...(t.program ?? []).filter((x) => x.id !== p.id), p];
	sorteer(t);
}

/** Wie zich voor deze wedstrijd afmeldde, op volgorde van de selectie. */
export function kanNiet(t: State, id: string): Player[] {
	const weg = new Set(wedstrijd(t, id)?.absent ?? []);
	return t.players.filter((p) => weg.has(p.id));
}

export function taken(t: State, wedstrijd: string): TeamTask[] {
	return (t.tasks ?? []).filter((x) => x.matchId === wedstrijd);
}

/** In plaats van een speler: de vereniging regelt het, zoals een clubscheidsrechter. */
export const VERENIGING = 'vereniging';

/** In plaats van een speler: de taak staat open, een ouder kan hem pakken. */
export const OPEN = 'open';

/** Er moet nog iemand voor gevonden worden. */
export const isOpen = (x: TeamTask) => !x.player && !x.club;

/** Eén familie voor een taak die er één keer is, of VERENIGING. Niemand haalt de taak weg. */
export function zet(t: State, wedstrijd: string, soort: TaskKind, speler: string | null, nieuwId = nieuwKenmerk) {
	const lijst = t.tasks ?? [];
	const i = lijst.findIndex((x) => x.matchId === wedstrijd && x.kind === soort);
	if (!speler) {
		if (i >= 0) t.tasks = lijst.filter((_, j) => j !== i);
		return;
	}
	const club = speler === VERENIGING;
	const taak: TeamTask = i >= 0 ? lijst[i] : { id: nieuwId(), matchId: wedstrijd, kind: soort };
	if (club) {
		delete taak.player;
		taak.club = true;
	} else if (speler === OPEN) {
		delete taak.player;
		delete taak.club;
	} else {
		taak.player = speler;
		delete taak.club;
	}
	delete taak.declinedBy;
	t.tasks = i >= 0 ? [...lijst] : [...lijst, taak];
}

/** Bij rijden kunnen het er meer zijn. Leeg is een plek waar nog iemand voor gezocht wordt. */
export function voegTaakToe(
	t: State,
	wedstrijd: string,
	soort: TaskKind,
	speler: string | null,
	nieuwId = nieuwKenmerk
) {
	const taak: TeamTask = { id: nieuwId(), matchId: wedstrijd, kind: soort };
	if (speler) taak.player = speler;
	t.tasks = [...(t.tasks ?? []), taak];
	return taak.id;
}

export function wijs(t: State, taak: string, speler: string | null) {
	const x = t.tasks?.find((y) => y.id === taak);
	if (!x) return;
	if (speler) x.player = speler;
	else delete x.player;
	delete x.declinedBy;
	t.tasks = [...t.tasks!];
}

export function haalTaakWeg(t: State, taak: string) {
	t.tasks = (t.tasks ?? []).filter((x) => x.id !== taak);
}

export const SOORTEN: TaskKind[] = ['limonade', 'rijden', 'fluiten', 'vlaggen', 'velddienst', 'teamtas'];

export function woord(soort: TaskKind): string {
	return {
		limonade: 'Limonade',
		rijden: 'Rijden',
		fluiten: 'Fluiten',
		vlaggen: 'Vlaggen',
		velddienst: 'Velddienst',
		teamtas: 'Teamtas'
	}[soort];
}

/* ---------- wie deed wat ---------- */

/** Eén keer dat een familie een taak had of heeft. */
export interface Beurt {
	wedstrijd: string;
	datum: string;
	tegenstander: string;
	speler?: string;
	club: boolean;
	/** al gespeeld; anders staat hij nog in het programma of is hij bezig */
	geweest: boolean;
}

/**
 * Per wedstrijd wie deze taak had, oudste eerst: gespeeld, bezig, en wat nog
 * komt. Bij rijden kunnen het er meer per wedstrijd zijn. Net als
 * ProgramActions.beurten in de iPhone-app.
 */
export function beurten(t: State, soort: TaskKind): Beurt[] {
	const wedstrijden: { id: string; datum: string; tegen: string; geweest: boolean }[] = [];
	for (const w of t.archive) if (w.id) wedstrijden.push({ id: w.id, datum: w.date, tegen: w.opponent, geweest: true });
	const lopend = t.match && !t.match.archived && t.match.id ? t.match : undefined;
	if (lopend) wedstrijden.push({ id: lopend.id!, datum: lopend.date, tegen: lopend.opponent, geweest: false });
	for (const p of t.program ?? [])
		if (p.id) wedstrijden.push({ id: p.id, datum: p.date, tegen: p.opponent, geweest: false });
	wedstrijden.sort((a, b) => (a.datum < b.datum ? -1 : a.datum > b.datum ? 1 : 0));
	const uit: Beurt[] = [];
	for (const w of wedstrijden) {
		for (const taak of t.tasks ?? []) {
			if (taak.matchId !== w.id || taak.kind !== soort || isOpen(taak)) continue;
			uit.push({
				wedstrijd: w.id,
				datum: w.datum,
				tegenstander: w.tegen,
				speler: taak.player,
				club: taak.club === true,
				geweest: w.geweest
			});
		}
	}
	return uit;
}

/** Hoe vaak elke speler deze taak had of heeft, minst vaak eerst; spelers die nog nooit aan de beurt waren ook. */
export function telling(t: State, soort: TaskKind): { speler: Player; keer: number }[] {
	const lijst = beurten(t, soort);
	return t.players
		.map((p) => ({ speler: p, keer: lijst.filter((b) => b.speler === p.id).length }))
		.sort((a, b) => a.keer - b.keer || a.speler.name.localeCompare(b.speler.name, 'nl'));
}

/**
 * "Limonade Noah · Rijden Sem, nog 1 open · Bram kan niet": wie wat regelt, in
 * één regel. Net als TakenTekst.samenvatting in de iPhone-app.
 */
const wedstrijdVan = wedstrijd;

export function samenvatting(t: State, wedstrijd: string, naam: (id: string) => string | undefined): string {
	const lijst = taken(t, wedstrijd);
	const w = wedstrijdVan(t, wedstrijd);
	const delen: string[] = w && Object.values(w.lineup).some(Boolean) ? ['Opstelling klaar'] : [];
	for (const soort of SOORTEN) {
		const hier = lijst.filter((x) => x.kind === soort);
		if (!hier.length) continue;
		const wie = hier.flatMap((x) => (x.club ? ['vereniging'] : x.player ? [naam(x.player) ?? '?'] : []));
		const open = hier.filter(isOpen).length;
		let regel = woord(soort);
		if (wie.length) regel += ' ' + wie.join(', ');
		if (open) regel += wie.length ? `, nog ${open} open` : ' open';
		delen.push(regel);
	}
	const terug = lijst.flatMap((x) => (isOpen(x) && x.declinedBy ? [naam(x.declinedBy) ?? '?'] : []));
	if (terug.length) delen.push(terug.join(', ') + ' kan niet');
	const afgemeld = kanNiet(t, wedstrijd).flatMap((p) => naam(p.id) ?? []);
	if (afgemeld.length) delen.push('Afgemeld: ' + afgemeld.join(', '));
	return delen.join(' · ');
}
