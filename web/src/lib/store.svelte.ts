import { knowsFormation } from './domain/formations';
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
} from './domain/types';
import { emptyState } from './domain/types';
import { migreerToestand as migrateStorage } from './domain/migrate-storage';
import { reportIssue, issues } from './issues.svelte';
import * as archive from './actions/archive';
import * as events from './actions/match-events';
import * as klok from './actions/clock';
import * as match from './actions/match';
import * as opstellen from './actions/lineup';
import * as selectie from './actions/squad';
import * as trainings from './actions/trainings';

const SLEUTEL = 'o14-app-v1';

/** Draaien we ergens met opslag? Op de server niet, in een test wel. */
const storage = () => (typeof localStorage === 'undefined' ? null : localStorage);

/** Oude opslag: 'K' was een linie. Nu staat keepen daarnaast. */
function migrate(t: State): State {
	t.players.forEach((p) => {
		if ((p.line as string) === 'K') {
			p.line = '';
			p.keeper = true;
		}
	});
	if (!Array.isArray(t.trainings)) t.trainings = [];
	if (t.parts !== 4) t.parts = 2;
	if (!t.teamName?.trim()) t.teamName = 'Ons team';
	const w = t.match as (Match & { helft?: number }) | null;
	if (w && w.part === undefined) {
		/* van vroeger: toen waren het altijd twee helften */
		w.parts = 2;
		w.part = w.helft === 2 ? 2 : 1;
		w.inBreak = false;
	}
	t.trainings.forEach((tr, i) => {
		if (!tr.id) tr.id = 't' + (tr.date ?? 'onbekend') + '-' + i; /* van voor de id's */
	});
	if (!Array.isArray(t.archive)) t.archive = [];
	/* Wedstrijden van voor die fix: wel gebeurtenissen, geen start. Zonder die
	   gebeurtenis denkt de app dat er nog niet is afgetrapt. */
	if (w && w.events?.length && !w.events.some((g) => g.type === 'start')) {
		w.events.unshift({ type: 'start', t: 0 });
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
			/* Eerst het oude formaat omzetten: de veldnamen waren Nederlands en
			   staan nog zo in de opslag van iedereen die de app al gebruikte. */
			const d = migrateStorage(JSON.parse(ruw)) as Partial<State>;
			if (d && Array.isArray(d.players)) {
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

	renamePlayer(p: Player, name: string) {
		selectie.renamePlayer(p, name);
		this.save();
	}

	removePlayer(p: Player) {
		selectie.removePlayer(this.toestand, p);
		this.save();
	}

	setLine(p: Player, line: FieldLine) {
		selectie.setLine(p, line);
		this.save();
	}

	toggleKeeper(p: Player) {
		selectie.toggleKeeper(p);
		this.save();
	}

	/* ---------- wedstrijd ---------- */
	get match(): Match | null {
		return this.toestand.match;
	}

	/** Is er afgetrapt? Pas dan ligt de opstelling vast en gaat de klok tellen. */
	get kickedOff(): boolean {
		return klok.kickedOff(this.toestand.match);
	}

	newMatch(opponent: string, home: boolean) {
		match.nieuwe(this.toestand, opponent, home, new Date().toISOString().slice(0, 10));
		this.save();
	}

	fillFromDefaultLineup() {
		match.fillFromDefaultLineup(this.toestand);
	}

	rebuildBench() {
		match.rebuildBench(this.toestand);
	}

	isOnPitch(spelerId: string): boolean {
		return match.isOnPitch(this.toestand.match, spelerId);
	}

	setAbsent(spelerId: string, absent: boolean) {
		if (match.setAbsent(this.toestand, spelerId, absent)) this.save();
	}

	/** De klok rechtstreeks op een minuut zetten, voor als je achteraf invoert. */
	setClock(minuten: number) {
		if (!klok.zetOp(this.toestand.match, Date.now(), minuten)) return;
		this.nu = Date.now();
		this.save();
	}

	shiftClock(seconds: number) {
		if (!klok.verschuif(this.toestand.match, seconds)) return;
		this.nu = Date.now();
		this.save();
	}

	/** Een proefwedstrijd of een misser weggooien. */
	discardMatch() {
		this.toestand.match = null;
		this.chosenPosition = null;
		this.save();
	}

	log(type: MatchEventType, extra: Partial<MatchEvent> = {}) {
		klok.log(this.toestand.match, this.nu, type, extra);
	}

	toggleRunning() {
		if (!klok.toggleRunning(this.toestand.match, Date.now(), new Date().toISOString().slice(0, 10))) return;
		this.nu = Date.now();
		this.save();
	}

	togglePart() {
		if (!klok.togglePart(this.toestand.match, Date.now(), new Date().toISOString().slice(0, 10))) return;
		this.nu = Date.now();
		this.save();
	}

	/** Kan er nog een deel bij, of is dit het laatste? */
	get canStartNextPart(): boolean {
		return klok.canStartNextPart(this.toestand.match);
	}

	setOpponent(name: string) {
		const w = this.toestand.match;
		if (!w) return;
		w.opponent = name.trim() || 'Tegenstander';
		this.save();
	}

	setHome(home: boolean) {
		const w = this.toestand.match;
		if (!w) return;
		w.home = home;
		this.save();
	}

	setTeamName(name: string) {
		this.toestand.teamName = name.trim() || 'Ons team';
		this.save();
	}

	setNote(tekst: string) {
		const w = this.toestand.match;
		if (!w) return;
		w.note = tekst;
		this.save();
	}

	setArchiveNote(i: number, tekst: string) {
		if (archive.setNote(this.toestand, i, tekst)) this.save();
	}

	/** Iemand van de bank op de gekozen plek zetten. Tijdens een wedstrijd is dat een wissel. */
	putOnPosition(spelerId: string) {
		if (!this.chosenPosition) return;
		events.putOnPosition(this.toestand.match, this.nu, this.chosenPosition, spelerId);
		this.chosenPosition = null;
		this.save();
	}

	swapDuringMatch(positionA: string, positionB: string) {
		if (!events.ruil(this.toestand.match, this.nu, positionA, positionB)) return;
		this.chosenPosition = null;
		this.save();
	}

	goal(spelerId: string | null) {
		events.goal(this.toestand.match, this.nu, spelerId);
		this.save();
	}

	setAssist(spelerId: string | null) {
		if (events.setAssist(this.toestand.match, spelerId)) this.save();
	}

	concede() {
		events.concede(this.toestand.match, this.nu);
		this.save();
	}

	undoable(): string | null {
		return events.undoable(this.toestand.match);
	}

	undoLast() {
		if (!events.undoLast(this.toestand.match)) return;
		this.chosenPosition = null;
		this.save();
	}

	finish() {
		if (!match.finish(this.toestand.match, this.nu)) return;
		this.nu = Date.now();
		this.save();
	}

	archiveMatch(): boolean {
		if (!match.archiveMatch(this.toestand, this.nu)) return false;
		this.save();
		return true;
	}

	removeFromArchive(i: number) {
		archive.verwijderWedstrijd(this.toestand, i);
		this.save();
	}

	/* ---------- een bewaarde wedstrijd bijwerken ---------- */
	updateArchived(i: number, velden: Partial<Pick<ArchivedMatch, 'date' | 'opponent' | 'home'>>) {
		if (archive.wijzig(this.toestand, i, velden)) this.save();
	}

	removeGoal(i: number, index: number) {
		if (archive.removeGoal(this.toestand, i, index)) this.save();
	}

	addGoal(i: number, minuut: number, spelerId: string | null, tegen = false) {
		if (archive.addGoal(this.toestand, i, minuut, spelerId, tegen)) this.save();
	}

	/* ---------- standaardopstelling ---------- */
	ensureDefaultLineup() {
		const st = opstellen.ensureDefaultLineup(this.toestand);
		this.save();
		return st;
	}

	swapPositions(bron: opstellen.Bron, positionA: string, positionB: string) {
		if (!opstellen.swapPositions(this.toestand, bron, positionA, positionB)) return;
		this.chosenPosition = null;
		this.save();
	}

	takeOffPitch(bron: opstellen.Bron, position: string) {
		if (!opstellen.takeOffPitch(this.toestand, bron, position)) return;
		this.chosenPosition = null;
		this.save();
	}

	moveDefaultToFormation(formation: string) {
		if (opstellen.moveDefaultToFormation(this.toestand, formation)) this.save();
	}

	chooseFormation(formation: string) {
		if (opstellen.chooseFormation(this.toestand, formation)) this.save();
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
		const training = trainings.newTraining(this.toestand, new Date().toISOString().slice(0, 10));
		this.save();
		return training;
	}

	trainingById(id: string | undefined): Training | undefined {
		return trainings.trainingById(this.toestand, id);
	}

	cycleAttendance(training: Training, spelerId: string) {
		trainings.cycleAttendance(training, spelerId);
		this.save();
	}

	setTrainingDate(training: Training, date: string) {
		if (trainings.setTrainingDate(this.toestand, training, date)) this.save();
	}

	removeTraining(training: Training) {
		trainings.removeTraining(this.toestand, training);
		this.save();
	}

	/* ---------- overzetten ---------- */
	/**
	 * Een pakket van een ander toestel overnemen. Alles wat erin staat vervangt
	 * wat je had; wat er niet in staat blijft. Een lopende wedstrijd raakt het
	 * nooit aan.
	 */
	adoptPackage(pakket: Partial<Omit<State, 'match'>>) {
		const t = this.toestand;
		if (pakket.teamName?.trim()) t.teamName = pakket.teamName;
		if (Array.isArray(pakket.players)) t.players = pakket.players;
		if (knowsFormation(pakket.formation)) t.formation = pakket.formation!;
		if (pakket.minutesPerPart) t.minutesPerPart = pakket.minutesPerPart;
		if (pakket.parts === 2 || pakket.parts === 4) t.parts = pakket.parts;
		if ('standaard' in pakket) t.defaultLineup = pakket.defaultLineup ?? null;
		if (Array.isArray(pakket.trainings)) t.trainings = pakket.trainings;
		if (Array.isArray(pakket.archive)) t.archive = pakket.archive;
		if (typeof pakket.reportSubs === 'boolean') t.reportSubs = pakket.reportSubs;
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
			teamName: t.teamName,
			players: t.players,
			formation: t.formation,
			minutesPerPart: t.minutesPerPart,
			parts: t.parts,
			defaultLineup: t.defaultLineup,
			trainings: t.trainings,
			archive: t.archive,
			reportSubs: t.reportSubs,
			match: t.match
		};
	}

	adoptSyncPayload(ruw: ReturnType<App['syncPayload']>): boolean {
		/* Wat er op de server staat kan van een toestel komen dat nog niet is
		   bijgewerkt, en dan zijn de veldnamen Nederlands. */
		const d = migrateStorage(ruw) as ReturnType<App['syncPayload']>;
		if (!d || !Array.isArray(d.players)) return false;
		const t = this.toestand;
		t.players = d.players;
		if (d.teamName?.trim()) t.teamName = d.teamName;
		if (knowsFormation(d.formation)) t.formation = d.formation;
		if (d.minutesPerPart) t.minutesPerPart = d.minutesPerPart;
		if (d.parts === 2 || d.parts === 4) t.parts = d.parts;
		t.defaultLineup = d.defaultLineup ?? null;
		t.trainings = Array.isArray(d.trainings) ? d.trainings : [];
		t.archive = Array.isArray(d.archive) ? d.archive : [];
		t.reportSubs = !!d.reportSubs;
		/* Een wedstrijd die hier loopt blijft staan. Een opstelling die je kwijtraakt
		   maak je opnieuw; wissels die je kwijtraakt zijn weg, en die stonden nergens
		   anders. Alleen wat niet begonnen is mag wijken. */
		if (!(this.kickedOff && !t.match?.finished)) t.match = d.match ?? null;
		this.save();
		return true;
	}
}

export const app = new App();

/** Opstelling waar je nu aan werkt: de wedstrijd, of de standaard. */
export function lineupOf(
	bron: 'wedstrijd' | 'standaard'
): { formation: string; lineup: Lineup; bench: string[] } | null {
	return bron === 'standaard' ? app.toestand.defaultLineup : app.toestand.match;
}
