import Testing
@testable import BlaadjeKern

/// Het programma en de taken: een wedstrijd die nog komt wordt op de dag zelf de
/// wedstrijd, en wat ouders regelen blijft eraan vast zitten.
@Suite struct ProgramTests {
	let team = "11111111-1111-4111-8111-111111111111"

	func metProgramma() -> (AppState, String) {
		var t = emptyState()
		t.players = [Player(id: "p1", name: "Sem"), Player(id: "p2", name: "Noah"), Player(id: "p3", name: "Luuk")]
		let id = ProgramActions.voegToe(&t, datum: "2026-10-25", tijd: "10:30", tegenstander: " Sparta ", thuis: true, nieuwId: { "w-25" })
		ProgramActions.voegToe(&t, datum: "2026-10-18", tijd: "9:00", tegenstander: "", thuis: false, nieuwId: { "w-18" })
		// Zonder de open taken waarmee een wedstrijd begint: die hebben hun eigen test.
		t.tasks = []
		ProgramActions.zet(&t, wedstrijd: id, .limonade, speler: "p2", nieuwId: { "t1" })
		ProgramActions.voegToe(&t, wedstrijd: id, .rijden, speler: "p1", nieuwId: { "t2" })
		ProgramActions.voegToe(&t, wedstrijd: id, .rijden, speler: nil, nieuwId: { "t3" })
		return (t, id)
	}

	@Test func hetProgrammaStaatOpVolgorde() {
		let (t, _) = metProgramma()
		#expect(t.program.map(\.id) == ["w-18", "w-25"])
		#expect(t.program[1].opponent == "Sparta")
		#expect(t.program[0].opponent == "Tegenstander")
		#expect(t.program[0].time == nil, "9:00 is geen tijd zoals we hem schrijven")
		#expect(t.program[1].time == "10:30")
	}

	@Test func eenWedstrijdOpenenMetDezelfdeTaken() {
		var (t, id) = metProgramma()
		#expect(ProgramActions.open(&t, id))
		#expect(t.match?.id == id)
		#expect(t.match?.opponent == "Sparta")
		#expect(t.match?.time == "10:30")
		#expect(t.match?.date == "2026-10-25")
		#expect(t.program.map(\.id) == ["w-18"])
		#expect(ProgramActions.taken(t, wedstrijd: id).count == 3)
		#expect(t.match?.formation == t.formation)
	}

	@Test func eenAndereOpenenZetDeEersteTerugMetZijnOpstelling() throws {
		var (t, id) = metProgramma()
		#expect(ProgramActions.open(&t, id))
		t.match?.lineup["K"] = "p3"
		#expect(ProgramActions.open(&t, "w-18"))
		#expect(t.match?.id == "w-18")
		let terug = try #require(ProgramActions.wedstrijd(t, id))
		#expect(terug.lineup["K"] == "p3", "de opstelling blijft bij de wedstrijd")
		#expect(terug.fromProgram == nil)
		#expect(ProgramActions.nogTeSpelen(t).map(\.id) == ["w-18", id])
		// Weer terug: de opstelling staat er nog.
		#expect(ProgramActions.open(&t, id))
		#expect(t.match?.lineup["K"] == "p3")
		// Na de aftrap gaat de wedstrijd van nu voor.
		_ = ClockActions.toggleRunning(&t.match, nu: 1000, vandaag: "2026-10-25")
		#expect(!ProgramActions.open(&t, "w-18"), "er is een wedstrijd bezig")
	}

	@Test func eenAfgemeldKindGaatUitDeOpstelling() throws {
		var (t, id) = metProgramma()
		#expect(ProgramActions.open(&t, id))
		t.match?.lineup["K"] = "p2"
		ProgramActions.terugInProgramma(&t)
		let i = try #require(t.program.firstIndex { $0.id == id })
		t.program[i].absent = ["p2"]
		#expect(ProgramActions.open(&t, id))
		#expect(t.match?.lineup["K"] == nil)
		#expect(!(t.match?.bench.contains("p2") ?? true))
	}

	@Test func weggooienZetHemTerugInHetProgramma() {
		var (t, id) = metProgramma()
		ProgramActions.open(&t, id)
		ProgramActions.terugInProgramma(&t)
		t.match = nil
		#expect(t.program.map(\.id) == ["w-18", "w-25"])
		#expect(t.tasks.count == 3)
	}

