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

/** Are we somewhere with storage? Not on the server, yes in a test. */
const storage = () => (typeof localStorage === 'undefined' ? null : localStorage);

/** Older storage: 'K' used to be a line. Keeping now sits alongside it. */
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
		/* from the old days: back then it was always two halves */
		w.parts = 2;
		w.part = w.helft === 2 ? 2 : 1;
		w.inBreak = false;
	}
	t.trainings.forEach((tr, i) => {
		if (!tr.id) tr.id = 't' + (tr.date ?? 'onbekend') + '-' + i; /* from before ids existed */
	});
	if (!Array.isArray(t.archive)) t.archive = [];
	/* Matches from before that fix: events but no start. Without that event the
	   app believes kick-off has not happened yet. */
	if (w && w.events?.length && !w.events.some((g) => g.type === 'start')) {
		w.events.unshift({ type: 'start', t: 0 });
	}
	return t;
}

class App {
	toestand = $state<State>(emptyState());
	/** ticks along with the clock, so screens update by themselves */
	nu = $state(Date.now());
	/** the position you tapped in order to substitute */
	chosenPosition = $state<string | null>(null);
	/** called after every save, so syncing knows about it */
	afterSave: (() => void) | null = null;

	load() {
		const bak = storage();
		if (!bak) return;
		try {
			const ruw = bak.getItem(SLEUTEL);
			if (!ruw) return;
			/* Convert the old format first: the field names were Dutch and are still
			   stored that way for everyone who already used the app. */
			const d = migrateStorage(JSON.parse(ruw)) as Partial<State>;
			if (d && Array.isArray(d.players)) {
				this.toestand = migrate({ ...emptyState(), ...d });
				this.save(); /* record whatever the migration added, straight away */
				return;
			}
			/*
			 * Readable JSON, but not a shape we know. The dangerous case is a device
			 * running older code against storage a newer version already converted:
			 * it starts empty, and the first tap writes that empty state over a whole
			 * season. Unreadable must never mean overwritten, so we set the original
			 * aside before anything else can save.
			 */
			this.zetApart(bak, ruw);
			reportIssue('De opgeslagen gegevens hadden een vorm die deze versie niet kent. Wat erin stond is apart gezet.');
		} catch (fout) {
			/*
			 * An empty app beats a broken one — but not silently. Without a notice
			 * this looks like losing everything, with no explanation and no way
			 * back. We set the unreadable data aside and record it, so there is
			 * something to salvage instead of nothing.
			 */
			this.zetApart(bak, bak.getItem(SLEUTEL));
			reportIssue('De opgeslagen gegevens waren niet te lezen. Wat erin stond is apart gezet.', fout);
		}
	}

	/** Het origineel opzij zetten, zodat er iets te redden valt. */
	private zetApart(bak: Storage, ruw: string | null) {
		try {
			if (ruw) bak.setItem(SLEUTEL + '-onleesbaar', ruw);
		} catch {
			/* then not */
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
			 * A full disk must not stop the match, so we carry on. But staying quiet
			 * is not allowed here: from now on everything you do is gone the moment
			 * you close the app. Hence a flag that makes the screen warn you.
			 */
			if (!issues.savingFails) reportIssue('Opslaan lukte niet. Nieuwe wijzigingen worden niet bewaard.', fout);
			issues.savingFails = true;
		}
		this.afterSave?.();
	}

	/* ---------- squad ---------- */
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

	/* ---------- match ---------- */
	get match(): Match | null {
		return this.toestand.match;
	}

	/** Has it kicked off? Only then is the lineup fixed and does the clock count. */
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

	/** Set the clock straight to a minute, for entering a match afterwards. */
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

	/** Discard a practice match or a mistake. */
	discardMatch() {
		this.toestand.match = null;
		this.chosenPosition = null;
		this.save();
	}

	log(type: MatchEventType, extra: Partial<MatchEvent> = {}) {
		klok.log(this.toestand.match, this.nu, type, extra);
	}

	/** Wie er tikt. Alleen bekend als je ingelogd bent; anders blijft het leeg. */
	whoIsKeeping: string | null = null;

	/**
	 * Deze wedstrijd op dit toestel overnemen.
	 *
	 * Voor de telefoon die leegloopt. De wedstrijd zelf staat hier al — die komt
	 * binnen vier seconden na elke wissel op de server en wordt bij het openen
	 * opgehaald. Wat hier verandert is alleen wie hem bijhoudt, zodat het andere
	 * toestel bij een volgende poging een botsing krijgt in plaats van er stil
	 * overheen te schrijven.
	 */
	takeOverMatch(): boolean {
		const w = this.toestand.match;
		if (!w || w.finished || !this.whoIsKeeping) return false;
		w.keptBy = this.whoIsKeeping;
		this.save();
		return true;
	}

	toggleRunning() {
		if (
			!klok.toggleRunning(
				this.toestand.match,
				Date.now(),
				new Date().toISOString().slice(0, 10),
				this.whoIsKeeping ?? undefined
			)
		)
			return;
		this.nu = Date.now();
		this.save();
	}

	togglePart() {
		if (!klok.togglePart(this.toestand.match, Date.now(), new Date().toISOString().slice(0, 10))) return;
		this.nu = Date.now();
		this.save();
	}

	/** Is there another part to come, or is this the last one? */
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

	/** Put someone from the bench into the chosen position. During a match that is a substitution. */
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

	/* ---------- amending an archived match ---------- */
	updateArchived(i: number, velden: Partial<Pick<ArchivedMatch, 'date' | 'opponent' | 'home'>>) {
		if (archive.wijzig(this.toestand, i, velden)) this.save();
	}

	removeGoal(i: number, index: number) {
		if (archive.removeGoal(this.toestand, i, index)) this.save();
	}

	addGoal(i: number, minuut: number, spelerId: string | null, tegen = false) {
		if (archive.addGoal(this.toestand, i, minuut, spelerId, tegen)) this.save();
	}

	/* ---------- default lineup ---------- */
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

	/* ---------- training sessions ---------- */
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

	/* ---------- transferring ---------- */
	/**
	 * Adopt a package from another device. Everything in it replaces what you had;
	 * what is not in it stays. It never touches a running match.
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

	/** Preparation and history only; a running match stays on this device. */
	/**
	 * What travels back and forth between your devices.
	 *
	 * The match goes along. Before kick-off that is simply preparation: you set the
	 * lineup and the absences at home and pick it up on your phone at the pitch.
	 * During the match it is a backup, because a flat battery is now the only thing
	 * that can cost you a whole match. What does not happen is the other direction:
	 * a running match is never overwritten by what sits on the server. See
	 * adoptSyncPayload.
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
		/* What sits on the server may come from a device that has not been updated
		   yet, and then the field names are still Dutch. */
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
		/* A match running here stays put. A lineup you lose you can pick again;
		   substitutions you lose are gone, and they existed nowhere else. Only what
		   has not started may give way. */
		if (!(this.kickedOff && !t.match?.finished)) t.match = d.match ?? null;
		this.save();
		return true;
	}
}

export const app = new App();

/** The lineup you are working on: the match, or the default. */
export function lineupOf(
	bron: 'wedstrijd' | 'standaard'
): { formation: string; lineup: Lineup; bench: string[] } | null {
	return bron === 'standaard' ? app.toestand.defaultLineup : app.toestand.match;
}
