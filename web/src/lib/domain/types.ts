/* De vorm van alles wat de app onthoudt. Deze namen komen letterlijk uit de
   oude versie, zodat wat er op je telefoon staat gewoon blijft werken. */

export type Line = 'K' | 'V' | 'M' | 'A' | '';
/** Een veldlinie: K staat er los van, want keepen kan naast je gewone plek. */
export type FieldLine = 'V' | 'M' | 'A' | '';

export interface Player {
	id: string;
	naam: string;
	linie: FieldLine;
	/** Kan keepen. Los van de veldlinie. */
	keept?: boolean;
}

export type MatchEventType = 'start' | 'rust' | 'eind' | 'goal' | 'tegen' | 'wissel' | 'ruil';

export interface MatchEvent {
	type: MatchEventType;
	/** seconden na de aftrap */
	t: number;
	/** bij een doelpunt: wie hem maakte, of null als je het niet weet */
	speler?: string | null;
	/** bij een doelpunt: wie hem klaarlegde. Overslaan mag. */
	assist?: string | null;
	eruit?: string;
	erin?: string;
	plek?: string;
	/** bij een ruil: de twee plekken die van speler wisselen, en wie er stonden */
	plekA?: string;
	plekB?: string;
	spelerA?: string | null;
	spelerB?: string | null;
	/** bij een pauze: welk deel er net afgelopen is */
	deel?: number;
}

/** Een opstelling: plek-id uit de formatie -> speler-id. */
export type Lineup = Record<string, string | null>;

export interface Match {
	datum: string;
	tegenstander: string;
	thuis: boolean;
	formatie: string;
	opstelling: Lineup;
	bank: string[];
	gebeurtenissen: MatchEvent[];
	/** seconden die al gelopen hebben, exclusief de lopende periode */
	verstreken: number;
	/** tijdstip waarop de klok voor het laatst is gestart, in ms */
	sinds: number | null;
	loopt: boolean;
	/** in hoeveel delen je speelt: 2 helften of 4 kwarten */
	delen: 2 | 4;
	/** het deel waar je nu in zit, 1 tot en met `delen` */
	deel: number;
	/** tussen twee delen in: de klok staat stil en het volgende moet nog beginnen */
	pauze: boolean;
	afgelopen: boolean;
	/** hoe het ging, in je eigen woorden */
	notitie?: string;
	bewaard?: boolean;
	/** wie er vandaag niet is; die staan niet op de bank en tellen niet mee */
	afwezig?: string[];
}

export interface DefaultLineup {
	formatie: string;
	opstelling: Lineup;
	bank: string[];
}

export interface PlayingTimeRow {
	id?: string;
	naam: string;
	seconden: number;
	/** waarvan in het doel */
	keeper?: number;
	/** seconden per plek uit de formatie, bijvoorbeeld { K: 2100, LV: 2100 } */
	posities?: Record<string, number>;
}

export interface ArchivedMatch {
	datum: string;
	tegenstander: string;
	thuis: boolean;
	stand: [number, number];
	formatie: string;
	duur: number;
	/** hoe je team heette toen je bewaarde */
	teamnaam?: string;
	delen?: 2 | 4;
	notitie?: string;
	gebeurtenissen: MatchEvent[];
	/** de namen zoals ze waren toen je bewaarde */
	namen?: Record<string, string>;
	/** wie er die dag niet was. Zonder dit kun je nul minuten niet uit elkaar
	    houden: was hij er niet, of stond hij de hele wedstrijd op de bank? */
	afwezig?: string[];
	speeltijd: PlayingTimeRow[];
	/**
	 * De opstelling zoals hij aan het eind stond, plus wie er toen op de bank zat.
	 *
	 * Staat hier niet omdat een scherm het nodig heeft, maar omdat de speeltijd
	 * wordt teruggerekend vanaf de eindopstelling. Zonder dit is een bewaarde
	 * wedstrijd niet opnieuw uit te rekenen en dus nooit meer te repareren, ook
	 * niet als we dat later zouden willen. Bewaren kost een regel; niet bewaren
	 * is onomkeerbaar.
	 */
	opstelling?: Lineup;
	bank?: string[];
}

export type Attendance = 'ja' | 'af' | 'nee';

export interface Training {
	/** eigen id, zodat een adres blijft kloppen als de volgorde verandert */
	id: string;
	datum: string;
	status: Record<string, Attendance>;
}

export interface State {
	/** hoe jouw team heet; staat in de kop en in het verslag */
	teamnaam: string;
	spelers: Player[];
	formatie: string;
	/** minuten per deel; heet nog helftMinuten omdat het zo is opgeslagen */
	helftMinuten: number;
	delen: 2 | 4;
	wedstrijd: Match | null;
	standaard: DefaultLineup | null;
	archief: ArchivedMatch[];
	trainingen: Training[];
	verslagWissels: boolean;
}

export function emptyState(): State {
	return {
		teamnaam: 'Ons team',
		spelers: [],
		formatie: '4-3-3',
		helftMinuten: 35,
		delen: 2,
		wedstrijd: null,
		standaard: null,
		archief: [],
		trainingen: [],
		verslagWissels: false
	};
}
