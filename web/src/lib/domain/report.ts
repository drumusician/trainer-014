import { positionLabel } from './formations';
import type { ArchivedMatch, MatchEvent, Player, Match } from './types';
import { endTime, score } from './time';
import { partName, breakName } from './parts';

/** Alles wat je nodig hebt om een wedstrijd terug te lezen, live of uit het archief. */
export interface ReportSource {
	date: string;
	opponent: string;
	home: boolean;
	score: [number, number];
	formation: string;
	duration: number;
	events: MatchEvent[];
	names?: Record<string, string>;
	parts?: 2 | 4;
	note?: string;
	teamName?: string;
}

export function bronVanWedstrijd(w: Match, teamName: string): ReportSource {
	return {
		date: w.date,
		opponent: w.opponent,
		home: w.home,
		score: score(w),
		formation: w.formation,
		duration: endTime(w),
		events: w.events,
		parts: w.parts,
		note: w.note,
		teamName
	};
}

export function bronVanArchief(a: ArchivedMatch): ReportSource {
	return {
		date: a.date,
		opponent: a.opponent,
		home: a.home !== false,
		score: a.score ?? [0, 0],
		formation: a.formation,
		duration: a.duration ?? 0,
		events: a.events ?? [],
		names: a.names,
		parts: a.parts,
		note: a.note,
		teamName: a.teamName
	};
}

/** De naam van nu; valt terug op de naam zoals hij bij het bewaren was. */
export function nameOf(id: string | null | undefined, players: Player[], names?: Record<string, string>): string {
	if (!id) return 'onbekend';
	return players.find((p) => p.id === id)?.name ?? names?.[id] ?? 'onbekend';
}

export function eventText(
	g: MatchEvent,
	players: Player[],
	names?: Record<string, string>,
	parts: 2 | 4 = 2,
	formation?: string
): string {
	const name = (id?: string | null) => nameOf(id, players, names);
	/* Zonder formatie weten we de leesbare naam niet; dan maar de plek zelf. */
	const position = (id?: string | null) => (id ? (formation ? positionLabel(id, formation) : id) : '');
	switch (g.type) {
		case 'start':
			return 'Aftrap';
		case 'break':
			return g.part ? breakName(g.part, parts) + ' — ' + partName(g.part, parts) + ' voorbij' : 'Rust';
		case 'end':
			return 'Einde';
		case 'conceded':
			return 'Tegendoelpunt';
		case 'goal':
			return (
				'Doelpunt' + (g.player ? ' — ' + name(g.player) : '') + (g.assist ? ' (assist ' + name(g.assist) + ')' : '')
			);
		case 'substitution':
			return name(g.on) + ' voor ' + name(g.off) + (g.position ? ' op ' + position(g.position) : '');
		case 'swap':
			/* Waar ze naartoe gingen zegt meer dan dat ze wisselden. Oudere
			   wedstrijden legden alleen de plekken vast, niet wie er stonden. */
			if (g.playerA && g.playerB && g.positionA && g.positionB) {
				return (
					name(g.playerA) + ' naar ' + position(g.positionB) + ', ' + name(g.playerB) + ' naar ' + position(g.positionA)
				);
			}
			if (g.positionA && g.positionB)
				return 'Van plek gewisseld: ' + position(g.positionA) + ' en ' + position(g.positionB);
			return 'Van plek gewisseld';
		default:
			return g.type;
	}
}

export function dateText(date: string): string {
	try {
		return new Date(date + 'T12:00:00').toLocaleDateString('nl-NL', {
			weekday: 'long',
			day: 'numeric',
			month: 'long'
		});
	} catch {
		return date;
	}
}

/**
 * Het verslag voor de groepsapp. Wissels blijven er standaard uit: de uitslag
 * is voor iedereen, de opstelling is van de trainer.
 */
