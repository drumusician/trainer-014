import { kentFormatie } from './domein/formaties';
import { eindTijd, keepertijden, positietijden, speeltijden, stand, verstreken } from './domein/tijd';
import type {
	ArchiefWedstrijd,
	Gebeurtenis,
	GebeurtenisType,
	Opstelling,
	Speler,
	Toestand,
	Training,
	Veldlinie,
	Wedstrijd
} from './domein/types';
import { legeToestand } from './domein/types';
import * as archief from './acties/archief';
import * as opstellen from './acties/opstellen';
import * as selectie from './acties/selectie';
import * as trainingen from './acties/trainingen';

const SLEUTEL = 'o14-app-v1';

/** Draaien we ergens met opslag? Op de server niet, in een test wel. */
const opslag = () => (typeof localStorage === 'undefined' ? null : localStorage);

/** Oude opslag: 'K' was een linie. Nu staat keepen daarnaast. */
function migreer(t: Toestand): Toestand {
	t.spelers.forEach((p) => {
		if ((p.linie as string) === 'K') {
			p.linie = '';
			p.keept = true;
		}
	});
	if (!Array.isArray(t.trainingen)) t.trainingen = [];
	if (t.delen !== 4) t.delen = 2;
	if (!t.teamnaam?.trim()) t.teamnaam = 'Ons team';
	const w = t.wedstrijd as (Wedstrijd & { helft?: number }) | null;
	if (w && w.deel === undefined) {
		/* van vroeger: toen waren het altijd twee helften */
		w.delen = 2;
		w.deel = w.helft === 2 ? 2 : 1;
		w.pauze = false;
	}
	t.trainingen.forEach((tr, i) => {
		if (!tr.id) tr.id = 't' + (tr.datum ?? 'onbekend') + '-' + i; /* van voor de id's */
	});
	if (!Array.isArray(t.archief)) t.archief = [];
	/* Wedstrijden van voor die fix: wel gebeurtenissen, geen start. Zonder die
	   gebeurtenis denkt de app dat er nog niet is afgetrapt. */
	if (w && w.gebeurtenissen?.length && !w.gebeurtenissen.some((g) => g.type === 'start')) {
		w.gebeurtenissen.unshift({ type: 'start', t: 0 });
	}
	return t;
}

class App {
	toestand = $state<Toestand>(legeToestand());
	/** loopt mee met de klok, zodat schermen vanzelf bijwerken */
	nu = $state(Date.now());
	/** de plek die je hebt aangetikt om te wisselen */
	gekozenPlek = $state<string | null>(null);
	/** wordt na elke opslag geroepen, zodat de synchronisatie het weet */
	naBewaren: (() => void) | null = null;

	laad() {
		const bak = opslag();
		if (!bak) return;
		try {
			const ruw = bak.getItem(SLEUTEL);
			if (!ruw) return;
			const d = JSON.parse(ruw);
			if (d && Array.isArray(d.spelers)) {
				this.toestand = migreer({ ...legeToestand(), ...d });
				this.bewaar(); /* wat de migratie erbij zette, meteen vastleggen */
			}
		} catch {
			/* liever een lege app dan een stukke */
		}
	}

	bewaar() {
		const bak = opslag();
		if (!bak) return;
		try {
			bak.setItem(SLEUTEL, JSON.stringify(this.toestand));
		} catch {
			/* stil: vol geheugen mag de wedstrijd niet stoppen */
		}
		this.naBewaren?.();
	}

	/* ---------- selectie ---------- */
	spelerVan(id: string | null | undefined): Speler | undefined {
		return selectie.spelerVan(this.toestand, id);
	}

	namenErbij(tekst: string) {
		selectie.namenErbij(this.toestand, tekst);
		this.bewaar();
	}

	hernoem(p: Speler, naam: string) {
		selectie.hernoem(p, naam);
		this.bewaar();
	}

	verwijderSpeler(p: Speler) {
		selectie.verwijderSpeler(this.toestand, p);
		this.bewaar();
	}