	@Test func eenTaakVoorEenFamilie() {
		var (t, id) = metProgramma()
		ProgramActions.zet(&t, wedstrijd: id, .limonade, speler: "p3")
		#expect(ProgramActions.taken(t, wedstrijd: id).filter { $0.kind == .limonade }.map(\.player) == ["p3"])
		ProgramActions.zet(&t, wedstrijd: id, .limonade, speler: nil)
		#expect(!ProgramActions.taken(t, wedstrijd: id).contains { $0.kind == .limonade })
		ProgramActions.wijs(&t, taak: "t3", speler: "p2")
		#expect(t.tasks.first { $0.id == "t3" }?.player == "p2")
		ProgramActions.haalWeg(&t, id)
		#expect(t.tasks.isEmpty)
	}

	@Test func hetProgrammaGaatHeenEnTerugDoorDeTabellen() throws {
		var (t, id) = metProgramma()
		t.tasks[0].player = nil
		t.tasks[0].declinedBy = "p2"
		let terug = try #require(SyncModel.toestand(uit: SyncModel.alsTabellen(SyncModel.rijen(van: t, team: team)), team: team))
		#expect(terug.match == nil, "een wedstrijd uit het programma is nog niet opgezet")
		#expect(terug.program.map(\.opponent) == ["Tegenstander", "Sparta"])
		#expect(terug.program.map(\.time) == [nil, "10:30"])
		#expect(terug.tasks.map(\.kind) == [.limonade, .rijden, .rijden])
		#expect(terug.tasks[0].player == nil)
		#expect(terug.tasks[0].declinedBy == SyncModel.uuid("p2", team: team))

		// Een opstelling bij een wedstrijd die nog komt, gaat mee.
		let j = try #require(t.program.firstIndex { $0.id == "w-18" })
		t.program[j].lineup["K"] = "p1"
		t.program[j].bench = ["p2", "p3"]
		t.program[j].absent = ["p3"]
		let metOpstelling = try #require(SyncModel.toestand(uit: SyncModel.alsTabellen(SyncModel.rijen(van: t, team: team)), team: team))
		let w18 = try #require(metOpstelling.program.first { $0.opponent == "Tegenstander" })
		#expect(w18.lineup["K"] == SyncModel.uuid("p1", team: team))
		#expect(w18.bench == [SyncModel.uuid("p2", team: team)], "wie afgemeld is, staat niet op de bank")
		#expect(w18.absent == [SyncModel.uuid("p3", team: team)])

		ProgramActions.open(&t, id)
		let bezig = try #require(SyncModel.toestand(uit: SyncModel.alsTabellen(SyncModel.rijen(van: t, team: team)), team: team))
		#expect(bezig.match?.opponent == "Sparta")
		#expect(bezig.match?.time == "10:30")
		#expect(bezig.match?.fromProgram == true)
		#expect(bezig.program.count == 1)
		#expect(bezig.tasks.count == 3)
	}

	@Test func eenTaakBijEenWedstrijdDieErNietIsGaatNietMee() {
		var (t, _) = metProgramma()
		t.tasks.append(TeamTask(id: "los", matchId: "bestaat-niet", kind: .fluiten, player: "p1"))
		let rijen = SyncModel.rijen(van: t, team: team).filter { $0.tabel == "taken" }
		#expect(rijen.count == 3)
	}

	@Test func deVerenigingFluitEnDanStaatHetNietOpen() {
		var (t, id) = metProgramma()
		ProgramActions.zet(&t, wedstrijd: id, .fluiten, speler: ProgramActions.vereniging, nieuwId: { "t4" })
		let fluiten = ProgramActions.taken(t, wedstrijd: id).first { $0.kind == .fluiten }
		#expect(fluiten?.club == true)
		#expect(fluiten?.player == nil)
		#expect(fluiten?.open == false)
		ProgramActions.zet(&t, wedstrijd: id, .fluiten, speler: "p3")
		let daarna = ProgramActions.taken(t, wedstrijd: id).first { $0.kind == .fluiten }
		#expect(daarna?.club == false, "een ouder in plaats van de vereniging")
		#expect(daarna?.player == "p3")
	}