export function reportText(bron: ReportSource, players: Player[], metWissels = false): string {
	const [v, t] = bron.score;
	const home = bron.home !== false;
	const ons = bron.teamName?.trim() || 'Ons team';
	const regels: string[] = [];
	regels.push(
		(home ? ons + ' – ' + bron.opponent : bron.opponent + ' – ' + ons) + ' ' + (home ? v + '–' + t : t + '–' + v)
	);
	regels.push(dateText(bron.date));
	regels.push('');

	let voor = 0;
	let tegen = 0;
	[...bron.events]
		.sort((a, b) => (a.t ?? 0) - (b.t ?? 0))
		.forEach((g) => {
			const min = Math.floor((g.t ?? 0) / 60) + '′';
			if (g.type === 'goal') {
				voor++;
				const name = g.player ? nameOf(g.player, players, bron.names) : null;
				const assist = g.assist ? nameOf(g.assist, players, bron.names) : null;
				regels.push(
					`${min}  ${voor}–${tegen}  ${name && name !== 'onbekend' ? name : 'doelpunt'}` +
						(assist && assist !== 'onbekend' ? ` (assist ${assist})` : '')
				);
			} else if (g.type === 'conceded') {
				tegen++;
				regels.push(`${min}  ${voor}–${tegen}  tegendoelpunt`);
			} else if (g.type === 'substitution' && metWissels) {
				regels.push(`${min}       ${nameOf(g.on, players, bron.names)} voor ${nameOf(g.off, players, bron.names)}`);
			}
		});
	if (voor + tegen === 0) regels.push('Geen doelpunten.');
	if (bron.note?.trim()) {
		regels.push('');
		regels.push(bron.note.trim());
	}
	return regels.join('\n');
}

export interface TimelineRow {
	t: number;
	tekst: string;
	/** plek in de oorspronkelijke lijst, zodat een doelpunt te verwijderen blijft */
	index: number;
	type: MatchEvent['type'];
}

/**
 * Het verloop als regels om te tonen.
 *
 * Ruilen die op hetzelfde tijdstip achter elkaar staan worden één regel. Een
 * rondje van vier spelers kan niet in minder dan drie paarsgewijze ruilen, dus
 * anders lijkt iemand in dezelfde seconde twee keer te verhuizen. Wat je wilt
 * lezen is waar iedereen terechtkwam, niet hoe de administratie daar kwam.
 */
export function timelineRows(
	events: MatchEvent[],
	players: Player[],
	names?: Record<string, string>,
	parts: 2 | 4 = 2,
	formation?: string
): TimelineRow[] {
	const name = (id?: string | null) => nameOf(id, players, names);
	const position = (id?: string | null) => (id ? (formation ? positionLabel(id, formation) : id) : '');
	const uit: TimelineRow[] = [];

	for (let i = 0; i < events.length; i++) {
		const g = events[i];
		if (g.type !== 'swap') {
			uit.push({ t: g.t ?? 0, tekst: eventText(g, players, names, parts, formation), index: i, type: g.type });
			continue;
		}

		const vanaf: Record<string, string> = {};
		const naartoe: Record<string, string> = {};
		const volgorde: string[] = [];
		let j = i;
		while (j < events.length) {
			const r = events[j];
			if (r.type !== 'swap' || (r.t ?? 0) !== (g.t ?? 0)) break;
			if (r.positionA && r.positionB) {
				const stappen: [string | null | undefined, string, string][] = [
					[r.playerA, r.positionA, r.positionB],
					[r.playerB, r.positionB, r.positionA]
				];
				for (const [sp, van, naar] of stappen) {
					if (!sp) continue;
					if (!(sp in vanaf)) {
						vanaf[sp] = van;
						volgorde.push(sp);
					}
					naartoe[sp] = naar;
				}
			}
			j++;
		}

		const verhuisd = volgorde.filter((sp) => vanaf[sp] !== naartoe[sp]);
		if (!verhuisd.length) {
			/* Geen namen vastgelegd, of alles kwam weer op zijn plek terug. */
			uit.push({ t: g.t ?? 0, tekst: eventText(g, players, names, parts, formation), index: i, type: g.type });
			i = j - 1;
			continue;
		}
		uit.push({
			t: g.t ?? 0,
			tekst: verhuisd.map((sp) => name(sp) + ' naar ' + position(naartoe[sp])).join(', '),
			index: i,
			type: g.type
		});
		i = j - 1;
	}
	return uit;
}
