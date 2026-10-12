import Foundation
import Testing
@testable import BlaadjeKern

/*
 * De tests van de store uit de webapp, voor zover ze over de regels gaan en niet
 * over Svelte, localStorage of het synchroniseren zelf.
 *
 * `App` hieronder is geen deel van het pakket. Het is de dunne laag die de store
 * in de webapp ook is: de toestand, de gekozen plek, de klok, en na elke
 * handeling bewaren. Zo blijven de tests regel voor regel naast het origineel te
 * leggen.
 */
/* Ids die bij elke run hetzelfde zijn, in plaats van de klok en het toeval. */
private final class Teller {
	private var n = 0

	func volgende(_ voorvoegsel: String) -> String {
		n += 1
		return "\(voorvoegsel)\(n)"
	}
}

private struct App {
	static let VANDAAG = "2026-10-12"

	var toestand = emptyState()
	/** de klok, in ms; in de tests staat hij stil tenzij je hem verzet */
	var nu: Double = 1_760_000_000_000
	var chosenPosition: String? = nil
	var whoIsKeeping: String? = nil
	/** wat er in de opslag staat */
	var opslag: String? = nil
	private let teller = Teller()

	init() {
		toestand.players = [
			Player(id: "p1", name: "Daanish", line: .M),
			Player(id: "p2", name: "Gijs", line: .geen, keeper: true),
		]
	}

	mutating func save() { opslag = Opslag.schrijf(toestand) }

	mutating func load() throws {
		guard let ruw = opslag, let gelezen = try Opslag.lees(ruw) else { return }
		toestand = gelezen
		save()
	}

	var match: Match? { toestand.match }
	var kickedOff: Bool { ClockActions.kickedOff(toestand.match) }
	var canStartNextPart: Bool { ClockActions.canStartNextPart(toestand.match) }

	/* ---------- squad ---------- */
	func playerById(_ id: String?) -> Player? { SquadActions.playerById(toestand, id) }

	mutating func addPlayerNames(_ tekst: String) {
		let teller = teller
		SquadActions.addPlayerNames(&toestand, tekst) { teller.volgende("p") }
		save()
	}

	/* ---------- match ---------- */
	mutating func newMatch(_ opponent: String, _ home: Bool) {
		MatchActions.nieuwe(&toestand, opponent: opponent, home: home, vandaag: App.VANDAAG)
		save()
	}

	mutating func rebuildBench() { MatchActions.rebuildBench(&toestand) }

	mutating func setAbsent(_ spelerId: String, _ absent: Bool) {
		if MatchActions.setAbsent(&toestand, spelerId: spelerId, absent: absent) { save() }
	}

	mutating func setClock(_ minuten: Double) {
		if ClockActions.zetOp(&toestand.match, nu: nu, minuten: minuten) { save() }
	}

	mutating func shiftClock(_ seconds: Double) {
		if ClockActions.verschuif(&toestand.match, seconds: seconds) { save() }
	}

	mutating func discardMatch() {
		toestand.match = nil
		chosenPosition = nil
		save()
	}

	mutating func takeOverMatch() -> Bool {
		guard StoreActions.takeOverMatch(&toestand.match, wie: whoIsKeeping) else { return false }
		save()
		return true
	}

	mutating func toggleRunning() {
		if ClockActions.toggleRunning(&toestand.match, nu: nu, vandaag: App.VANDAAG, wie: whoIsKeeping) { save() }
	}

	mutating func togglePart() {
		if ClockActions.togglePart(&toestand.match, nu: nu, vandaag: App.VANDAAG) { save() }
	}

	mutating func setOpponent(_ name: String, typing: Bool = false) {
		StoreActions.setOpponent(&toestand.match, name, typing: typing)
		save()
	}

	mutating func setHome(_ home: Bool) {
		toestand.match?.home = home
		save()
	}

	mutating func setTeamName(_ name: String) {
		StoreActions.setTeamName(&toestand, name)
		save()
	}

	mutating func setNote(_ tekst: String) {
		toestand.match?.note = tekst
		save()
	}

	mutating func putOnPosition(_ spelerId: String) {
		guard let position = chosenPosition else { return }
		MatchEventActions.putOnPosition(&toestand.match, nu: nu, position: position, spelerId: spelerId)
		chosenPosition = nil
		save()
	}

	mutating func swapDuringMatch(_ positionA: String, _ positionB: String) {
		guard MatchEventActions.ruil(&toestand.match, nu: nu, positionA, positionB) else { return }
		chosenPosition = nil
		save()
	}

	mutating func goal(_ spelerId: String?) {
		MatchEventActions.goal(&toestand.match, nu: nu, spelerId: spelerId)
		save()
	}

	mutating func setAssist(_ spelerId: String?) {
		if MatchEventActions.setAssist(&toestand.match, spelerId: spelerId) { save() }
	}

	mutating func concede() {
		MatchEventActions.concede(&toestand.match, nu: nu)
		save()
	}

	mutating func planAdd(_ minuut: Double, _ on: String, _ off: String) {
		let teller = teller
		if PlanActions.voegToe(&toestand.match, minuut: minuut, on: on, off: off, nieuwId: { teller.volgende("w") }) { save() }
	}

	func undoable() -> String? { MatchEventActions.undoable(toestand.match) }

	mutating func undoLast() {
		guard MatchEventActions.undoLast(&toestand.match) else { return }
		chosenPosition = nil
		save()
	}

	mutating func finish() {
		if MatchActions.finish(&toestand.match, nu: nu) { save() }
	}

	@discardableResult
	mutating func archiveMatch() -> Bool {
		guard MatchActions.archiveMatch(&toestand, nu: nu) != nil else { return false }
		save()
		return true
	}

	/* ---------- default lineup ---------- */
	mutating func ensureDefaultLineup() {
		LineupActions.ensureDefaultLineup(&toestand)
		save()
	}

	mutating func swapPositions(_ bron: LineupActions.Bron, _ positionA: String, _ positionB: String) {
		guard LineupActions.swapPositions(&toestand, bron, positionA, positionB) else { return }
		chosenPosition = nil
		save()
	}

	mutating func takeOffPitch(_ bron: LineupActions.Bron, _ position: String) {
		guard LineupActions.takeOffPitch(&toestand, bron, position) else { return }
		chosenPosition = nil
		save()
	}

	mutating func putOnPositionWhileSettingUp(_ bron: LineupActions.Bron, _ spelerId: String) {
		guard let position = chosenPosition else { return }
		guard LineupActions.zetOpPlekInOpzet(&toestand, bron, position, spelerId) else { return }
		chosenPosition = nil
		save()
	}

	/* ---------- training sessions ---------- */
	mutating func newTraining() -> Training {
		let teller = teller
		let training = TrainingActions.newTraining(&toestand, vandaag: App.VANDAAG) { teller.volgende("t") }
		save()
		return training
	}

	func trainingById(_ id: String?) -> Training? { TrainingActions.trainingById(toestand, id) }

	/* ---------- transferring ---------- */
	func syncPayload() throws -> JSONValue {
		/* heen en terug door tekst, zoals het over de lijn gaat */
		try JSONValue.parse(StoreActions.syncPayload(toestand).tekst())
	}

