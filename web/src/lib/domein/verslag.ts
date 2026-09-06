import { positionLabel } from './formaties';
import type { ArchivedMatch, MatchEvent, Player, Match } from './types';
import { endTime, score } from './tijd';
import { partName, breakName } from './delen';

/** Alles wat je nodig hebt om een wedstrijd terug te lezen, live of uit het archief. */
export interface ReportSource {
	datum: string;
	tegenstander: string;
	thuis: boolean;
	stand: [number, number];
	formatie: string;
	duur: number;
	gebeurtenissen: MatchEvent[];
	namen?: Record<string, string>;
	delen?: 2 | 4;
	notitie?: string;
	teamnaam?: string;
}

export function bronVanWedstrijd(w: Match, teamnaam: string): ReportSource {
	return {
		datum: w.datum,
		tegenstander: w.tegenstander,
		thuis: w.thuis,
		stand: score(w),
		formatie: w.formatie,
		duur: endTime(w),
		gebeurtenissen: w.gebeurtenissen,
		delen: w.delen,
		notitie: w.notitie,
		teamnaam
	};
}

export function bronVanArchief(a: ArchivedMatch): ReportSource {
	return {
		datum: a.datum,
		tegenstander: a.tegenstander,
		thuis: a.thuis !== false,
		stand: a.stand ?? [0, 0],
		formatie: a.formatie,
		duur: a.duur ?? 0,
		gebeurtenissen: a.gebeurtenissen ?? [],
		namen: a.namen,
		delen: a.delen,
		notitie: a.notitie,
		teamnaam: a.teamnaam
	};
}

/** De naam van nu; valt terug op de naam zoals hij bij het bewaren was. */
export function nameOf(id: string | null | undefined, spelers: Player[], namen?: Record<string, string>): string {
	if (!id) return 'onbekend';
	return spelers.find((p) => p.id === id)?.naam ?? namen?.[id] ?? 'onbekend';
}

export function eventText(
	g: MatchEvent,
	spelers: Player[],
	namen?: Record<string, string>,
	delen: 2 | 4 = 2,
	formatie?: string
): string {
	const naam = (id?: string | null) => nameOf(id, spelers, namen);
	/* Zonder formatie weten we de leesbare naam niet; dan maar de plek zelf. */
	const plek = (id?: string | null) => (id ? (formatie ? positionLabel(id, formatie) : id) : '');
	switch (g.type) {
		case 'start':
			return 'Aftrap';
		case 'rust':
			return g.deel ? breakName(g.deel, delen) + ' — ' + partName(g.deel, delen) + ' voorbij' : 'Rust';
		case 'eind':
			return 'Einde';
		case 'tegen':
			return 'Tegendoelpunt';
		case 'goal':
			return (
				'Doelpunt' + (g.speler ? ' — ' + naam(g.speler) : '') + (g.assist ? ' (assist ' + naam(g.assist) + ')' : '')
			);
		case 'wissel':
			return naam(g.erin) + ' voor ' + naam(g.eruit) + (g.plek ? ' op ' + plek(g.plek) : '');
		case 'ruil':
			/* Waar ze naartoe gingen zegt meer dan dat ze wisselden. Oudere
			   wedstrijden legden alleen de plekken vast, niet wie er stonden. */
			if (g.spelerA && g.spelerB && g.plekA && g.plekB) {
				return naam(g.spelerA) + ' naar ' + plek(g.plekB) + ', ' + naam(g.spelerB) + ' naar ' + plek(g.plekA);
			}
			if (g.plekA && g.plekB) return 'Van plek gewisseld: ' + plek(g.plekA) + ' en ' + plek(g.plekB);
			return 'Van plek gewisseld';
		default:
			return g.type;
	}
}

export function dateText(datum: string): string {
	try {
		return new Date(datum + 'T12:00:00').toLocaleDateString('nl-NL', {
			weekday: 'long',
			day: 'numeric',
			month: 'long'
		});
	} catch {
		return datum;
	}
}

/**
 * Het verslag voor de groepsapp. Wissels blijven er standaard uit: de uitslag
 * is voor iedereen, de opstelling is van de trainer.
 */
export function reportText(bron: ReportSource, spelers: Player[], metWissels = false): string {
	const [v, t] = bron.stand;
	const thuis = bron.thuis !== false;
	const ons = bron.teamnaam?.trim() || 'Ons team';
	const regels: string[] = [];
	regels.push(
		(thuis ? ons + ' – ' + bron.tegenstander : bron.tegenstander + ' – ' + ons) +
			' ' +
			(thuis ? v + '–' + t : t + '–' + v)
	);
	regels.push(dateText(bron.datum));
	regels.push('');

	let voor = 0;
	let tegen = 0;
	[...bron.gebeurtenissen]
		.sort((a, b) => (a.t ?? 0) - (b.t ?? 0))
		.forEach((g) => {
			const min = Math.floor((g.t ?? 0) / 60) + '′';
			if (g.type === 'goal') {
				voor++;
				const naam = g.speler ? nameOf(g.speler, spelers, bron.namen) : null;
				const assist = g.assist ? nameOf(g.assist, spelers, bron.namen) : null;
				regels.push(
					`${min}  ${voor}–${tegen}  ${naam && naam !== 'onbekend' ? naam : 'doelpunt'}` +
						(assist && assist !== 'onbekend' ? ` (assist ${assist})` : '')
				);
			} else if (g.type === 'tegen') {
				tegen++;
				regels.push(`${min}  ${voor}–${tegen}  tegendoelpunt`);
			} else if (g.type === 'wissel' && metWissels) {
				regels.push(`${min}       ${nameOf(g.erin, spelers, bron.namen)} voor ${nameOf(g.eruit, spelers, bron.namen)}`);
			}
		});
	if (voor + tegen === 0) regels.push('Geen doelpunten.');
	if (bron.notitie?.trim()) {
		regels.push('');
		regels.push(bron.notitie.trim());
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
	gebeurtenissen: MatchEvent[],
	spelers: Player[],
	namen?: Record<string, string>,
	delen: 2 | 4 = 2,
	formatie?: string
): TimelineRow[] {
	const naam = (id?: string | null) => nameOf(id, spelers, namen);
	const plek = (id?: string | null) => (id ? (formatie ? positionLabel(id, formatie) : id) : '');
	const uit: TimelineRow[] = [];

	for (let i = 0; i < gebeurtenissen.length; i++) {
		const g = gebeurtenissen[i];
		if (g.type !== 'ruil') {
			uit.push({ t: g.t ?? 0, tekst: eventText(g, spelers, namen, delen, formatie), index: i, type: g.type });
			continue;
		}

		const vanaf: Record<string, string> = {};
		const naartoe: Record<string, string> = {};
		const volgorde: string[] = [];
		let j = i;
		while (j < gebeurtenissen.length) {
			const r = gebeurtenissen[j];
			if (r.type !== 'ruil' || (r.t ?? 0) !== (g.t ?? 0)) break;
			if (r.plekA && r.plekB) {
				const stappen: [string | null | undefined, string, string][] = [
					[r.spelerA, r.plekA, r.plekB],
					[r.spelerB, r.plekB, r.plekA]
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
			uit.push({ t: g.t ?? 0, tekst: eventText(g, spelers, namen, delen, formatie), index: i, type: g.type });
			i = j - 1;
			continue;
		}
		uit.push({
			t: g.t ?? 0,
			tekst: verhuisd.map((sp) => naam(sp) + ' naar ' + plek(naartoe[sp])).join(', '),
			index: i,
			type: g.type
		});
		i = j - 1;
	}
	return uit;
}