	zetLinie(p: Speler, linie: Veldlinie) {
		selectie.zetLinie(p, linie);
		this.bewaar();
	}

	zetKeept(p: Speler) {
		selectie.zetKeept(p);
		this.bewaar();
	}

	/* ---------- wedstrijd ---------- */
	get wedstrijd(): Wedstrijd | null {
		return this.toestand.wedstrijd;
	}

	/** Is er afgetrapt? Pas dan ligt de opstelling vast en gaat de klok tellen. */
	get gestart(): boolean {
		return !!this.toestand.wedstrijd?.gebeurtenissen.some((g) => g.type === 'start');
	}

	nieuweWedstrijd(tegenstander: string, thuis: boolean) {
		const t = this.toestand;
		t.wedstrijd = {
			datum: new Date().toISOString().slice(0, 10),
			tegenstander: tegenstander || 'Tegenstander',
			thuis,
			formatie: t.formatie,
			opstelling: {},
			bank: [],
			gebeurtenissen: [],
			verstreken: 0,
			sinds: null,
			loopt: false,
			delen: t.delen,
			deel: 1,
			pauze: false,
			afgelopen: false,
			afwezig: []
		};
		this.vulUitStandaard();
		this.bewaar();
	}

	/** De wedstrijd begint met de standaardopstelling, voor zover die nog klopt. */
	vulUitStandaard() {
		const t = this.toestand;
		const w = t.wedstrijd;
		if (!w) return;
		const st = t.standaard;
		if (st && st.formatie === w.formatie) {
			for (const [plek, id] of Object.entries(st.opstelling)) {
				if (id && this.spelerVan(id)) w.opstelling[plek] = id;
			}
		}
		this.herzetBank();
	}

	/** De bank is iedereen die er is en niet in het veld staat. */
	herzetBank() {
		const t = this.toestand;
		const w = t.wedstrijd;
		if (!w) return;
		const inVeld = Object.values(w.opstelling).filter(Boolean) as string[];
		const afwezig = w.afwezig ?? [];
		w.bank = t.spelers.map((p) => p.id).filter((id) => !inVeld.includes(id) && !afwezig.includes(id));
	}

	/** Staat hij op het veld? */
	staatInVeld(spelerId: string): boolean {
		const w = this.toestand.wedstrijd;
		return !!w && Object.values(w.opstelling).includes(spelerId);
	}

	/**
	 * Afmelden mag zolang het de opstelling niet met terugwerkende kracht verandert.
	 *
	 * Voor de aftrap: iemand uit het veld halen is prima, zijn plek valt leeg.
	 * Daarna niet meer. De speeltijd wordt teruggerekend vanaf de opstelling van
	 * nu, dus wie je daar weghaalt heeft volgens die berekening nooit gespeeld —
	 * een heel gespeelde wedstrijd wordt dan stilletjes nul minuten. Wie speelt
	 * haal je eruit met een wissel. Van de bank afmelden mag wel: dat raakt het
	 * veld niet, en iemand kan nu eenmaal pas na de aftrap afhaken.
	 */
	zetAfwezig(spelerId: string, afwezig: boolean) {
		const w = this.toestand.wedstrijd;
		if (!w) return;
		if (afwezig && this.gestart && this.staatInVeld(spelerId)) return;
		/* eslint-disable-next-line svelte/prefer-svelte-reactivity -- lokaal hulpje, gaat als array de toestand in */
		const lijst = new Set(w.afwezig ?? []);
		if (afwezig) {
			lijst.add(spelerId);
			for (const plek of Object.keys(w.opstelling)) {
				if (w.opstelling[plek] === spelerId) w.opstelling[plek] = null;
			}
		} else {
			lijst.delete(spelerId);
		}
		w.afwezig = [...lijst];
		this.herzetBank();
		this.bewaar();
	}

	/** De klok bijstellen als de scheidsrechter er anders over denkt. */
	verschuifKlok(seconden: number) {
		const w = this.toestand.wedstrijd;
		if (!w || w.afgelopen) return;
		w.verstreken = Math.max(0, w.verstreken + seconden);
		this.nu = Date.now();
		this.bewaar();
	}