	mutating func adoptSyncPayload(_ ruw: JSONValue) -> Bool {
		guard StoreActions.adoptSyncPayload(&toestand, ruw) else { return false }
		save()
		return true
	}
}

/** Een veld diep in een JSON-waarde zetten, zoals `pakket.match.opponent = …`. */
private func zet(_ v: inout JSONValue, _ pad: [String], _ nieuw: JSONValue) {
	guard let kop = pad.first, var o = v.objectValue else {
		v = nieuw
		return
	}
	var kind = o[kop] ?? .object(OrderedDict())
	zet(&kind, Array(pad.dropFirst()), nieuw)
	o[kop] = kind
	v = .object(o)
}

@Suite("trainingen")
struct TrainingenTests {
	/* This one went wrong: the store returned the bare object while the state holds
	   a proxy. indexOf() therefore did not find it and you landed on an empty
	   screen. Since then we look up by id. */
	@Test("geeft een nieuwe training terug die je meteen kunt opzoeken")
	func meteenOpzoeken() {
		var app = App()
		let t = app.newTraining()
		#expect(!t.id.isEmpty)
		#expect(app.trainingById(t.id) != nil)
		#expect(app.trainingById(t.id)?.date == t.date)
	}

	@Test("zet iedereen op aanwezig en laat je langs de standen tikken")
	func langsDeStanden() {
		var app = App()
		let id = app.newTraining().id
		#expect(app.trainingById(id)?.status["p1"] == .present)
		TrainingActions.cycleAttendance(&app.toestand, trainingId: id, "p1")
		#expect(app.trainingById(id)?.status["p1"] == .excused)
		TrainingActions.cycleAttendance(&app.toestand, trainingId: id, "p1")
		#expect(app.trainingById(id)?.status["p1"] == .absent)
		TrainingActions.cycleAttendance(&app.toestand, trainingId: id, "p1")
		#expect(app.trainingById(id)?.status["p1"] == .present)
	}

	@Test("houdt het adres kloppend als een datum de volgorde omgooit")
	func adresKloppend() {
		var app = App()
		let eerste = app.newTraining()
		let tweede = app.newTraining()
		TrainingActions.setTrainingDate(&app.toestand, trainingId: tweede.id, date: "2020-01-01")
		#expect(app.toestand.trainings[1].id == tweede.id) /* naar achteren gesorteerd */
		#expect(app.trainingById(eerste.id) != nil)
		#expect(app.trainingById(tweede.id)?.date == "2020-01-01")
	}

	@Test("verwijdert alleen de training die je aanwijst")
	func verwijdert() {
		var app = App()
		let eerste = app.newTraining()
		let tweede = app.newTraining()
		TrainingActions.removeTraining(&app.toestand, trainingId: eerste.id)
		#expect(app.trainingById(eerste.id) == nil)
		#expect(app.trainingById(tweede.id) != nil)
	}

	@Test("geeft oude trainingen zonder id er alsnog een bij het laden")
	func zonderId() throws {
		var app = App()
		var oud = try #require(app.toestand.json.objectValue)
		oud["trainings"] = try JSONValue.parse(#"[{"date":"2026-09-02","status":{}}]"#)
		app.opslag = JSONValue.object(oud).tekst()
		try app.load()
		#expect(app.toestand.trainings[0].id == "t2026-09-02-0")
	}
}

@Suite("wie is er vandaag")
struct WieIsErVandaagTests {
	@Test("haalt een afwezige uit veld en bank, en zet hem daarna op de bank")
	func afwezige() {
		var app = App()
		app.newMatch("Sparta", true)
		app.toestand.match!.lineup = ["K": "p2", "SP": "p1"]
		app.rebuildBench()
		#expect(app.toestand.match!.bench == [])

		app.setAbsent("p2", true)
		#expect(app.toestand.match!.lineup.has("K"))
		#expect(app.toestand.match!.lineup["K"] == nil)
		#expect(!app.toestand.match!.bench.contains("p2"))

		app.setAbsent("p2", false)
		#expect(app.toestand.match!.bench.contains("p2"))
	}

	/* This went wrong: playing time is wound back from the lineup as it stands now,
	   so anyone you remove from it during the match never played according to that
	   calculation. A whole match silently became zero minutes. */
	@Test("laat het veld met rust zodra de wedstrijd loopt")
	func veldMetRust() {
		var app = App()
		app.newMatch("Sparta", true)
		app.toestand.match!.lineup = ["K": "p2", "SP": "p1"]
		app.rebuildBench()
		app.toestand.match!.events = [MatchEvent(type: .start, t: 0)]

		app.setAbsent("p2", true)
		#expect(app.toestand.match!.lineup["K"] == "p2")
		#expect(!(app.toestand.match!.absent ?? []).contains("p2"))
	}

	@Test("laat wie op de bank zit ook na de aftrap afmelden")
	func vanDeBank() {
		var app = App()
		app.newMatch("Sparta", true)
		app.toestand.match!.lineup = ["K": "p2"]
		app.rebuildBench()
		app.toestand.match!.events = [MatchEvent(type: .start, t: 0)]
		#expect(app.toestand.match!.bench.contains("p1"))

		app.setAbsent("p1", true)
		#expect(!app.toestand.match!.bench.contains("p1"))
		#expect(app.toestand.match!.absent?.contains("p1") == true)
	}
}

@Suite("de klok")
struct DeKlokTests {
	@Test("schuift met minuten maar nooit onder nul")
	func schuift() {
		var app = App()
		app.newMatch("Sparta", true)
		app.toestand.match!.elapsed = 100
		app.shiftClock(60)
		#expect(app.toestand.match!.elapsed == 160)
		app.shiftClock(-600)
		#expect(app.toestand.match!.elapsed == 0)
	}
}

@Suite("een bewaarde wedstrijd bijwerken")
struct BewaardeWedstrijdBijwerkenTests {
	private func metArchief() -> App {
		var app = App()
		app.toestand.archive = [
			ArchivedMatch(
				date: "2026-08-30",
				opponent: "Ajx",
				home: true,
				score: [1, 1],
				formation: "4-3-3",
				duration: 4200,
				events: [
					MatchEvent(type: .start, t: 0),
					MatchEvent(type: .goal, t: 900, player: "p1"),
					MatchEvent(type: .substitution, t: 1200, off: "p1", on: "p2", position: "SP"),
					MatchEvent(type: .conceded, t: 1800),
					MatchEvent(type: .end, t: 4200),
				],
				names: ["p1": "Daanish", "p2": "Gijs"],
				playingTime: [PlayingTimeRow(id: "p1", name: "Daanish", seconds: 1200, keeper: 0)]
			)
		]
		return app
	}

	@Test("verbetert de naam van de tegenstander")
	func tegenstander() {
		var app = metArchief()
		ArchiveActions.wijzig(&app.toestand, 0, opponent: "Ajax", home: false)
		#expect(app.toestand.archive[0].opponent == "Ajax")
		#expect(app.toestand.archive[0].home == false)
		#expect(app.toestand.archive[0].date == "2026-08-30")
	}

