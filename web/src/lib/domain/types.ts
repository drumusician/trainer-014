/* De vorm van alles wat de app onthoudt. Deze namen komen letterlijk uit de
   oude versie, zodat wat er op je telefoon staat gewoon blijft werken. */

export type Line = 'K' | 'V' | 'M' | 'A' | '';
/** Een veldlinie: K staat er los van, want keepen kan naast je gewone plek. */
export type FieldLine = 'V' | 'M' | 'A' | '';

export interface Player {
	id: string;
	name: string;
	line: FieldLine;
	/** Kan keepen. Los van de veldlinie. */
	keeper?: boolean;
}

export type MatchEventType = 'start' | 'break' | 'end' | 'goal' | 'conceded' | 'substitution' | 'swap';

export interface MatchEvent {
	type: MatchEventType;
	/** seconden na de aftrap */
	t: number;
	/** bij een doelpunt: wie hem maakte, of null als je het niet weet */
	player?: string | null;
	/** bij een doelpunt: wie hem klaarlegde. Overslaan mag. */
	assist?: string | null;
	off?: string;
	on?: string;
	position?: string;
	/** bij een ruil: de twee plekken die van speler wisselen, en wie er stonden */
	positionA?: string;
	positionB?: string;
	playerA?: string | null;
	playerB?: string | null;
	/** bij een pauze: welk deel er net afgelopen is */
	part?: number;
}

/** Een opstelling: plek-id uit de formatie -> speler-id. */
export type Lineup = Record<string, string | null>;

export interface Match {
	date: string;
	opponent: string;
	home: boolean;
	formation: string;
	lineup: Lineup;
	bench: string[];
	events: MatchEvent[];
	/** seconden die al gelopen hebben, exclusief de lopende periode */
	elapsed: number;
	/** tijdstip waarop de klok voor het laatst is gestart, in ms */
	since: number | null;
	running: boolean;
	/** in hoeveel delen je speelt: 2 helften of 4 kwarten */
	parts: 2 | 4;
	/** het deel waar je nu in zit, 1 tot en met `delen` */
	part: number;
	/** tussen twee delen in: de klok staat stil en het volgende moet nog beginnen */
	inBreak: boolean;
	finished: boolean;
	/** hoe het ging, in je eigen woorden */
	note?: string;
	archived?: boolean;
	/** wie er vandaag niet is; die staan niet op de bank en tellen niet mee */
	absent?: string[];
}

export interface DefaultLineup {
	formation: string;
	lineup: Lineup;
	bench: string[];
}

export interface PlayingTimeRow {
	id?: string;
	name: string;
	seconds: number;
	/** waarvan in het doel */
	keeper?: number;
	/** seconden per plek uit de formatie, bijvoorbeeld { K: 2100, LV: 2100 } */
	positions?: Record<string, number>;
}

export interface ArchivedMatch {
	date: string;
	opponent: string;
	home: boolean;
	score: [number, number];
	formation: string;
	duration: number;
	/** hoe je team heette toen je bewaarde */
	teamName?: string;
	parts?: 2 | 4;
	note?: string;
	events: MatchEvent[];
	/** de namen zoals ze waren toen je bewaarde */
	names?: Record<string, string>;
	/** wie er die dag niet was. Zonder dit kun je nul minuten niet uit elkaar
	    houden: was hij er niet, of stond hij de hele wedstrijd op de bank? */
	absent?: string[];
	playingTime: PlayingTimeRow[];
	/**
	 * De opstelling zoals hij aan het eind stond, plus wie er toen op de bank zat.
	 *
	 * Staat hier niet omdat een scherm het nodig heeft, maar omdat de speeltijd
	 * wordt teruggerekend vanaf de eindopstelling. Zonder dit is een bewaarde
	 * wedstrijd niet opnieuw uit te rekenen en dus nooit meer te repareren, ook
	 * niet als we dat later zouden willen. Bewaren kost een regel; niet bewaren
	 * is onomkeerbaar.
	 */
	lineup?: Lineup;
	bench?: string[];
}

export type Attendance = 'present' | 'excused' | 'absent';

export interface Training {
	/** eigen id, zodat een adres blijft kloppen als de volgorde verandert */
	id: string;
	date: string;
	status: Record<string, Attendance>;
}

export interface State {
	/** hoe jouw team heet; staat in de kop en in het verslag */
	teamName: string;
	players: Player[];
	formation: string;
	/** minuten per deel; heet nog helftMinuten omdat het zo is opgeslagen */
	minutesPerPart: number;
	parts: 2 | 4;
	match: Match | null;
	defaultLineup: DefaultLineup | null;
	archive: ArchivedMatch[];
	trainings: Training[];
	reportSubs: boolean;
}

export function emptyState(): State {
	return {
		teamName: 'Ons team',
		players: [],
		formation: '4-3-3',
		minutesPerPart: 35,
		parts: 2,
		match: null,
		defaultLineup: null,
		archive: [],
		trainings: [],
		reportSubs: false
	};
}