	/** Een proefwedstrijd of een misser weggooien. */
	gooiWedstrijdWeg() {
		this.toestand.wedstrijd = null;
		this.gekozenPlek = null;
		this.bewaar();
	}

	log(type: GebeurtenisType, extra: Partial<Gebeurtenis> = {}) {
		const w = this.toestand.wedstrijd;
		if (!w) return;
		w.gebeurtenissen.push({ type, t: verstreken(w, this.nu), ...extra } as Gebeurtenis);
	}

	loopToggle() {
		const w = this.toestand.wedstrijd;
		if (!w || w.afgelopen) return;
		if (w.loopt) {
			w.verstreken += (Date.now() - (w.sinds ?? Date.now())) / 1000;
			w.loopt = false;
			w.sinds = null;
		} else {
			/* Op het ontbreken van een start-gebeurtenis letten, niet op een lege lijst.
			   Wie voor het fluitsignaal nog even schuift had al iets in de lijst staan,
			   en dan werd 'start' nooit vastgelegd. De app dacht de hele wedstrijd dat
			   er nog niet was afgetrapt: positiewissels werden niet meer bewaard, de
			   tabbalk bleef staan en de wedstrijd was niet beschermd tegen ophalen. */
			if (!this.gestart) {
				/* De datum pas nu vastleggen. Sinds je een wedstrijd vooruit kunt
				   klaarzetten is de dag waarop je hem aanmaakte niet de speeldag. */
				w.datum = new Date().toISOString().slice(0, 10);
				this.log('start');
			}
			w.loopt = true;
			w.sinds = Date.now();
		}
		this.nu = Date.now();
		this.bewaar();
	}

	/**
	 * Het huidige deel afsluiten, of het volgende beginnen. Werkt hetzelfde voor
	 * twee helften als voor vier kwarten.
	 */
	deelToggle() {
		const w = this.toestand.wedstrijd;
		if (!w || w.afgelopen) return;
		if (w.pauze) {
			w.deel = Math.min(w.deel + 1, w.delen);
			w.pauze = false;
			if (!w.loopt) this.loopToggle();
		} else if (w.deel < w.delen) {
			if (w.loopt) this.loopToggle();
			this.log('rust', { deel: w.deel });
			w.pauze = true;
		}
		this.bewaar();
	}

	/** Kan er nog een deel bij, of is dit het laatste? */
	get magVolgendDeel(): boolean {
		const w = this.toestand.wedstrijd;
		return !!w && !w.afgelopen && (w.pauze || w.deel < w.delen);
	}

	zetTegenstander(naam: string) {
		const w = this.toestand.wedstrijd;
		if (!w) return;
		w.tegenstander = naam.trim() || 'Tegenstander';
		this.bewaar();
	}

	zetThuis(thuis: boolean) {
		const w = this.toestand.wedstrijd;
		if (!w) return;
		w.thuis = thuis;
		this.bewaar();
	}

	zetTeamnaam(naam: string) {
		this.toestand.teamnaam = naam.trim() || 'Ons team';
		this.bewaar();
	}

	zetNotitie(tekst: string) {
		const w = this.toestand.wedstrijd;
		if (!w) return;
		w.notitie = tekst;
		this.bewaar();
	}

	zetArchiefNotitie(i: number, tekst: string) {
		if (archief.zetNotitie(this.toestand, i, tekst)) this.bewaar();
	}

	/** Iemand van de bank op de gekozen plek zetten. Tijdens een wedstrijd is dat een wissel. */
	zetOpPlek(spelerId: string) {
		const w = this.toestand.wedstrijd;
		if (!w || !this.gekozenPlek) return;
		const plek = this.gekozenPlek;
		const eruit = w.opstelling[plek];
		w.opstelling[plek] = spelerId;
		w.bank = w.bank.filter((x) => x !== spelerId);
		if (eruit) {
			w.bank.push(eruit);
			/* Voor de aftrap is dit je opstelling maken, geen wissel. Net als bij ruilen. */
			if (this.gestart) this.log('wissel', { eruit, erin: spelerId, plek });
		}
		this.gekozenPlek = null;
		this.bewaar();
	}