	@Test("haalt een doelpunt weg en telt de stand opnieuw")
	func doelpuntWeg() {
		var app = metArchief()
		ArchiveActions.removeGoal(&app.toestand, 0, 1)
		#expect(app.toestand.archive[0].score == [0, 1])
		#expect(app.toestand.archive[0].events.count == 4)
	}

	@Test("laat wissels met rust, want daar hangt de speeltijd aan")
	func wisselsMetRust() {
		var app = metArchief()
		#expect(ArchiveActions.removeGoal(&app.toestand, 0, 2) == false) /* de wissel */
		#expect(app.toestand.archive[0].events.count == 5)
	}

	@Test("zet een vergeten doelpunt op de goede plek in het verloop")
	func vergetenDoelpunt() {
		var app = metArchief()
		ArchiveActions.addGoal(&app.toestand, 0, minuut: 20, spelerId: "p2")
		let g = app.toestand.archive[0].events
		#expect(g.map(\.t) == [0, 900, 1200, 1200, 1800, 4200])
		/* op dezelfde seconde komt het nieuwe doelpunt ná wat er al stond */
		#expect(g.map(\.type) == [.start, .goal, .substitution, .goal, .conceded, .end])
		#expect(app.toestand.archive[0].score == [2, 1])
		ArchiveActions.addGoal(&app.toestand, 0, minuut: 55, spelerId: nil, tegen: true)
		#expect(app.toestand.archive[0].score == [2, 2])
	}
}

@Suite("schuiven in de opstelling")
struct SchuivenInDeOpstellingTests {
	private func metStandaard() -> App {
		var app = App()
		app.toestand.defaultLineup = DefaultLineup(
			formation: "4-3-3",
			lineup: ["K": "p2", "SP": "p1", "LV": nil],
			bench: []
		)
		return app
	}

	@Test("wisselt twee spelers van plek")
	func tweeSpelers() {
		var app = metStandaard()
		app.swapPositions(.standaard, "K", "SP")
		#expect(app.toestand.defaultLineup!.lineup["K"] == "p1")
		#expect(app.toestand.defaultLineup!.lineup["SP"] == "p2")
	}

	@Test("verhuist iemand naar een lege plek")
	func legePlek() {
		var app = metStandaard()
		app.swapPositions(.standaard, "SP", "LV")
		#expect(app.toestand.defaultLineup!.lineup["SP"] == nil)
		#expect(app.toestand.defaultLineup!.lineup["LV"] == "p1")
	}

	@Test("doet niets als je twee lege plekken ruilt")
	func tweeLegePlekken() {
		var app = metStandaard()
		app.toestand.defaultLineup!.lineup = ["LV": nil, "RV": nil]
		app.swapPositions(.standaard, "LV", "RV")
		#expect(app.toestand.defaultLineup!.lineup == ["LV": nil, "RV": nil])
	}

	@Test("haalt iemand van het veld naar de bank en laat de plek leeg")
	func naarDeBank() {
		var app = metStandaard()
		app.takeOffPitch(.standaard, "SP")
		#expect(app.toestand.defaultLineup!.lineup.has("SP"))
		#expect(app.toestand.defaultLineup!.lineup["SP"] == nil)
		#expect(app.toestand.defaultLineup!.bench.contains("p1"))
	}

	@Test("zet niemand dubbel op de bank")
	func nietDubbel() {
		var app = metStandaard()
		app.toestand.defaultLineup!.bench = ["p1"]
		app.takeOffPitch(.standaard, "SP")
		#expect(app.toestand.defaultLineup!.bench.filter { $0 == "p1" }.count == 1)
	}
}

@Suite("ruilen tijdens de wedstrijd")
struct RuilenTijdensDeWedstrijdTests {
	@Test("legt de ruil vast in het verloop")
	func vastInHetVerloop() throws {
		var app = App()
		app.newMatch("Sparta", true)
		app.toestand.match!.lineup = ["K": "p2", "SP": "p1"]
		app.toestand.match!.events = [MatchEvent(type: .start, t: 0)]
		app.swapDuringMatch("K", "SP")
		let w = try #require(app.toestand.match)
		#expect(w.lineup["K"] == "p1")
		#expect(w.lineup["SP"] == "p2")
		#expect(w.events.last == MatchEvent(type: .swap, t: 0, positionA: "K", positionB: "SP", playerA: "p2", playerB: "p1"))
	}
}

@Suite("klaarstaan of bezig")
struct KlaarstaanOfBezigTests {
	@Test("is pas begonnen als de klok gelopen heeft")
	func pasBegonnen() {
		var app = App()
		app.newMatch("Sparta", true)
		app.toestand.match!.lineup = ["K": "p2", "SP": "p1"]
		#expect(app.kickedOff == false)
		app.toggleRunning()
		#expect(app.kickedOff == true)
	}

	@Test("legt een ruil voor de aftrap niet vast als gebeurtenis")
	func ruilVoorDeAftrap() {
		var app = App()
		app.newMatch("Sparta", true)
		app.toestand.match!.lineup = ["K": "p2", "SP": "p1"]
		app.swapDuringMatch("K", "SP")
		#expect(app.toestand.match!.events.count == 0)
		#expect(app.toestand.match!.lineup["K"] == "p1")
		#expect(app.toestand.match!.lineup["SP"] == "p2")
	}

	@Test("legt een ruil ná de aftrap wel vast")
	func ruilNaDeAftrap() {
		var app = App()
		app.newMatch("Sparta", true)
		app.toestand.match!.lineup = ["K": "p2", "SP": "p1"]
		app.toggleRunning()
		app.swapDuringMatch("K", "SP")
		#expect(app.toestand.match!.events.last?.type == .swap)
	}
}

@Suite("wie er die dag was, bewaren")
struct WieErDieDagWasTests {
	@Test("legt de afwezigen vast bij de wedstrijd")
	func afwezigen() {
		var app = App()
		app.newMatch("Sparta", true)
		app.toestand.match!.lineup = ["K": "p1"]
		app.setAbsent("p2", true)
		app.finish()
		app.archiveMatch()
		let a = app.toestand.archive[0]
		#expect(a.absent == ["p2"])
		/* zero minutes now means something different for someone who was there */
		#expect(a.playingTime.first { $0.id == "p2" }?.seconds == 0)
	}

	@Test("bewaart een lege lijst als iedereen er was")
	func iedereenErbij() {
		var app = App()
		app.newMatch("Sparta", true)
		app.toestand.match!.lineup = ["K": "p1"]
		app.finish()
		app.archiveMatch()
		#expect(app.toestand.archive[0].absent == [])
	}
}

@Suite("kwarten spelen")
struct KwartenSpelenTests {
	private func metKwarten() -> App {
		var app = App()
		app.toestand.parts = 4
		app.newMatch("Sparta", true)
		app.toestand.match!.lineup = ["K": "p1"]
		return app
	}

	@Test("neemt de speelwijze over van de instelling")
	func speelwijze() {
		#expect(metKwarten().match?.parts == 4)
	}

