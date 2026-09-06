import { kentFormatie } from './domein/formaties';
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
import { meldProbleem, problemen } from './problemen.svelte';
import * as archief from './acties/archief';
import * as gebeurtenissen from './acties/gebeurtenissen';
import * as klok from './acties/klok';
import * as wedstrijd from './acties/wedstrijd';
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
		} catch (fout) {
			/*
			 * Liever een lege app dan een stukke — maar niet stilletjes. Zonder
			 * melding lijkt dit op alles kwijt zijn, zonder uitleg en zonder weg
			 * terug. We zetten het onleesbare opzij en noteren het, zodat er iets
			 * te redden valt in plaats van niets.
			 */
			try {
				const ruw = bak.getItem(SLEUTEL);
				if (ruw) bak.setItem(SLEUTEL + '-onleesbaar', ruw);
			} catch {
				/* dan niet */
			}
			meldProbleem('De opgeslagen gegevens waren niet te lezen. Wat erin stond is apart gezet.', fout);
		}
	}

	bewaar() {
		const bak = opslag();
		if (!bak) return;
		try {
			bak.setItem(SLEUTEL, JSON.stringify(this.toestand));
			problemen.opslaanHapert = false;
		} catch (fout) {
			/*
			 * Een volle opslag mag de wedstrijd niet stoppen, dus we gaan door. Maar
			 * stil blijven mag hier niet: vanaf nu is alles wat je doet weg zodra je
			 * de app sluit. Daarom een vlag die het scherm laat waarschuwen.
			 */
			if (!problemen.opslaanHapert) meldProbleem('Opslaan lukte niet. Nieuwe wijzigingen worden niet bewaard.', fout);
			problemen.opslaanHapert = true;
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
		return klok.gestart(this.toestand.wedstrijd);
	}

	nieuweWedstrijd(tegenstander: string, thuis: boolean) {
		wedstrijd.nieuwe(this.toestand, tegenstander, thuis, new Date().toISOString().slice(0, 10));
		this.bewaar();
	}

	vulUitStandaard() {
		wedstrijd.vulUitStandaard(this.toestand);
	}

	herzetBank() {
		wedstrijd.herzetBank(this.toestand);
	}

	staatInVeld(spelerId: string): boolean {
		return wedstrijd.staatInVeld(this.toestand.wedstrijd, spelerId);
	}

	zetAfwezig(spelerId: string, afwezig: boolean) {
		if (wedstrijd.zetAfwezig(this.toestand, spelerId, afwezig)) this.bewaar();
	}

	verschuifKlok(seconden: number) {
		if (!klok.verschuif(this.toestand.wedstrijd, seconden)) return;
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
		klok.log(this.toestand.wedstrijd, this.nu, type, extra);
	}

	loopToggle() {
		if (!klok.loopToggle(this.toestand.wedstrijd, Date.now(), new Date().toISOString().slice(0, 10))) return;
		this.nu = Date.now();
		this.bewaar();
	}

	deelToggle() {
		if (!klok.deelToggle(this.toestand.wedstrijd, Date.now(), new Date().toISOString().slice(0, 10))) return;
		this.nu = Date.now();
		this.bewaar();
	}

	/** Kan er nog een deel bij, of is dit het laatste? */
	get magVolgendDeel(): boolean {
		return klok.magVolgendDeel(this.toestand.wedstrijd);
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
		if (!this.gekozenPlek) return;
		gebeurtenissen.zetOpPlek(this.toestand.wedstrijd, this.nu, this.gekozenPlek, spelerId);
		this.gekozenPlek = null;
		this.bewaar();
	}

	ruilInWedstrijd(plekA: string, plekB: string) {
		if (!gebeurtenissen.ruil(this.toestand.wedstrijd, this.nu, plekA, plekB)) return;
		this.gekozenPlek = null;
		this.bewaar();
	}

	doelpunt(spelerId: string | null) {
		gebeurtenissen.doelpunt(this.toestand.wedstrijd, this.nu, spelerId);
		this.bewaar();
	}

	zetAssist(spelerId: string | null) {
		if (gebeurtenissen.zetAssist(this.toestand.wedstrijd, spelerId)) this.bewaar();
	}

	tegendoelpunt() {
		gebeurtenissen.tegendoelpunt(this.toestand.wedstrijd, this.nu);
		this.bewaar();
	}

	herstelbaar(): string | null {
		return gebeurtenissen.herstelbaar(this.toestand.wedstrijd);
	}

	herstelLaatste() {
		if (!gebeurtenissen.herstelLaatste(this.toestand.wedstrijd)) return;
		this.gekozenPlek = null;
		this.bewaar();
	}

	beeindig() {
		if (!wedstrijd.beeindig(this.toestand.wedstrijd, this.nu)) return;
		this.nu = Date.now();
		this.bewaar();
	}

	bewaarInArchief(): boolean {
		if (!wedstrijd.bewaarInArchief(this.toestand, this.nu)) return false;
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
