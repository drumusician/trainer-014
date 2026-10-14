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

	@Test func opDeDagZelfWordtHetDeWedstrijdMetDezelfdeTaken() {
		var (t, id) = metProgramma()
		#expect(ProgramActions.uitProgramma(&t, id))
		#expect(t.match?.id == id)
		#expect(t.match?.opponent == "Sparta")
		#expect(t.match?.time == "10:30")
		#expect(t.match?.date == "2026-10-25")
		#expect(t.program.map(\.id) == ["w-18"])
		#expect(ProgramActions.taken(t, wedstrijd: id).count == 3)
		#expect(!ProgramActions.uitProgramma(&t, "w-18"), "er staat al een wedstrijd open")
	}

	@Test func weggooienZetHemTerugInHetProgramma() {
		var (t, id) = metProgramma()
		ProgramActions.uitProgramma(&t, id)
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

		ProgramActions.uitProgramma(&t, id)
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
}