	@Test("loopt door vier kwarten met een pauze ertussen")
	func vierKwarten() {
		var app = metKwarten()
		app.toggleRunning()
		#expect(app.match?.part == 1)

		app.togglePart() /* einde 1e kwart */
		#expect(app.match?.inBreak == true)
		#expect(app.match?.running == false)
		#expect(app.match?.events.last?.type == .break)
		#expect(app.match?.events.last?.part == 1)

		app.togglePart() /* 2e kwart begint */
		#expect(app.match?.part == 2)
		#expect(app.match?.inBreak == false)
		#expect(app.match?.running == true)

		app.togglePart()
		app.togglePart()
		app.togglePart()
		app.togglePart()
		#expect(app.match?.part == 4)
		#expect(app.canStartNextPart == false) /* after the last quarter it stops */
	}

	@Test("houdt twee helften gewoon zoals het was")
	func tweeHelften() {
		var app = App()
		app.toestand.parts = 2
		app.newMatch("Sparta", true)
		app.toggleRunning()
		app.togglePart()
		#expect(app.match?.inBreak == true)
		app.togglePart()
		#expect(app.match?.part == 2)
		#expect(app.canStartNextPart == false)
	}

	@Test("bewaart de speelwijze en de notitie in het archief")
	func inHetArchief() {
		var app = metKwarten()
		app.setNote("Sterk begin, na rust weggezakt.")
		app.finish()
		app.archiveMatch()
		#expect(app.toestand.archive[0].parts == 4)
		#expect(app.toestand.archive[0].note == "Sterk begin, na rust weggezakt.")
	}

	@Test("vertaalt een oude wedstrijd met helften naar de nieuwe vorm")
	func oudeWedstrijd() throws {
		var app = App()
		var oud = try #require(app.toestand.json.objectValue)
		oud["match"] = try JSONValue.parse(
			"""
			{
				"date": "2026-09-06",
				"opponent": "Oud",
				"home": true,
				"formation": "4-3-3",
				"lineup": {},
				"bench": [],
				"events": [],
				"elapsed": 0,
				"since": null,
				"running": false,
				"helft": 2,
				"finished": false
			}
			"""
		)
		app.opslag = JSONValue.object(oud).tekst()
		try app.load()
		#expect(app.match?.parts == 2)
		#expect(app.match?.part == 2)
		#expect(app.match?.inBreak == false)
	}
}

@Suite("van formatie wisselen met een standaardopstelling")
struct FormatieMetStandaardopstellingTests {
	private func metElftal() -> App {
		var app = App()
		app.toestand.players = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l"].enumerated().map { i, n in
			Player(
				id: "p" + n,
				name: n.uppercased(),
				line: i == 0 ? .geen : i <= 4 ? .V : i <= 7 ? .M : .A,
				keeper: i == 0
			)
		}
		app.toestand.formation = "4-3-3"
		app.toestand.defaultLineup = DefaultLineup(
			formation: "4-3-3",
			lineup: [
				"K": "pa",
				"RV": "pb",
				"CVr": "pc",
				"CVl": "pd",
				"LV": "pe",
				"MR": "pf",
				"MC": "pg",
				"ML": "ph",
				"RB": "pi",
				"SP": "pj",
				"LB": "pk",
			],
			bench: ["pl"]
		)
		return app
	}

	@Test("neemt de opstelling mee naar de nieuwe formatie")
	func neemtMee() throws {
		var app = metElftal()
		LineupActions.moveDefaultToFormation(&app.toestand, "4-4-2")
		let st = try #require(app.toestand.defaultLineup)
		#expect(st.formation == "4-4-2")
		#expect(st.lineup["K"] == "pa")
		#expect(st.lineup["CVr"] == "pc")
		#expect(st.lineup.opHetVeld.count == 10)
		#expect(st.bench.count == 2) /* the substitute plus the forward who does not fit */
	}

	@Test("raakt niemand kwijt")
	func niemandKwijt() throws {
		var app = metElftal()
		LineupActions.moveDefaultToFormation(&app.toestand, "1-3-3-1")
		let st = try #require(app.toestand.defaultLineup)
		#expect(Set(st.lineup.opHetVeld + st.bench).count == 12)
	}

	@Test("doet niets als de formatie al klopt")
	func alGoed() {
		var app = metElftal()
		let voor = app.toestand.defaultLineup?.jsonTekst()
		#expect(LineupActions.moveDefaultToFormation(&app.toestand, "4-3-3") == false)
		#expect(app.toestand.defaultLineup?.jsonTekst() == voor)
	}

	@Test("zet hem ook om als je het standaardscherm opent")
	func standaardscherm() {
		var app = metElftal()
		app.toestand.formation = "4-4-2 diamond"
		app.ensureDefaultLineup()
		#expect(app.toestand.defaultLineup?.formation == "4-4-2 diamond")
	}
}

@Suite("één formatie voor het team")
struct EenFormatieTests {
	@Test("zet de formatie én de standaardopstelling om, waar je hem ook kiest")
	func allebei() {
		var app = App()
		app.toestand.formation = "4-3-3"
		app.toestand.defaultLineup = DefaultLineup(formation: "4-3-3", lineup: ["K": "p1", "SP": "p2"], bench: [])
		LineupActions.chooseFormation(&app.toestand, "4-4-2 diamond")
		#expect(app.toestand.formation == "4-4-2 diamond")
		#expect(app.toestand.defaultLineup?.formation == "4-4-2 diamond")
		#expect(app.toestand.defaultLineup?.lineup["K"] == "p1")
	}

	@Test("negeert een formatie die niet bestaat")
	func bestaatNiet() {
		var app = App()
		app.toestand.formation = "4-3-3"
		#expect(LineupActions.chooseFormation(&app.toestand, "bestaat-niet") == false)
		#expect(app.toestand.formation == "4-3-3")
	}

	@Test("werkt ook zonder standaardopstelling")
	func zonderStandaard() {
		var app = App()
		app.toestand.defaultLineup = nil
		LineupActions.chooseFormation(&app.toestand, "1-2-2-1")
		#expect(app.toestand.formation == "1-2-2-1")
	}
}

@Suite("de naam van je team")
struct NaamVanJeTeamTests {
	@Test("begint neutraal en niet met het team van de maker")
	func neutraal() {
		#expect(emptyState().teamName == "Ons team")
	}

	@Test("onthoudt wat je invult, en weigert leeg")
	func onthoudt() {
		var app = App()
		app.setTeamName("JO11-2")
		#expect(app.toestand.teamName == "JO11-2")
		app.setTeamName("   ")
		#expect(app.toestand.teamName == "Ons team")
	}

	@Test("bewaart de naam bij de wedstrijd, zodat een hernoeming het archief niet omschrijft")
	func bijDeWedstrijd() {
		var app = App()
		app.setTeamName("JO11-2")
		app.newMatch("Sparta", true)
		app.toestand.match!.lineup = ["K": "p1"]
		app.finish()
		app.archiveMatch()
		app.setTeamName("JO12-1")
		#expect(app.toestand.archive[0].teamName == "JO11-2")
	}

	@Test("geeft oude opslag zonder teamnaam er alsnog een")
	func zonderTeamnaam() throws {
		var app = App()
		var oud = try #require(app.toestand.json.objectValue)
		oud.removeValue(forKey: "teamName")
		app.opslag = JSONValue.object(oud).tekst()
		app.toestand.teamName = "Iets anders"
		try app.load()
		#expect(app.toestand.teamName == "Ons team")
	}
}