	@Test func wieDeedWatVanOudNaarNieuw() throws {
		var (t, id) = metProgramma()
		ProgramActions.zet(&t, wedstrijd: id, .fluiten, speler: "p1")
		ProgramActions.zet(&t, wedstrijd: "w-18", .fluiten, speler: ProgramActions.vereniging)
		ProgramActions.zet(&t, wedstrijd: "w-18", .vlaggen, speler: "p2")
		#expect(ProgramActions.open(&t, "w-18"))
		_ = MatchActions.archiveMatch(&t, nu: 1_000_000)

		let beurten = ProgramActions.beurten(t, .fluiten)
		#expect(beurten.map(\.wedstrijd) == ["w-18", id], "oudste eerst")
		#expect(beurten[0].club && beurten[0].geweest)
		#expect(beurten[1].speler == "p1" && !beurten[1].geweest)
		#expect(ProgramActions.telling(t, .fluiten).map { "\($0.speler.name) \($0.keer)" } == ["Luuk 0", "Noah 0", "Sem 1"])
		// Een rijplek waar nog niemand voor is, telt niet.
		#expect(ProgramActions.beurten(t, .rijden).map(\.speler) == ["p1"])
	}

	@Test func thuisBegintMetOpenLimonadeEnUitZonderTaken() {
		var t = emptyState()
		var n = 0
		let thuis = ProgramActions.voegToe(&t, datum: "2026-11-01", tijd: nil, tegenstander: "TABA", thuis: true, nieuwId: { "thuis" }, taakId: { n += 1; return "t\(n)" })
		let uit = ProgramActions.voegToe(&t, datum: "2026-11-08", tijd: nil, tegenstander: "Waterwijk", thuis: false, nieuwId: { "uit" }, taakId: { n += 1; return "t\(n)" })
		#expect(ProgramActions.taken(t, wedstrijd: thuis).map(\.kind) == [.limonade])
		#expect(ProgramActions.taken(t, wedstrijd: uit).isEmpty, "wie rijdt, zegt een ouder zelf")
		#expect(t.tasks.filter { !$0.open }.isEmpty, "ouders kunnen ze pakken")
		#expect(ProgramActions.soorten(thuis: false) == [.rijden, .vlaggen, .teamtas], "uit: geen limonade, fluiten of velddienst")
		#expect(ProgramActions.soorten(thuis: true).contains(.fluiten))
		#expect(!ProgramActions.soorten(thuis: true).contains(.rijden))
	}

	@Test func vanThuisNaarUitGaatWatNietPastWeg() {
		var t = emptyState()
		let id = ProgramActions.voegToe(&t, datum: "2026-11-01", tijd: nil, tegenstander: "TABA", thuis: true, nieuwId: { "w" })
		ProgramActions.zet(&t, wedstrijd: id, .fluiten, speler: "p1")
		ProgramActions.zet(&t, wedstrijd: id, .vlaggen, speler: "p2")
		ProgramActions.wijzig(&t, id, thuis: false)
		let soorten = ProgramActions.taken(t, wedstrijd: id).map(\.kind.rawValue).sorted()
		#expect(soorten == ["vlaggen"])
		#expect(ProgramActions.taken(t, wedstrijd: id).first { $0.kind == .vlaggen }?.player == "p2", "vlaggen blijft, met wie het deed")
	}

	@Test func eenTaakOpenZettenZodatEenOuderHemPakt() {
		var (t, id) = metProgramma()
		ProgramActions.zet(&t, wedstrijd: id, .limonade, speler: ProgramActions.open)
		let limonade = ProgramActions.taken(t, wedstrijd: id).first { $0.kind == .limonade }
		#expect(limonade?.open == true)
		#expect(limonade?.player == nil)
	}

	@Test func wieZichAfmeldtStaatOpDeDagZelfOpAfwezig() {
		var (t, id) = metProgramma()
		let i = t.program.firstIndex { $0.id == id }!
		t.program[i].absent = ["p2", "weg-uit-het-team"]
		#expect(ProgramActions.kanNiet(t, wedstrijd: id).map(\.id) == ["p2"])
		#expect(ProgramActions.open(&t, id))
		#expect(t.match?.absent == ["p2"], "wie niet meer in het team zit, valt eraf")
		// Toch niet vandaag: terug in het programma, met wie niet kan.
		_ = MatchActions.setAbsent(&t, spelerId: "p1", absent: true)
		ProgramActions.terugInProgramma(&t)
		#expect(t.program.first { $0.id == id }?.absent == ["p2", "p1"])
	}
}
