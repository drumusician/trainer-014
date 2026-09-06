/* The shape of everything the app remembers. Anything stored under the older
   Dutch field names is converted on the way in; see migrate-storage.ts. */

export type Line = 'K' | 'V' | 'M' | 'A' | '';
/** A field line: K sits apart, because keeping comes on top of your usual position. */
export type FieldLine = 'V' | 'M' | 'A' | '';

export interface Player {
	id: string;
	name: string;
	line: FieldLine;
	/** Can keep. Separate from the field line. */
	keeper?: boolean;
}

export type MatchEventType = 'start' | 'break' | 'end' | 'goal' | 'conceded' | 'substitution' | 'swap';

export interface MatchEvent {
	type: MatchEventType;
	/** seconds after kick-off */
	t: number;
	/** on a goal: who scored it, or null when you do not know */
	player?: string | null;
	/** on a goal: who set it up. May be skipped. */
	assist?: string | null;
	off?: string;
	on?: string;
	position?: string;
	/** on a swap: the two positions exchanging players, and who stood there */
	positionA?: string;
	positionB?: string;
	playerA?: string | null;
	playerB?: string | null;
	/** on a break: which part has just ended */
	part?: number;
}

/** A lineup: position id from the formation -> player id. */
export type Lineup = Record<string, string | null>;

export interface Match {
	date: string;
	opponent: string;
	home: boolean;
	formation: string;
	lineup: Lineup;
	bench: string[];
	events: MatchEvent[];
	/** seconds already run, excluding the period currently running */
	elapsed: number;
	/** when the clock was last started, in ms */
	since: number | null;
	running: boolean;
	/** how many parts you play: 2 halves or 4 quarters */
	parts: 2 | 4;
	/** the part you are in now, 1 through `parts` */
	part: number;
	/** between two parts: the clock is stopped and the next has yet to begin */
	inBreak: boolean;
	finished: boolean;
	/** how it went, in your own words */
	note?: string;
	archived?: boolean;
	/** who is not there today; they are off the bench and do not count */
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
	/** of which in goal */
	keeper?: number;
	/** seconds per formation position, for example { K: 2100, LV: 2100 } */
	positions?: Record<string, number>;
}

export interface ArchivedMatch {
	date: string;
	opponent: string;
	home: boolean;
	score: [number, number];
	formation: string;
	duration: number;
	/** what your team was called when you archived it */
	teamName?: string;
	parts?: 2 | 4;
	note?: string;
	events: MatchEvent[];
	/** the names as they were when you archived it */
	names?: Record<string, string>;
	/** who was not there that day. Without this you cannot tell two kinds of zero
	    apart: was he absent, or on the bench all match? */
	absent?: string[];
	playingTime: PlayingTimeRow[];
	/**
	 * The lineup as it stood at the end, plus who was on the bench then.
	 *
	 * Stored not because a screen needs it, but because playing time is wound back
	 * from the final lineup. Without this an archived match cannot be recalculated
	 * and is therefore beyond repair forever, even if we wanted to later. Storing
	 * it costs one field; not storing it is irreversible.
	 */
	lineup?: Lineup;
	bench?: string[];
}

export type Attendance = 'present' | 'excused' | 'absent';

export interface Training {
	/** its own id, so an address stays valid when the order changes */
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
