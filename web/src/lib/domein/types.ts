/* De vorm van alles wat de app onthoudt. Deze namen komen letterlijk uit de
   oude versie, zodat wat er op je telefoon staat gewoon blijft werken. */

export type Linie = 'K' | 'V' | 'M' | 'A' | '';
/** Een veldlinie: K staat er los van, want keepen kan naast je gewone plek. */
export type Veldlinie = 'V' | 'M' | 'A' | '';

export interface Speler {
	id: string;
	naam: string;
	linie: Veldlinie;
	/** Kan keepen. Los van de veldlinie. */
	keept?: boolean;
}

export type GebeurtenisType = 'start' | 'rust' | 'eind' | 'goal' | 'tegen' | 'wissel' | 'ruil';

export interface Gebeurtenis {
	type: GebeurtenisType;
	/** seconden na de aftrap */
	t: number;
	/** bij een doelpunt: wie hem maakte, of null als je het niet weet */
	speler?: string | null;
	/** bij een doelpunt: wie hem klaarlegde. Overslaan mag. */
	assist?: string | null;
	eruit?: string;
	erin?: string;
	plek?: string;
	/** bij een ruil: de twee plekken die van speler wisselen */
	plekA?: string;
	plekB?: string;
}

/** Een opstelling: plek-id uit de formatie -> speler-id. */
export type Opstelling = Record<string, string | null>;

export interface Wedstrijd {
	datum: string;
	tegenstander: string;
	thuis: boolean;
	formatie: string;
	opstelling: Opstelling;
	bank: string[];
	gebeurtenissen: Gebeurtenis[];
	/** seconden die al gelopen hebben, exclusief de lopende periode */
	verstreken: number;
	/** tijdstip waarop de klok voor het laatst is gestart, in ms */
	sinds: number | null;
	loopt: boolean;
	helft: 1 | 2;
	afgelopen: boolean;
	bewaard?: boolean;
	/** wie er vandaag niet is; die staan niet op de bank en tellen niet mee */
	afwezig?: string[];
}

export interface Standaard {
	formatie: string;
	opstelling: Opstelling;
	bank: string[];
}

export interface SpeeltijdRegel {
	id?: string;
	naam: string;
	seconden: number;
	/** waarvan in het doel */
	keeper?: number;
}

export interface ArchiefWedstrijd {
	datum: string;
	tegenstander: string;
	thuis: boolean;
	stand: [number, number];
	formatie: string;
	duur: number;
	gebeurtenissen: Gebeurtenis[];
	/** de namen zoals ze waren toen je bewaarde */
	namen?: Record<string, string>;
	/** wie er die dag niet was. Zonder dit kun je nul minuten niet uit elkaar
	    houden: was hij er niet, of stond hij de hele wedstrijd op de bank? */
	afwezig?: string[];
	speeltijd: SpeeltijdRegel[];
}

export type Aanwezigheid = 'ja' | 'af' | 'nee';

export interface Training {
	/** eigen id, zodat een adres blijft kloppen als de volgorde verandert */
	id: string;
	datum: string;
	status: Record<string, Aanwezigheid>;
}

export interface Toestand {
	spelers: Speler[];
	formatie: string;
	helftMinuten: number;
	wedstrijd: Wedstrijd | null;
	standaard: Standaard | null;
	archief: ArchiefWedstrijd[];
	trainingen: Training[];
	verslagWissels: boolean;
}

export function legeToestand(): Toestand {
	return {
		spelers: [],
		formatie: '4-3-3',
		helftMinuten: 35,
		wedstrijd: null,
		standaard: null,
		archief: [],
		trainingen: [],
		verslagWissels: false
	};
}
