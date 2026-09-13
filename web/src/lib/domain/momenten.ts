/**
 * De opstelling terugkijken, moment voor moment.
 *
 * Een opgeborgen wedstrijd bewaart de opstelling zoals die aan het eind stond,
 * plus alle wissels. Wie er begon staat er dus niet in — maar is er wel uit te
 * rekenen, precies zoals de speeltijd dat al doet: terugspoelen langs de wissels.
 *
 * Dat is nodig sinds er een tweede trainer is. Deed iemand anders de wedstrijd,
 * dan zie je achteraf wel wie er gewisseld is, maar niet waar je team mee begon —
 * en dan zegt zo'n lijst wissels je weinig.
 */
import { fieldIntervals } from './time';
import { timelineRows } from './report';
import type { ArchivedMatch, Match, Player } from './types';

export interface Moment {
	/** seconden na de aftrap */
	t: number;
	/** wat er op dat moment gebeurde, in de woorden van het verloop */
	tekst: string;
	lineup: Record<string, string>;
	bench: string[];
}

/**
 * Elk moment waarop de opstelling veranderde, te beginnen bij de aftrap.
 *
 * Wissels op dezelfde seconde horen bij één moment: in de rust gaan er vier
 * tegelijk, en dan wil je niet vier keer op Volgende tikken voor hetzelfde beeld.
 *
 * Leeg als de eindopstelling niet bewaard is. Dat is bij wedstrijden van voor die
 * gegevens meegingen; dan valt er niets terug te rekenen en is niets tonen beter
 * dan iets verzinnen.
 */
export function momentenVan(a: ArchivedMatch, players: Player[]): Moment[] {
	if (!a.lineup || !Object.values(a.lineup).some(Boolean)) return [];

	const w = {
		...a,
		finished: true,
		elapsed: a.duration ?? 0,
		since: null,
		running: false,
		part: a.parts ?? 2,
		inBreak: false
	} as unknown as Match;

	const intervallen = fieldIntervals(w, Date.now());
	if (!intervallen.length) return [];

	const afwezig = new Set(a.absent ?? []);
	/* Wie er die dag bij was: iedereen met een speeltijdrij, min wie is afgemeld.
	   Zo staat iemand die nul minuten speelde wel op de bank, want dat is waar hij
	   stond. */
	const erbij = (a.playingTime ?? []).map((r) => r.id).filter((id): id is string => !!id && !afwezig.has(id));

	const regels = timelineRows(a.events ?? [], players, a.names, a.parts, a.formation);
	const tekstOp = (t: number) =>
		regels
			.filter((r) => r.t === t && (t === 0 ? r.type === 'start' : r.type === 'substitution' || r.type === 'swap'))
			.map((r) => r.tekst)
			.join(' · ');

	const tijden = [
		0,
		...(a.events ?? []).filter((g) => g.type === 'substitution' || g.type === 'swap').map((g) => g.t ?? 0)
	];

	const gezien = new Set<number>();
	const uit: Moment[] = [];
	for (const t of tijden.sort((x, y) => x - y)) {
		if (gezien.has(t)) continue;
		gezien.add(t);
		const lineup: Record<string, string> = {};
		for (const i of intervallen) if (i.van <= t && t < i.tot) lineup[i.position] = i.player;
		const opHetVeld = new Set(Object.values(lineup));
		uit.push({
			t,
			tekst: tekstOp(t) || 'Aftrap',
			lineup,
			bench: erbij.filter((id) => !opHetVeld.has(id))
		});
	}
	return uit;
}
