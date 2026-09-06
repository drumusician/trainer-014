import { knowsFormation } from './domein/formaties';
import type {
	ArchivedMatch,
	MatchEvent,
	MatchEventType,
	Lineup,
	Player,
	State,
	Training,
	FieldLine,
	Match
} from './domein/types';
import { emptyState } from './domein/types';
import { reportIssue, issues } from './problemen.svelte';
import * as archief from './acties/archief';
import * as gebeurtenissen from './acties/gebeurtenissen';
import * as klok from './acties/klok';
import * as wedstrijd from './acties/wedstrijd';
import * as opstellen from './acties/opstellen';
import * as selectie from './acties/selectie';
import * as trainingen from './acties/trainingen';

const SLEUTEL = 'o14-app-v1';

/** Draaien we ergens met opslag? Op de server niet, in een test wel. */
const storage = () => (typeof localStorage === 'undefined' ? null : localStorage);

/** Oude opslag: 'K' was een linie. Nu staat keepen daarnaast. */
function migrate(t: State): State {
	t.spelers.forEach((p) => {
		if ((p.linie as string) === 'K') {
			p.linie = '';
			p.keept = true;
		}
	});
	if (!Array.isArray(t.trainingen)) t.trainingen = [];
	if (t.delen !== 4) t.delen = 2;
	if (!t.teamnaam?.trim()) t.teamnaam = 'Ons team';
	const w = t.wedstrijd as (Match & { helft?: number }) | null;
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
	toestand = $state<State>(emptyState());
	/** loopt mee met de klok, zodat schermen vanzelf bijwerken */
	nu = $state(Date.now());
	/** de plek die je hebt aangetikt om te wisselen */
	chosenPosition = $state<string | null>(null);
	/** wordt na elke opslag geroepen, zodat de synchronisatie het weet */
	afterSave: (() => void) | null = null;

	load() {
		const bak = storage();
		if (!bak) return;
		try {
			const ruw = bak.getItem(SLEUTEL);
			if (!ruw) return;
			const d = JSON.parse(ruw);
			if (d && Array.isArray(d.spelers)) {
				this.toestand = migrate({ ...emptyState(), ...d });
				this.save(); /* wat de migratie erbij zette, meteen vastleggen */
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
			reportIssue('De opgeslagen gegevens waren niet te lezen. Wat erin stond is apart gezet.', fout);
		}
	}

	save() {
		const bak = storage();
		if (!bak) return;
		try {
			bak.setItem(SLEUTEL, JSON.stringify(this.toestand));
			issues.savingFails = false;
		} catch (fout) {
			/*
			 * Een volle opslag mag de wedstrijd niet stoppen, dus we gaan door. Maar
			 * stil blijven mag hier niet: vanaf nu is alles wat je doet weg zodra je
			 * de app sluit. Daarom een vlag die het scherm laat waarschuwen.
			 */
			if (!issues.savingFails) reportIssue('Opslaan lukte niet. Nieuwe wijzigingen worden niet bewaard.', fout);
			issues.savingFails = true;
		}
		this.afterSave?.();
	}

	/* ---------- selectie ---------- */
	playerById(id: string | null | undefined): Player | undefined {
		return selectie.playerById(this.toestand, id);
	}

	addPlayerNames(tekst: string) {
		selectie.addPlayerNames(this.toestand, tekst);
		this.save();
	}

	renamePlayer(p: Player, naam: string) {
		selectie.renamePlayer(p, naam);
		this.save();
	}

	removePlayer(p: Player) {
		selectie.removePlayer(this.toestand, p);
		this.save();
	}

	setLine(p: Player, linie: FieldLine) {
		selectie.setLine(p, linie);
		this.save();
	}

	toggleKeeper(p: Player) {
		selectie.toggleKeeper(p);
		this.save();
	}

	/* ---------- wedstrijd ---------- */
	get wedstrijd(): Match | null {
		return this.toestand.wedstrijd;
	}

	/** Is er afgetrapt? Pas dan ligt de opstelling vast en gaat de klok tellen. */
	get kickedOff(): boolean {
		return klok.kickedOff(this.toestand.wedstrijd);
	}

	newMatch(tegenstander: string, thuis: boolean) {
		wedstrijd.nieuwe(this.toestand, tegenstander, thuis, new Date().toISOString().slice(0, 10));
		this.save();
	}

	fillFromDefaultLineup() {
		wedstrijd.fillFromDefaultLineup(this.toestand);
	}

	rebuildBench() {
		wedstrijd.rebuildBench(this.toestand);
	}

	isOnPitch(spelerId: string): boolean {
		return wedstrijd.isOnPitch(this.toestand.wedstrijd, spelerId);
	}

	setAbsent(spelerId: string, afwezig: boolean) {
		if (wedstrijd.setAbsent(this.toestand, spelerId, afwezig)) this.save();
	}

	/** De klok rechtstreeks op een minuut zetten, voor als je achteraf invoert. */
	setClock(minuten: number) {
		if (!klok.zetOp(this.toestand.wedstrijd, Date.now(), minuten)) return;
		this.nu = Date.now();
		this.save();
	}

	shiftClock(seconden: number) {
		if (!klok.verschuif(this.toestand.wedstrijd, seconden)) return;
		this.nu = Date.now();
		this.save();
	}

	/** Een proefwedstrijd of een misser weggooien. */
	discardMatch() {
		this.toestand.wedstrijd = null;
		this.chosenPosition = null;
		this.save();
	}

	log(type: MatchEventType, extra: Partial<MatchEvent> = {}) {
		klok.log(this.toestand.wedstrijd, this.nu, type, extra);
	}

	toggleRunning() {
		if (!klok.toggleRunning(this.toestand.wedstrijd, Date.now(), new Date().toISOString().slice(0, 10))) return;
		this.nu = Date.now();
		this.save();
	}

	togglePart() {
		if (!klok.togglePart(this.toestand.wedstrijd, Date.now(), new Date().toISOString().slice(0, 10))) return;
		this.nu = Date.now();
		this.save();
	}

	/** Kan er nog een deel bij, of is dit het laatste? */
	get canStartNextPart(): boolean {
		return klok.canStartNextPart(this.toestand.wedstrijd);
	}

	setOpponent(naam: string) {
		const w = this.toestand.wedstrijd;
		if (!w) return;
		w.tegenstander = naam.trim() || 'Tegenstander';
		this.save();
	}

	setHome(thuis: boolean) {
		const w = this.toestand.wedstrijd;
		if (!w) return;
		w.thuis = thuis;
		this.save();
	}

	setTeamName(naam: string) {
		this.toestand.teamnaam = naam.trim() || 'Ons team';
		this.save();
	}

	setNote(tekst: string) {
		const w = this.toestand.wedstrijd;
		if (!w) return;
		w.notitie = tekst;
		this.save();
	}

	setArchiveNote(i: number, tekst: string) {
		if (archief.setNote(this.toestand, i, tekst)) this.save();
	}

	/** Iemand van de bank op de gekozen plek zetten. Tijdens een wedstrijd is dat een wissel. */
	putOnPosition(spelerId: string) {
		if (!this.chosenPosition) return;
		gebeurtenissen.putOnPosition(this.toestand.wedstrijd, this.nu, this.chosenPosition, spelerId);
		this.chosenPosition = null;
		this.save();
	}

	swapDuringMatch(plekA: string, plekB: string) {
		if (!gebeurtenissen.ruil(this.toestand.wedstrijd, this.nu, plekA, plekB)) return;
		this.chosenPosition = null;
		this.save();
	}

	goal(spelerId: string | null) {
		gebeurtenissen.goal(this.toestand.wedstrijd, this.nu, spelerId);
		this.save();
	}

	setAssist(spelerId: string | null) {
		if (gebeurtenissen.setAssist(this.toestand.wedstrijd, spelerId)) this.save();
	}

	concede() {
		gebeurtenissen.concede(this.toestand.wedstrijd, this.nu);
		this.save();
	}

	undoable(): string | null {
		return gebeurtenissen.undoable(this.toestand.wedstrijd);
	}

	undoLast() {
		if (!gebeurtenissen.undoLast(this.toestand.wedstrijd)) return;
		this.chosenPosition = null;
		this.save();
	}

	finish() {
		if (!wedstrijd.finish(this.toestand.wedstrijd, this.nu)) return;
		this.nu = Date.now();
		this.save();
	}

	archiveMatch(): boolean {
		if (!wedstrijd.archiveMatch(this.toestand, this.nu)) return false;
		this.save();
		return true;
	}

	removeFromArchive(i: number) {
		archief.verwijderWedstrijd(this.toestand, i);
		this.save();
	}

	/* ---------- een bewaarde wedstrijd bijwerken ---------- */
	updateArchived(i: number, velden: Partial<Pick<ArchivedMatch, 'datum' | 'tegenstander' | 'thuis'>>) {
		if (archief.wijzig(this.toestand, i, velden)) this.save();
	}

	removeGoal(i: number, index: number) {
		if (archief.removeGoal(this.toestand, i, index)) this.save();
	}

	addGoal(i: number, minuut: number, spelerId: string | null, tegen = false) {
		if (archief.addGoal(this.toestand, i, minuut, spelerId, tegen)) this.save();
	}

	/* ---------- standaardopstelling ---------- */
	ensureDefaultLineup() {
		const st = opstellen.ensureDefaultLineup(this.toestand);
		this.save();
		return st;
	}

	swapPositions(bron: opstellen.Bron, plekA: string, plekB: string) {
		if (!opstellen.swapPositions(this.toestand, bron, plekA, plekB)) return;
		this.chosenPosition = null;
		this.save();
	}

	takeOffPitch(bron: opstellen.Bron, plek: string) {
		if (!opstellen.takeOffPitch(this.toestand, bron, plek)) return;
		this.chosenPosition = null;
		this.save();
	}

	moveDefaultToFormation(formatie: string) {
		if (opstellen.moveDefaultToFormation(this.toestand, formatie)) this.save();
	}

	chooseFormation(formatie: string) {
		if (opstellen.chooseFormation(this.toestand, formatie)) this.save();
	}

	putOnPositionWhileSettingUp(bron: opstellen.Bron, spelerId: string) {
		if (!this.chosenPosition) return;
		if (!opstellen.zetOpPlekInOpzet(this.toestand, bron, this.chosenPosition, spelerId)) return;
		this.chosenPosition = null;
		this.save();
	}

	clearDefaultLineup() {
		opstellen.clearDefaultLineup(this.toestand);
		this.save();
	}

	/* ---------- trainingen ---------- */
	newTraining(): Training {
		const training = trainingen.newTraining(this.toestand, new Date().toISOString().slice(0, 10));
		this.save();
		return training;
	}

	trainingById(id: string | undefined): Training | undefined {
		return trainingen.trainingById(this.toestand, id);
	}

	cycleAttendance(training: Training, spelerId: string) {
		trainingen.cycleAttendance(training, spelerId);
		this.save();
	}

	setTrainingDate(training: Training, datum: string) {
		if (trainingen.setTrainingDate(this.toestand, training, datum)) this.save();
	}

	removeTraining(training: Training) {
		trainingen.removeTraining(this.toestand, training);
		this.save();
	}

	/* ---------- overzetten ---------- */
	/**
	 * Een pakket van een ander toestel overnemen. Alles wat erin staat vervangt
	 * wat je had; wat er niet in staat blijft. Een lopende wedstrijd raakt het
	 * nooit aan.
	 */
	adoptPackage(pakket: Partial<Omit<State, 'wedstrijd'>>) {
		const t = this.toestand;
		if (pakket.teamnaam?.trim()) t.teamnaam = pakket.teamnaam;
		if (Array.isArray(pakket.spelers)) t.spelers = pakket.spelers;
		if (knowsFormation(pakket.formatie)) t.formatie = pakket.formatie!;
		if (pakket.helftMinuten) t.helftMinuten = pakket.helftMinuten;
		if (pakket.delen === 2 || pakket.delen === 4) t.delen = pakket.delen;
		if ('standaard' in pakket) t.standaard = pakket.standaard ?? null;
		if (Array.isArray(pakket.trainingen)) t.trainingen = pakket.trainingen;
		if (Array.isArray(pakket.archief)) t.archief = pakket.archief;
		if (typeof pakket.verslagWissels === 'boolean') t.verslagWissels = pakket.verslagWissels;
		this.save();
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
	syncPayload() {
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

	adoptSyncPayload(d: ReturnType<App['syncPayload']>): boolean {
		if (!d || !Array.isArray(d.spelers)) return false;
		const t = this.toestand;
		t.spelers = d.spelers;
		if (d.teamnaam?.trim()) t.teamnaam = d.teamnaam;
		if (knowsFormation(d.formatie)) t.formatie = d.formatie;
		if (d.helftMinuten) t.helftMinuten = d.helftMinuten;
		if (d.delen === 2 || d.delen === 4) t.delen = d.delen;
		t.standaard = d.standaard ?? null;
		t.trainingen = Array.isArray(d.trainingen) ? d.trainingen : [];
		t.archief = Array.isArray(d.archief) ? d.archief : [];
		t.verslagWissels = !!d.verslagWissels;
		/* Een wedstrijd die hier loopt blijft staan. Een opstelling die je kwijtraakt
		   maak je opnieuw; wissels die je kwijtraakt zijn weg, en die stonden nergens
		   anders. Alleen wat niet begonnen is mag wijken. */
		if (!(this.kickedOff && !t.wedstrijd?.afgelopen)) t.wedstrijd = d.wedstrijd ?? null;
		this.save();
		return true;
	}
}

export const app = new App();

/** Opstelling waar je nu aan werkt: de wedstrijd, of de standaard. */
export function lineupOf(
	bron: 'wedstrijd' | 'standaard'
): { formatie: string; opstelling: Lineup; bank: string[] } | null {
	return bron === 'standaard' ? app.toestand.standaard : app.toestand.wedstrijd;
}