@Suite("het wisselplan in de toestand")
struct WisselplanInDeToestandTests {
	/* (w.plan ??= []).push duwde in de kale lijst, buiten de reactieve toestand:
	   in de rekentests ging het goed, in de app was de stap weg. */
	@Test("bewaart een geplande wissel echt")
	func bewaart() throws {
		var app = App()
		app.newMatch("Sparta", true)
		app.planAdd(25, "p1", "p2")
		app.planAdd(35, "p2", "p1")
		#expect(app.match?.plan?.map(\.minuut) == [25, 35])
		let bewaard = try JSONValue.parse(try #require(app.opslag))
		#expect(bewaard["match"]?["plan"]?.arrayValue?.count == 2)
	}

	/* Het plan hoort bij de wedstrijd, en die gaat mee naar het andere toestel. */
	@Test("neemt het plan mee naar de server")
	func naarDeServer() throws {
		var app = App()
		app.newMatch("Sparta", true)
		app.planAdd(25, "p1", "p2")
		#expect(try app.syncPayload()["match"]?["plan"]?.arrayValue?.count == 1)
	}
}

@Suite("wat er tussen je toestellen heen en weer gaat")
struct TussenJeToestellenTests {
	/* This was missing: you set the lineup at home and your phone showed nothing. */
	@Test("neemt een wedstrijd die klaarstaat mee")
	func klaarstaand() throws {
		var app = App()
		app.newMatch("Sparta", true)
		app.toestand.match!.lineup = ["K": "p2", "SP": "p1"]
		app.setAbsent("p1", true)

		let pakket = try app.syncPayload()
		app = App()
		#expect(app.adoptSyncPayload(pakket) == true)
		#expect(app.match?.opponent == "Sparta")
		#expect(app.match?.lineup["K"] == "p2")
		#expect(app.match?.absent?.contains("p1") == true)
	}

	/* Na de aftrap wint dit toestel altijd: wissels die hier nog niet verstuurd
	   zijn, bestaan op dat moment nergens anders. */
	@Test("laat een wedstrijd die hier loopt met rust")
	func lopendMetRust() throws {
		var app = App()
		app.newMatch("Sparta", true)
		app.toestand.match!.lineup = ["K": "p2"]
		app.toestand.match!.events = [MatchEvent(type: .start, t: 0)]

		var vanElders = try app.syncPayload()
		zet(&vanElders, ["match"], .null)
		#expect(app.adoptSyncPayload(vanElders) == true)
		#expect(app.match?.opponent == "Sparta")
		#expect(app.kickedOff == true)
	}