	/** Twee spelers op het veld wisselen van plek. Wordt vastgelegd, want anders
	    klopt straks de speeltijd per plek niet meer. */
	ruilInWedstrijd(plekA: string, plekB: string) {
		const w = this.toestand.wedstrijd;
		if (!w || plekA === plekB) return;
		const a = w.opstelling[plekA] ?? null;
		const b = w.opstelling[plekB] ?? null;
		if (!a && !b) return;
		w.opstelling[plekA] = b;
		w.opstelling[plekB] = a;
		/* Voor de aftrap is dit gewoon je opstelling maken, geen gebeurtenis. */
		if (this.gestart) this.log('ruil', { plekA, plekB, spelerA: a, spelerB: b });
		this.gekozenPlek = null;
		this.bewaar();
	}

	doelpunt(spelerId: string | null) {
		this.log('goal', { speler: spelerId });
		this.bewaar();
	}

	/** De assist bij het laatste doelpunt. Mag ook later, mag ook niet. */
	zetAssist(spelerId: string | null) {
		const w = this.toestand.wedstrijd;
		if (!w) return;
		for (let i = w.gebeurtenissen.length - 1; i >= 0; i--) {
			if (w.gebeurtenissen[i].type === 'goal') {
				w.gebeurtenissen[i].assist = spelerId;
				this.bewaar();
				return;
			}
		}
	}

	tegendoelpunt() {
		this.log('tegen');
		this.bewaar();
	}

	/** Per ongeluk getikt? De laatste actie kan terug, zolang er niets overheen is gegaan. */
	herstelbaar(): string | null {
		const g = this.toestand.wedstrijd?.gebeurtenissen ?? [];
		const laatste = g[g.length - 1];
		if (!laatste) return null;
		if (laatste.type === 'goal') return 'Doelpunt';
		if (laatste.type === 'tegen') return 'Tegendoelpunt';
		if (laatste.type === 'wissel') return 'Wissel';
		/* Ook een positieruil. Wie de speler aantikt die scoorde en daarna zijn
		   aangever, maakt per ongeluk een ruil — dat moet je terug kunnen draaien. */
		if (laatste.type === 'ruil') return 'Positiewissel';
		return null;
	}

	herstelLaatste() {
		const w = this.toestand.wedstrijd;
		if (!w || !this.herstelbaar()) return;
		const laatste = w.gebeurtenissen[w.gebeurtenissen.length - 1];
		if (laatste.type === 'wissel' && laatste.plek) {
			w.opstelling[laatste.plek] = laatste.eruit ?? null;
			w.bank = w.bank.filter((x) => x !== laatste.eruit);
			if (laatste.erin && !w.bank.includes(laatste.erin)) w.bank.push(laatste.erin);
		}
		if (laatste.type === 'ruil' && laatste.plekA && laatste.plekB) {
			const a = w.opstelling[laatste.plekA] ?? null;
			w.opstelling[laatste.plekA] = w.opstelling[laatste.plekB] ?? null;
			w.opstelling[laatste.plekB] = a;
		}
		w.gebeurtenissen.pop();
		this.gekozenPlek = null;
		this.bewaar();
	}

	beeindig() {
		const w = this.toestand.wedstrijd;
		if (!w) return;
		if (w.loopt) {
			w.verstreken += (Date.now() - (w.sinds ?? Date.now())) / 1000;
			w.loopt = false;
			w.sinds = null;
		}
		this.log('eind');
		w.afgelopen = true;
		this.bewaar();
	}

