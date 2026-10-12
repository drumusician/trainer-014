import Testing
@testable import BlaadjeKern

/*
 * Bij het maken van de opstelling: wie zat er al veel op de bank? Het doel is
 * dat niet elke week dezelfde jongens op de bank beginnen.
 */
private let SPELERS: [Player] = [
	Player(id: "k1", name: "Bram", line: .geen, keeper: true),
	Player(id: "v1", name: "Cas", line: .V),
	Player(id: "v2", name: "Dirk", line: .V),
	Player(id: "m1", name: "Gijs", line: .M),
	Player(id: "a1", name: "Luuk", line: .A),
	Player(id: "b1", name: "Mees", line: .A),
	Player(id: "b2", name: "Isa", line: .M),
	Player(id: "w1", name: "Siem", line: .M),
]

/* Mees en Isa beginnen op de bank en komen er na twintig minuten in. Siem is afgemeld. */
private let WEDSTRIJD = ArchivedMatch(
	date: "2026-09-13",
	opponent: "Buitenboys",
	home: false,
	score: [1, 0],
	formation: "1-2-1-1",
	duration: 2400,
	parts: 2,
	events: [
		MatchEvent(type: .start, t: 0),
		MatchEvent(type: .substitution, t: 1200, off: "a1", on: "b1", position: "SP"),
		MatchEvent(type: .substitution, t: 1200, off: "m1", on: "b2", position: "CM"),
		MatchEvent(type: .substitution, t: 1800, off: "v1", on: "a1", position: "LV"),
	],
	absent: ["w1"],
	playingTime: [
		PlayingTimeRow(id: "k1", name: "Bram", seconds: 2400, keeper: 2400),
		PlayingTimeRow(id: "v1", name: "Cas", seconds: 1800),
		PlayingTimeRow(id: "v2", name: "Dirk", seconds: 2400),
		PlayingTimeRow(id: "m1", name: "Gijs", seconds: 1200),
		PlayingTimeRow(id: "a1", name: "Luuk", seconds: 1800),
		PlayingTimeRow(id: "b1", name: "Mees", seconds: 1200),
		PlayingTimeRow(id: "b2", name: "Isa", seconds: 1200),
		PlayingTimeRow(id: "w1", name: "Siem", seconds: 0),
	],
	lineup: ["K": "k1", "LV": "a1", "RV": "v2", "CM": "b2", "SP": "b1"],
	bench: ["m1", "v1"]
)

private let TRAININGEN: [Training] = [
	Training(id: "t2", date: "2026-09-18", status: ["b1": .present, "w1": .absent]),
	Training(id: "t1", date: "2026-09-11", status: ["b1": .excused, "w1": .present]),
]

private func rij(_ rijen: [BenchRow], _ id: String) throws -> BenchRow {
	try #require(rijen.first { $0.id == id })
}

@Suite("wie zat er op de bank")
struct BankTests {
	@Test("telt de minuten op de bank en of hij daar begon")
	func minutenOpDeBank() throws {
		let rijen = benchOverview(SPELERS, [WEDSTRIJD], [])
		let mees = try rij(rijen, "b1")
		#expect(mees.matches == 1)
		#expect(mees.benchSeconds == 1200)
		#expect(mees.startedOnBench == 1)
		#expect(mees.startsKnown == 1)
		/* Gijs begon wel, maar ging er na twintig minuten uit */
		let gijs = try rij(rijen, "m1")
		#expect(gijs.benchSeconds == 1200)
		#expect(gijs.startedOnBench == 0)
		#expect(gijs.startsKnown == 1)
		let bram = try rij(rijen, "k1")
		#expect(bram.benchSeconds == 0)
		#expect(bram.startedOnBench == 0)
	}

	/* Afgemeld is geen bankzitten: anders staat wie ziek was bovenaan. */
	@Test("telt een wedstrijd waarbij hij er niet was niet mee")
	func afgemeld() throws {
		let siem = try rij(benchOverview(SPELERS, [WEDSTRIJD], []), "w1")
		#expect(siem.matches == 0)
		#expect(siem.benchSeconds == 0)
		#expect(siem.startsKnown == 0)
	}

	@Test("telt over meer wedstrijden op")
	func meerWedstrijden() throws {
		var tweede = WEDSTRIJD
		tweede.date = "2026-09-06"
		let isa = try rij(benchOverview(SPELERS, [WEDSTRIJD, tweede], []), "b2")
		#expect(isa.matches == 2)
		#expect(isa.benchSeconds == 2400)
		#expect(isa.startedOnBench == 2)
		#expect(isa.startsKnown == 2)
	}

	@Test("zet wie het meest op de bank zat bovenaan")
	func bovenaan() {
		let rijen = benchOverview(SPELERS, [WEDSTRIJD], [])
		/* Isa, Mees en Gijs twintig minuten; wie op de bank begon eerst, dan op naam */
		#expect(rijen.prefix(3).map(\.name) == ["Isa", "Mees", "Gijs"])
	}

	/* Zonder bewaarde eindopstelling is niet terug te rekenen wie er begon. De
	   bankminuten kloppen dan nog wel, dus die tellen gewoon. */
	@Test("gokt niet wie er begon bij een wedstrijd zonder opstelling")
	func zonderOpstelling() throws {
		var oud = WEDSTRIJD
		oud.lineup = nil
		oud.bench = nil
		let mees = try rij(benchOverview(SPELERS, [oud], []), "b1")
		#expect(mees.matches == 1)
		#expect(mees.benchSeconds == 1200)
		#expect(mees.startedOnBench == 0)
		#expect(mees.startsKnown == 0)
	}

	@Test("zet de trainingsopkomst van het hele seizoen erbij")
	func trainingsopkomst() throws {
		let rijen = benchOverview(SPELERS, [], TRAININGEN)
		#expect(try rij(rijen, "b1").attendance == AttendanceSummary(er: 1, totaal: 2))
		#expect(try rij(rijen, "w1").attendance == AttendanceSummary(er: 1, totaal: 2))
		#expect(try rij(rijen, "k1").attendance == AttendanceSummary(er: 0, totaal: 0))
	}

	@Test("geeft precies één regel per speler uit de selectie")
	func eenRegelPerSpeler() {
		let rijen = benchOverview(SPELERS, [WEDSTRIJD], [])
		#expect(rijen.count == SPELERS.count)
	}
}