	/*
	 * De andere helft van dezelfde regel, en die lag nergens vast. Vóór de aftrap
	 * wint de server wél. Dat is het geval waarin je thuis een opstelling maakt en
	 * er ondertussen op je telefoon ook een staat: dan is er één die het wordt, en
	 * ben je hooguit twee minuten klikken kwijt.
	 */
	@Test("laat een klaargezette opstelling wel wijken voor de server")
	func wijktVoorDeServer() throws {
		var app = App()
		app.newMatch("Hier", true)
		app.toestand.match!.lineup = ["K": "p2"]

		var vanElders = try app.syncPayload()
		zet(&vanElders, ["match", "opponent"], .string("Van de server"))
		zet(&vanElders, ["match", "lineup"], try JSONValue.parse(#"{"SP":"p1"}"#))

		#expect(app.adoptSyncPayload(vanElders) == true)
		#expect(app.match?.opponent == "Van de server")
		#expect(app.match?.lineup["SP"] == "p1")
	}

	/* En één tik op start verlegt die grens. */
	@Test("verlegt die grens zodra er afgetrapt is")
	func grensVerlegd() throws {
		var app = App()
		app.newMatch("Hier", true)
		app.toestand.match!.lineup = ["K": "p2"]
		app.toggleRunning()

		var vanElders = try app.syncPayload()
		zet(&vanElders, ["match", "opponent"], .string("Van de server"))

		#expect(app.adoptSyncPayload(vanElders) == true)
		#expect(app.match?.opponent == "Hier")
	}

	@Test("ruimt de wedstrijd wel op als hij afgelopen is")
	func afgelopen() throws {
		var app = App()
		app.newMatch("Sparta", true)
		app.toestand.match!.events = [MatchEvent(type: .start, t: 0)]
		app.toestand.match!.finished = true

		var vanElders = try app.syncPayload()
		zet(&vanElders, ["match"], .null)
		#expect(app.adoptSyncPayload(vanElders) == true)
		#expect(app.match == nil)
	}
}

@Suite("de aftrap vastleggen")
struct AftrapVastleggenTests {
	/* The first real match at the touchline went wrong on this. A player had been
	   swapped before the whistle, so the list was not empty, so 'start' was never
	   written. The clock ran fine, but the app believed all match long that kick-off
	   had not happened — and then position swaps are no longer recorded. */
	@Test("legt de aftrap ook vast als je vooraf nog geschoven hebt")
	func vooraafGeschoven() {
		var app = App()
		app.newMatch("Sparta", true)
		app.toestand.match!.lineup = ["K": "p2", "SP": "p1"]
		app.rebuildBench()

		app.chosenPosition = "SP"
		app.putOnPosition("p2") /* one last shuffle before kick-off */
		#expect(app.kickedOff == false)

		app.toggleRunning()
		#expect(app.kickedOff == true)
		#expect(app.toestand.match!.events.contains { $0.type == .start })
	}

	@Test("houdt schuiven voor de aftrap uit het verloop")
	func uitHetVerloop() {
		var app = App()
		app.newMatch("Sparta", true)
		app.toestand.match!.lineup = ["K": "p2", "SP": nil]
		app.rebuildBench()

		app.chosenPosition = "K"
		app.putOnPosition("p1")
		#expect(app.toestand.match!.events == [])
	}

	/* You set the lineup in the evening and play the next day. The match should not
	   then carry yesterday's date. */
	@Test("stempelt de speeldag bij de aftrap, niet bij het aanmaken")
	func speeldag() {
		var app = App()
		app.newMatch("Sparta", true)
		app.toestand.match!.date = "2020-01-01"
		app.toggleRunning()
		#expect(app.toestand.match!.date == App.VANDAAG)
	}

	@Test("legt een positieruil wel vast zodra er is afgetrapt")
	func positieruil() {
		var app = App()
		app.newMatch("Sparta", true)
		app.toestand.match!.lineup = ["K": "p2", "SP": "p1"]
		app.rebuildBench()
		app.chosenPosition = "SP"
		app.putOnPosition("p2")
		app.toggleRunning()

		app.swapDuringMatch("K", "SP")
		#expect(app.toestand.match!.events.filter { $0.type == .swap }.count == 1)
	}

	@Test("repareert een wedstrijd die zonder aftrap is opgeslagen")
	func zonderAftrap() throws {
		var app = App()
		app.newMatch("Sparta", true)
		app.toestand.match!.events = [MatchEvent(type: .substitution, t: 0, off: "p1", on: "p2", position: "SP")]
		app.save()
		app.toestand = emptyState()
		try app.load()
		#expect(app.kickedOff == true)
		#expect(app.toestand.match?.events.first?.type == .start)
		#expect(app.toestand.match?.events.count == 2)
	}
}

@Suite("een bewaarde wedstrijd op eigen benen")
struct OpEigenBenenTests {
	/* The archive stored the events but not the final lineup, and playing time is
	   wound back from precisely that lineup. So an archived match could not be
	   recalculated and was therefore beyond repair. This test proves it now can. */
	@Test("is uit zijn eigen gegevens opnieuw uit te rekenen")
	func opnieuwUitrekenen() throws {
		var app = App()
		app.newMatch("Sparta", true)
		app.toestand.match!.lineup = ["K": "p2", "SP": "p1"]
		app.rebuildBench()
		app.toggleRunning()
		app.toestand.match!.elapsed = 600
		app.chosenPosition = "SP"
		app.putOnPosition("p2") /* wissel onderweg */
		app.toestand.match!.elapsed = 1200
		app.finish()
		app.archiveMatch()

		let a = app.toestand.archive[0]
		#expect(a.lineup != nil)
		#expect(a.duration == 1200)

		let opnieuw = playingTimes(Match(herbouwdUit: a), app.toestand.players, nu: NU)
		#expect(a.playingTime.count == 2)
		for regel in a.playingTime {
			let id = try #require(regel.id)
			#expect(jsRound(try #require(opnieuw[id])) == regel.seconds)
		}
		#expect(a.playingTime.first { $0.id == "p1" }?.seconds == 600)
	}
}

@Suite("de selectie beheren")
struct SelectieBeherenTests {
	@Test("zet namen uit een plakblok erbij, één per regel, en slaat lege regels over")
	func plakblok() {
		var app = App()
		app.toestand.players = []
		app.addPlayerNames("  Bram \n\n Cas\n   \nDirk  ")
		#expect(app.toestand.players.map(\.name) == ["Bram", "Cas", "Dirk"])
		#expect(Set(app.toestand.players.map(\.id)).count == 3)
	}

	/* Toegevoegd bij de overzetting naar Swift: zonder eigen generator komen de ids
	   van de klok en het toeval, zoals in de webapp. */
	@Test("maakt zelf ids die bij een speler horen en van elkaar verschillen")
	func eigenIds() {
		var t = emptyState()
		SquadActions.addPlayerNames(&t, "Bram\nCas\nDirk")
		#expect(t.players.allSatisfy { $0.id.hasPrefix("p") && $0.id.count > 6 })
		#expect(Set(t.players.map(\.id)).count == 3)
	}

	@Test("vindt een speler op id, en niets bij een onbekende")
	func opId() {
		let app = App()
		#expect(app.playerById("p1")?.name == "Daanish")
		#expect(app.playerById("bestaat-niet") == nil)
		#expect(app.playerById(nil) == nil)
	}

	@Test("hernoemt zonder spaties eromheen")
	func hernoemt() {
		var app = App()
		SquadActions.renamePlayer(&app.toestand.players[0], "  Daan  ")
		#expect(app.toestand.players[0].name == "Daan")
	}

	@Test("verwijdert alleen de aangewezen speler")
	func verwijdert() {
		var app = App()
		SquadActions.removePlayer(&app.toestand, app.toestand.players[0])
		#expect(app.toestand.players.map(\.id) == ["p2"])
	}

	@Test("tikt een linie aan en weer uit")
	func linie() {
		var app = App()
		SquadActions.setLine(&app.toestand.players[0], .A)
		#expect(app.toestand.players[0].line == .A)
		SquadActions.setLine(&app.toestand.players[0], .A)
		#expect(app.toestand.players[0].line == .geen)
		SquadActions.setLine(&app.toestand.players[0], .V)
		#expect(app.toestand.players[0].line == .V)
	}

	@Test("zet keepen los van de linie aan en uit")
	func keepen() {
		var app = App()
		SquadActions.toggleKeeper(&app.toestand.players[0])
		#expect(app.toestand.players[0].keeper == true)
		#expect(app.toestand.players[0].line == .M) /* blijft staan: keepen is geen linie */
		SquadActions.toggleKeeper(&app.toestand.players[0])
		#expect(app.toestand.players[0].keeper == false)
	}
}

@Suite("doelpunten en het terugnemen van je laatste tik")
struct DoelpuntenEnTerugnemenTests {
	private func lopend() -> App {
		var app = App()
		app.newMatch("Sparta", true)
		app.toestand.match!.lineup = ["K": "p2", "SP": "p1"]
		app.rebuildBench()
		app.toggleRunning()
		return app
	}

	@Test("legt een doelpunt vast, met of zonder maker")
	func doelpunt() throws {
		var app = lopend()
		app.goal("p1")
		app.goal(nil)
		let g = app.toestand.match!.events.filter { $0.type == .goal }
		#expect(g.count == 2)
		#expect(g[0].player == "p1")
		#expect(g[1].player == nil)
		/* en in de opslag staat bij het tweede doelpunt een maker die er niet is */
		#expect(g[1].json["player"] == .null)
	}

	@Test("hangt de assist aan het laatste doelpunt, ook als er daarna iets anders gebeurde")
	func assist() {
		var app = lopend()
		app.goal("p1")
		app.concede()
		app.setAssist("p2")
		let goals = app.toestand.match!.events.filter { $0.type == .goal }
		#expect(goals.last?.assist == "p2")
	}

	@Test("telt een tegendoelpunt zonder maker")
	func tegendoelpunt() {
		var app = lopend()
		app.concede()
		#expect(app.toestand.match!.events.last?.type == .conceded)
	}

	@Test("noemt wat er terug kan, en niets als er niets te herstellen valt")
	func watTerugKan() {
		var app = lopend()
		#expect(app.undoable() == nil) /* alleen de aftrap */
		app.goal("p1")
		#expect(app.undoable() == "Doelpunt")
		app.concede()
		#expect(app.undoable() == "Tegendoelpunt")
	}

	@Test("neemt een doelpunt terug")
	func doelpuntTerug() {
		var app = lopend()
		app.goal("p1")
		let voor = app.toestand.match!.events.count
		app.undoLast()
		#expect(app.toestand.match!.events.count == voor - 1)
	}

	/* This was impossible, and it is exactly the slip that happens at the touchline:
	   you tap the player who scored and then the one who set it up, and you have
	   made a swap. */
	@Test("neemt ook een positiewissel terug")
	func positiewisselTerug() {
		var app = lopend()
		app.swapDuringMatch("K", "SP")
		#expect(app.match?.lineup["K"] == "p1")
		#expect(app.match?.lineup["SP"] == "p2")

		#expect(app.undoable() == "Positiewissel")
		app.undoLast()
		#expect(app.match?.lineup["K"] == "p2")
		#expect(app.match?.lineup["SP"] == "p1")
		#expect(app.match?.events.filter { $0.type == .swap }.count == 0)
	}

	@Test("draait een wissel helemaal terug, veld en bank")
	func wisselTerug() {
		var app = lopend()
		app.chosenPosition = "SP"
		app.putOnPosition("p2") /* p2 from goal to striker, p1 to the bench */
		#expect(app.match?.lineup["SP"] == "p2")
		#expect(app.match?.bench.contains("p1") == true)

		#expect(app.undoable() == "Wissel")
		app.undoLast()
		#expect(app.match?.lineup["SP"] == "p1")
		#expect(app.match?.bench.contains("p1") == false)
		#expect(app.match?.events.filter { $0.type == .substitution }.count == 0)
	}
}

@Suite("opstellen, opruimen en overnemen")
struct OpstellenOpruimenOvernemenTests {
	@Test("zet iemand op de gekozen plek en stuurt wie daar stond naar de bank")
	func gekozenPlek() {
		var app = App()
		app.newMatch("Sparta", true)
		app.toestand.match!.lineup = ["K": "p2", "SP": nil]
		app.rebuildBench()

		app.chosenPosition = "K"
		app.putOnPositionWhileSettingUp(.wedstrijd, "p1")
		#expect(app.match?.lineup["K"] == "p1")
		#expect(app.match?.bench.contains("p2") == true)
		#expect(app.chosenPosition == nil)
	}

	@Test("doet hetzelfde voor de standaardopstelling")
	func standaardopstelling() {
		var app = App()
		app.ensureDefaultLineup()
		app.chosenPosition = app.toestand.defaultLineup!.lineup.positions.first ?? "K"
		app.putOnPositionWhileSettingUp(.standaard, "p1")
		#expect(app.toestand.defaultLineup!.lineup.values.contains("p1"))
	}

	@Test("wist de standaardopstelling")
	func wist() {
		var app = App()
		app.ensureDefaultLineup()
		#expect(app.toestand.defaultLineup != nil)
		LineupActions.clearDefaultLineup(&app.toestand)
		#expect(app.toestand.defaultLineup == nil)
	}

	@Test("gooit een wedstrijd weg zonder het archief te raken")
	func gooitWeg() {
		var app = App()
		app.newMatch("Sparta", true)
		app.toestand.archive = [ArchivedMatch(date: "2026-01-01", opponent: "", home: true, score: [0, 0], formation: "", duration: 0)]
		app.discardMatch()
		#expect(app.match == nil)
		#expect(app.toestand.archive.count == 1)
	}

	@Test("verwijdert precies één wedstrijd uit het archief")
	func preciesEen() {
		var app = App()
		app.toestand.archive = ["A", "B", "C"].map {
			ArchivedMatch(date: "", opponent: $0, home: true, score: [0, 0], formation: "", duration: 0)
		}
		ArchiveActions.verwijderWedstrijd(&app.toestand, 1)
		#expect(app.toestand.archive.map(\.opponent) == ["A", "C"])
	}

	@Test("wijzigt tegenstander, thuis of uit, en de notitie")
	func wijzigt() {
		var app = App()
		app.newMatch("Sparta", true)
		app.setOpponent("  SV de Meer  ")
		app.setHome(false)
		app.setNote("Sterk begin.")
		#expect(app.match?.opponent == "SV de Meer")
		#expect(app.match?.home == false)
		#expect(app.match?.note == "Sterk begin.")
		/* terwijl hij nog typt blijft de spatie staan */
		app.setOpponent("Sparta ", typing: true)
		#expect(app.match?.opponent == "Sparta ")
		app.setOpponent("   ")
		#expect(app.match?.opponent == "Tegenstander")
	}

	@Test("schrijft een notitie bij een bewaarde wedstrijd")
	func notitie() {
		var app = App()
		app.toestand.archive = [ArchivedMatch(date: "", opponent: "A", home: true, score: [0, 0], formation: "", duration: 0)]
		ArchiveActions.setNote(&app.toestand, 0, "Achteraf bedacht.")
		#expect(app.toestand.archive[0].note == "Achteraf bedacht.")
		#expect(ArchiveActions.setNote(&app.toestand, 3, "Bestaat niet.") == false)
	}

	/* Adopting comes from a transfer code or a restored file. What is not in it
	   stays; a running match belongs to this device. */
	@Test("neemt alleen over wat er in het pakket zit")
	func alleenWatErin() {
		var app = App()
		app.newMatch("Sparta", true)
		app.toestand.teamName = "Oud"
		StoreActions.adoptPackage(
			&app.toestand,
			Overzetbaar(teamName: "JO13-1", players: [Player(id: "x", name: "Nieuw", line: .geen)])
		)
		#expect(app.toestand.teamName == "JO13-1")
		#expect(app.toestand.players.map(\.name) == ["Nieuw"])
		#expect(app.match != nil)
	}

	/* Keek naar het veld 'standaard', dat na de omzetting naar het Engels niet meer
	   bestaat. Selectie en archief kwamen terug, de standaardopstelling nooit. */
	@Test("zet ook de standaardopstelling terug")
	func standaardTerug() {
		var app = App()
		let opstelling = DefaultLineup(formation: "4-3-3", lineup: ["K": "x"], bench: [])
		StoreActions.adoptPackage(
			&app.toestand,
			Overzetbaar(players: [Player(id: "x", name: "Nieuw", line: .geen)], defaultLineup: opstelling)
		)
		#expect(app.toestand.defaultLineup == opstelling)
	}

	@Test("laat de standaardopstelling staan als hij niet in het pakket zit")
	func standaardBlijft() {
		var app = App()
		let opstelling = DefaultLineup(formation: "4-3-3", lineup: ["K": "x"], bench: [])
		app.toestand.defaultLineup = opstelling
		StoreActions.adoptPackage(&app.toestand, Overzetbaar(teamName: "JO13-1"))
		#expect(app.toestand.defaultLineup == opstelling)
		/* zit hij er wel in, maar leeg, dan gaat hij weg */
		StoreActions.adoptPackage(&app.toestand, Overzetbaar(defaultLineup: .some(nil)))
		#expect(app.toestand.defaultLineup == nil)
	}

	@Test("laat een lege teamnaam of een onbekende formatie met rust")
	func leegOfOnbekend() {
		var app = App()
		app.toestand.teamName = "JO13-1"
		app.toestand.formation = "4-3-3"
		StoreActions.adoptPackage(
			&app.toestand,
			Overzetbaar(teamName: "   ", players: app.toestand.players, formation: "bestaat-niet")
		)
		#expect(app.toestand.teamName == "JO13-1")
		#expect(app.toestand.formation == "4-3-3")
	}
}

@Suite("wat er van de server binnenkomt")
struct VanDeServerTests {
	/* The formation check was dead code: positionsOf() always falls back to 4-3-3
	   and so never returns anything empty. Every name got through. */
	@Test("weigert een formatie die we niet kennen")
	func onbekendeFormatie() throws {
		var app = App()
		app.toestand.formation = "4-3-3"
		var pakket = JSONValue.object(OrderedDict())
		zet(&pakket, ["players"], .array(app.toestand.players.map(\.json)))
		zet(&pakket, ["formation"], .string("bestaat-niet"))
		#expect(app.adoptSyncPayload(pakket) == true)
		#expect(app.toestand.formation == "4-3-3")
	}

	@Test("neemt een formatie die we wel kennen gewoon over")
	func bekendeFormatie() {
		var app = App()
		app.toestand.formation = "4-3-3"
		var pakket = JSONValue.object(OrderedDict())
		zet(&pakket, ["players"], .array(app.toestand.players.map(\.json)))
		zet(&pakket, ["formation"], .string("4-4-2"))
		#expect(app.adoptSyncPayload(pakket) == true)
		#expect(app.toestand.formation == "4-4-2")
	}

	/* Toegevoegd bij de overzetting naar Swift. */
	@Test("neemt niets over uit een pakket zonder selectie")
	func zonderSelectie() {
		var app = App()
		let voor = app.toestand
		#expect(app.adoptSyncPayload(.object(["teamName": .string("Iets anders")])) == false)
		#expect(app.adoptSyncPayload(.null) == false)
		#expect(app.toestand == voor)
	}
}

@Suite("de klok rechtstreeks zetten")
struct KlokRechtstreeksZettenTests {
	/* ±1' is enough when the referee is a minute out. Anyone entering a match
	   afterwards would be tapping a whole hour together. */
	@Test("zet de klok op de opgegeven minuut")
	func opDeMinuut() {
		var app = App()
		app.newMatch("Sparta", true)
		app.toggleRunning()
		app.setClock(23)
		#expect(elapsed(app.match, nu: app.nu) == 23 * 60)
	}

	@Test("telt de tijd sinds de laatste start er niet nog eens bovenop")
	func nietErBovenop() {
		var app = App()
		app.newMatch("Sparta", true)
		app.toggleRunning()
		app.toestand.match!.since = app.nu - 300_000 /* vijf minuten geleden gestart */
		#expect(elapsed(app.match, nu: app.nu) == 300)
		app.setClock(10)
		#expect(elapsed(app.match, nu: app.nu) == 10 * 60)
	}

	@Test("gaat nooit onder nul en laat een afgelopen wedstrijd met rust")
	func nooitOnderNul() {
		var app = App()
		app.newMatch("Sparta", true)
		app.toggleRunning()
		app.setClock(-5)
		#expect(app.match?.elapsed == 0)

		app.setClock(20)
		app.finish()
		let eind = app.match?.elapsed
		app.setClock(99)
		#expect(app.match?.elapsed == eind)
		#expect(eind == 1200)
	}

	@Test("negeert wat geen getal is")
	func geenGetal() {
		var app = App()
		app.newMatch("Sparta", true)
		app.toggleRunning()
		app.setClock(12)
		app.setClock(.nan)
		#expect(app.match?.elapsed == 720)
	}
}

/*
 * Een telefoon die leegloopt.
 *
 * Dit is het scenario waarvoor de lopende wedstrijd meegaat naar de server. Vier
 * seconden na elke wissel staat hij er; raakt het toestel op, dan pakt een ander
 * hem op met alles wat er al gebeurd is. Wat níét gebeurt is de andere kant op:
 * een wedstrijd die hier loopt wordt nooit overschreven door wat er op de server
 * staat — niet omdat wissels niet bewaard worden (dat gebeurt wel), maar omdat
 * er tussen de tik en het opsturen een gat zit waarin ze alleen hier staan.
 */
@Suite("een wedstrijd voortzetten op een ander toestel")
struct VoortzettenOpAnderToestelTests {
	private func opHetVeld() throws -> (app: App, pakket: JSONValue) {
		var app = App()
		app.toestand = emptyState()
		app.toestand.teamName = "JO14-3"
		app.toestand.players = [
			Player(id: "k1", name: "Bram", line: .geen, keeper: true),
			Player(id: "a1", name: "Finn", line: .A),
			Player(id: "b1", name: "Gijs", line: .A),
		]
		app.whoIsKeeping = "tjaco@voorbeeld.nl"
		app.newMatch("Kampong", true)
		app.toestand.match!.lineup = ["K": "k1", "SP": "a1"]
		app.toestand.match!.bench = ["b1"]
		app.toggleRunning()
		/* zoals langs de lijn: plek aantikken, dan de speler van de bank */
		app.chosenPosition = "SP"
		app.putOnPosition("b1")
		app.goal("b1")
		return (app, try app.syncPayload())
	}

	private func tweedeTelefoon(_ wie: String?) -> App {
		/* de tweede telefoon: net ingelogd, verder leeg */
		var app = App()
		app.toestand = emptyState()
		app.whoIsKeeping = wie
		return app
	}

	@Test("stuurt de lopende wedstrijd mee, met de wissels erin")
	func stuurtMee() throws {
		let pakket = try opHetVeld().pakket
		#expect(pakket["match"]?["running"] == .bool(true))
		let wissels = try #require(pakket["match"]?["events"]?.arrayValue).filter { $0["type"] == .string("substitution") }
		#expect(wissels.count == 1)
		#expect(pakket["match"]?["keptBy"] == .string("tjaco@voorbeeld.nl"))
	}

	@Test("komt compleet binnen op een toestel dat zelf niets heeft lopen")
	func kompleetBinnen() throws {
		let pakket = try opHetVeld().pakket
		var app = tweedeTelefoon("matthijs@voorbeeld.nl")
		#expect(app.adoptSyncPayload(pakket) == true)

		#expect(app.match?.opponent == "Kampong")
		#expect(app.kickedOff == true)
		#expect(app.match?.lineup["SP"] == "b1")
		#expect(app.match?.events.filter { $0.type == .substitution }.count == 1)
		#expect(app.match?.events.filter { $0.type == .goal }.count == 1)
	}

	@Test("laat daarna zien op wiens toestel hij begonnen is")
	func wiensToestel() throws {
		let pakket = try opHetVeld().pakket
		var app = tweedeTelefoon(nil)
		#expect(app.adoptSyncPayload(pakket) == true)
		#expect(app.match?.keptBy == "tjaco@voorbeeld.nl")
	}

	@Test("draagt over zonder iets van de wedstrijd te veranderen")
	func draagtOver() throws {
		let pakket = try opHetVeld().pakket
		var app = tweedeTelefoon("matthijs@voorbeeld.nl")
		#expect(app.adoptSyncPayload(pakket) == true)
		var voor = try #require(app.match)
		voor.keptBy = nil

		#expect(app.takeOverMatch() == true)
		#expect(app.match?.keptBy == "matthijs@voorbeeld.nl")
		var na = try #require(app.match)
		na.keptBy = nil
		#expect(na == voor)
	}

	/* En de andere kant op blijft dicht: wat hier loopt gaat voor. */
	@Test("overschrijft nooit een wedstrijd die hier al loopt")
	func nooitOverschrijven() throws {
		let pakket = try opHetVeld().pakket
		var app = try opHetVeld().app
		app.toestand.match!.opponent = "Hier op het veld"
		#expect(app.adoptSyncPayload(pakket) == true)
		#expect(app.match?.opponent == "Hier op het veld")
	}

	@Test("neemt niets over als je niet ingelogd bent")
	func nietIngelogd() throws {
		var app = try opHetVeld().app
		app.whoIsKeeping = nil
		#expect(app.takeOverMatch() == false)
	}

	@Test("neemt een afgelopen wedstrijd niet over")
	func afgelopenNiet() throws {
		var app = try opHetVeld().app
		app.toestand.match!.finished = true
		app.whoIsKeeping = "matthijs@voorbeeld.nl"
		#expect(app.takeOverMatch() == false)
	}
}
