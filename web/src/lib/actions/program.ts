import type { ScheduledMatch, State, TaskKind, TeamTask } from '$lib/domain/types';
import { nieuwe } from './match';

/**
 * Het programma en de taken: wat er aan wedstrijden komt, en wie wat regelt.
 * Dezelfde regels als in de iPhone-app (`ProgramActions.swift`).
 *
 * Een wedstrijd uit het programma wordt op de dag zelf de wedstrijd, met
 * hetzelfde kenmerk. Zo blijven de taken eraan vast zitten.
 */

const nieuwKenmerk = (): string => crypto.randomUUID();

function sorteer(t: State) {
	t.program = [...(t.program ?? [])].sort((a, b) =>
		a.date !== b.date
			? a.date < b.date
				? -1
				: 1
			: (a.time ?? '') < (b.time ?? '')
				? -1
				: (a.time ?? '') > (b.time ?? '')
					? 1
					: 0
	);
}

/** Een aftrap als "10:30", of niets als het geen tijd is. */
export function tijd(s: string | null | undefined): string | undefined {
	const t = (s ?? '').trim();
	const m = /^(\d\d):(\d\d)$/.exec(t);
	if (!m) return undefined;
	return Number(m[1]) <= 23 && Number(m[2]) <= 59 ? t : undefined;
}

export function voegToe(
	t: State,
	datum: string,
	aanvang: string | undefined,
	tegenstander: string,
	thuis: boolean,
	nieuwId = nieuwKenmerk
): string {
	const id = nieuwId();
	const p: ScheduledMatch = { id, date: datum, opponent: tegenstander.trim() || 'Tegenstander', home: thuis };
	const tt = tijd(aanvang);
	if (tt) p.time = tt;
	t.program = [...(t.program ?? []), p];
	sorteer(t);
	return id;
}

export function wijzig(
	t: State,
	id: string,
	velden: { datum?: string; aanvang?: string | null; tegenstander?: string; thuis?: boolean }
): boolean {
	const p = t.program?.find((x) => x.id === id);
	if (!p) return false;
	if (velden.datum !== undefined) p.date = velden.datum;
	if (velden.aanvang !== undefined) {
		const tt = tijd(velden.aanvang);
		if (tt) p.time = tt;
		else delete p.time;
	}
	if (velden.tegenstander !== undefined) p.opponent = velden.tegenstander.trim() || 'Tegenstander';
	if (velden.thuis !== undefined) p.home = velden.thuis;
	sorteer(t);
	return true;
}

/** Een wedstrijd die toch niet doorgaat, met zijn taken. */
export function haalWeg(t: State, id: string): boolean {
	if (!t.program?.some((p) => p.id === id)) return false;
	t.program = t.program.filter((p) => p.id !== id);
	t.tasks = (t.tasks ?? []).filter((x) => x.matchId !== id);
	return true;
}

/** De wedstrijd van vandaag uit het programma halen en opzetten. Kan alleen als er geen andere openstaat. */
export function uitProgramma(t: State, id: string): boolean {
	const p = t.program?.find((x) => x.id === id);
	if (!p) return false;
	if (t.match && !t.match.archived) return false;
	nieuwe(t, p.opponent, p.home, p.date);
	t.match!.id = p.id;
	if (p.time) t.match!.time = p.time;
	t.match!.fromProgram = true;
	t.program = t.program!.filter((x) => x.id !== id);
	return true;
}

/** Een wedstrijd uit het programma weggooien zet hem terug, met zijn taken. */
export function terugInProgramma(t: State) {
	const w = t.match;
	if (!w || !w.fromProgram || w.archived || !w.id) return;
	if (t.program?.some((p) => p.id === w.id)) return;
	const p: ScheduledMatch = {
		id: w.id,
		date: w.date,
		opponent: w.opponent,
		home: w.home
	};
	if (w.time) p.time = w.time;
	t.program = [...(t.program ?? []), p];
	sorteer(t);
}

export function taken(t: State, wedstrijd: string): TeamTask[] {
	return (t.tasks ?? []).filter((x) => x.matchId === wedstrijd);
}

/** In plaats van een speler: de vereniging regelt het, zoals een clubscheidsrechter. */
export const VERENIGING = 'vereniging';

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