	bewaarInArchief(): boolean {
		const t = this.toestand;
		const w = t.wedstrijd;
		if (!w || w.bewaard) return false;
		const tijden = speeltijden(w, t.spelers, this.nu);
		const keepers = keepertijden(w, this.nu);
		const posities = positietijden(w, this.nu);
		const namen: Record<string, string> = {};
		t.spelers.forEach((p) => (namen[p.id] = p.naam));
		const regel: ArchiefWedstrijd = {
			datum: w.datum,
			tegenstander: w.tegenstander,
			thuis: w.thuis,
			stand: stand(w),
			formatie: w.formatie,
			duur: eindTijd(w),
			delen: w.delen,
			notitie: w.notitie,
			teamnaam: t.teamnaam,
			gebeurtenissen: w.gebeurtenissen,
			namen,
			afwezig: [...(w.afwezig ?? [])],
			opstelling: { ...w.opstelling },
			bank: [...w.bank],
			speeltijd: t.spelers
				.filter((p) => tijden[p.id] !== undefined)
				.map((p) => ({
					id: p.id,
					naam: p.naam,
					seconden: Math.round(tijden[p.id]),
					keeper: Math.round(keepers[p.id] ?? 0),
					/* alleen plekken waar hij echt gestaan heeft; nul zegt niets */
					posities: Object.fromEntries(
						Object.entries(posities[p.id] ?? {})
							.map(([plek, sec]) => [plek, Math.round(sec)] as const)
							.filter(([, sec]) => sec > 0)
					)
				}))
		};
		t.archief.unshift(regel);
		w.bewaard = true;
		this.bewaar();
		return true;
	}

	verwijderUitArchief(i: number) {
		archief.verwijderWedstrijd(this.toestand, i);
		this.bewaar();
	}

	/* ---------- een bewaarde wedstrijd bijwerken ---------- */
	wijzigArchief(i: number, velden: Partial<Pick<ArchiefWedstrijd, 'datum' | 'tegenstander' | 'thuis'>>) {
		if (archief.wijzig(this.toestand, i, velden)) this.bewaar();
	}

	verwijderDoelpunt(i: number, index: number) {
		if (archief.verwijderDoelpunt(this.toestand, i, index)) this.bewaar();
	}

	voegDoelpuntToe(i: number, minuut: number, spelerId: string | null, tegen = false) {
		if (archief.voegDoelpuntToe(this.toestand, i, minuut, spelerId, tegen)) this.bewaar();
	}

	/* ---------- standaardopstelling ---------- */
	zorgVoorStandaard() {
		const st = opstellen.zorgVoorStandaard(this.toestand);
		this.bewaar();
		return st;
	}

	ruilPlekken(bron: opstellen.Bron, plekA: string, plekB: string) {
		if (!opstellen.ruilPlekken(this.toestand, bron, plekA, plekB)) return;
		this.gekozenPlek = null;
		this.bewaar();
	}

	haalVanVeld(bron: opstellen.Bron, plek: string) {
		if (!opstellen.haalVanVeld(this.toestand, bron, plek)) return;
		this.gekozenPlek = null;
		this.bewaar();
	}

	zetStandaardInFormatie(formatie: string) {
		if (opstellen.zetStandaardInFormatie(this.toestand, formatie)) this.bewaar();
	}

	kiesFormatie(formatie: string) {
		if (opstellen.kiesFormatie(this.toestand, formatie)) this.bewaar();
	}

	zetInOpzet(bron: opstellen.Bron, spelerId: string) {
		if (!this.gekozenPlek) return;
		if (!opstellen.zetOpPlekInOpzet(this.toestand, bron, this.gekozenPlek, spelerId)) return;
		this.gekozenPlek = null;
		this.bewaar();
	}

	wisStandaard() {
		opstellen.wisStandaard(this.toestand);
		this.bewaar();
	}

	/* ---------- trainingen ---------- */
	nieuweTraining(): Training {
		const training = trainingen.nieuweTraining(this.toestand, new Date().toISOString().slice(0, 10));
		this.bewaar();
		return training;
	}

	trainingMetId(id: string | undefined): Training | undefined {
		return trainingen.trainingMetId(this.toestand, id);
	}

	tikPresentie(training: Training, spelerId: string) {
		trainingen.tikPresentie(training, spelerId);
		this.bewaar();
	}

	zetTrainingDatum(training: Training, datum: string) {
		if (trainingen.zetTrainingDatum(this.toestand, training, datum)) this.bewaar();
	}

	verwijderTraining(training: Training) {
		trainingen.verwijderTraining(this.toestand, training);
		this.bewaar();
	}

	/* ---------- overzetten ---------- */
	/**
	 * Een pakket van een ander toestel overnemen. Alles wat erin staat vervangt
	 * wat je had; wat er niet in staat blijft. Een lopende wedstrijd raakt het
	 * nooit aan.
	 */
	neemOver(pakket: Partial<Omit<Toestand, 'wedstrijd'>>) {
		const t = this.toestand;
		if (pakket.teamnaam?.trim()) t.teamnaam = pakket.teamnaam;
		if (Array.isArray(pakket.spelers)) t.spelers = pakket.spelers;
		if (kentFormatie(pakket.formatie)) t.formatie = pakket.formatie!;
		if (pakket.helftMinuten) t.helftMinuten = pakket.helftMinuten;
		if (pakket.delen === 2 || pakket.delen === 4) t.delen = pakket.delen;
		if ('standaard' in pakket) t.standaard = pakket.standaard ?? null;
		if (Array.isArray(pakket.trainingen)) t.trainingen = pakket.trainingen;
		if (Array.isArray(pakket.archief)) t.archief = pakket.archief;
		if (typeof pakket.verslagWissels === 'boolean') t.verslagWissels = pakket.verslagWissels;
		this.bewaar();
	}

	/** Alleen de voorbereiding en de geschiedenis; een lopende wedstrijd blijft lokaal. */
	/**
	 * Wat er tussen je toestellen heen en weer gaat.
	 *
	 * De wedstrijd gaat mee. Voor de aftrap is dat gewoon voorbereiding: je zet
	 * thuis de opstelling en de afmeldingen klaar en pakt hem op het veld op je
	 * telefoon op. Tijdens de wedstrijd is het een reservekopie, want een lege
	 * accu is nu het enige wat je hele wedstrijd kan kosten. Wat níet gebeurt is
	 * de andere kant op: een lopende wedstrijd wordt nooit overschreven door wat
	 * er op de server staat. Zie neemSyncOver.
	 */
	syncPakket() {
		const t = this.toestand;
		return {
			teamnaam: t.teamnaam,
			spelers: t.spelers,
			formatie: t.formatie,
			helftMinuten: t.helftMinuten,
			delen: t.delen,
			standaard: t.standaard,
			trainingen: t.trainingen,
			archief: t.archief,
			verslagWissels: t.verslagWissels,
			wedstrijd: t.wedstrijd
		};
	}

	neemSyncOver(d: ReturnType<App['syncPakket']>): boolean {
		if (!d || !Array.isArray(d.spelers)) return false;
		const t = this.toestand;
		t.spelers = d.spelers;
		if (d.teamnaam?.trim()) t.teamnaam = d.teamnaam;
		if (kentFormatie(d.formatie)) t.formatie = d.formatie;
		if (d.helftMinuten) t.helftMinuten = d.helftMinuten;
		if (d.delen === 2 || d.delen === 4) t.delen = d.delen;
		t.standaard = d.standaard ?? null;
		t.trainingen = Array.isArray(d.trainingen) ? d.trainingen : [];
		t.archief = Array.isArray(d.archief) ? d.archief : [];
		t.verslagWissels = !!d.verslagWissels;
		/* Een wedstrijd die hier loopt blijft staan. Een opstelling die je kwijtraakt
		   maak je opnieuw; wissels die je kwijtraakt zijn weg, en die stonden nergens
		   anders. Alleen wat niet begonnen is mag wijken. */
		if (!(this.gestart && !t.wedstrijd?.afgelopen)) t.wedstrijd = d.wedstrijd ?? null;
		this.bewaar();
		return true;
	}
}

export const app = new App();

/** Opstelling waar je nu aan werkt: de wedstrijd, of de standaard. */
export function opstellingVan(
	bron: 'wedstrijd' | 'standaard'
): { formatie: string; opstelling: Opstelling; bank: string[] } | null {
	return bron === 'standaard' ? app.toestand.standaard : app.toestand.wedstrijd;
}
