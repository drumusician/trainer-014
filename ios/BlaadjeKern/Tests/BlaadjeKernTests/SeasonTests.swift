import Testing
@testable import BlaadjeKern

private let players: [Player] = [
	Player(id: "p1", name: "Aad", line: .A),
	Player(id: "p2", name: "Bram", line: .V),
]

private let archive: [ArchivedMatch] = [
	ArchivedMatch(
		date: "2026-09-05",
		opponent: "Ajax",
		home: true,
		score: [2, 0],
		formation: "4-3-3",
		duration: 4200,
		events: [
			MatchEvent(type: .goal, t: 600, player: "p1"),
			MatchEvent(type: .goal, t: 1800, player: nil),
		],
		names: ["p1": "Aad", "p2": "Bram"],
		playingTime: [
			PlayingTimeRow(id: "p1", name: "Aad", seconds: 4200, keeper: 2100),
			PlayingTimeRow(id: "p2", name: "Bram", seconds: 2100, keeper: 0),
		]
	),
	ArchivedMatch(
		date: "2026-08-29",
		opponent: "Sparta",
		home: false,
		score: [1, 3],
		formation: "4-3-3",
		duration: 4200,
		events: [MatchEvent(type: .goal, t: 900, player: "p2")],
		names: ["p1": "Aad", "p2": "Bram"],
		playingTime: [
			PlayingTimeRow(id: "p1", name: "Aad", seconds: 0, keeper: 0),
			PlayingTimeRow(id: "p2", name: "Bram", seconds: 4200, keeper: 0),
		]
	),
]

@Suite("seizoen")
struct SeizoenTests {
	@Test("telt winst, verlies en doelpunten")
	func winstEnVerlies() {
		let st = seizoenStand(archive)
		#expect(st.wedstrijden == 2)
		#expect(st.gewonnen == 1)
		#expect(st.verloren == 1)
		#expect(st.gelijk == 0)
		#expect(st.voor == 3)
		#expect(st.tegen == 3)
	}

	@Test("telt speeltijd op en houdt keeperminuten apart")
	func speeltijd() throws {
		let rijen = seasonTotals(archive, players)
		let aad = try #require(rijen.first { $0.name == "Aad" })
		#expect(aad.seconds == 4200)
		#expect(aad.keeper == 2100)
		#expect(aad.wedstrijden == 1) /* that second one was on the bench */
	}

	@Test("houdt iemand die hernoemd is als één speler")
	func hernoemd() throws {
		var aad = players[0]
		aad.name = "Aad de Jong"
		let hernoemd: [Player] = [aad, players[1]]
		let rijen = seasonTotals(archive, hernoemd)
		#expect(rijen.filter { $0.name.hasPrefix("Aad") }.count == 1)
		#expect(try #require(rijen.first { $0.name == "Aad de Jong" }).seconds == 4200)
	}

	@Test("vertelt bij elke maker in welke wedstrijden hij scoorde")
	func perMaker() {
		let rijen = makers(archive, players)
		#expect(rijen.map(\.name) == ["Aad", "Bram"])
		#expect(rijen[0].wedstrijden == [MakerRegel.Wedstrijd(date: "2026-09-05", opponent: "Ajax", aantal: 1)])
		/* the goal without a scorer counts towards the score, not in this list */
		#expect(rijen.reduce(0) { $0 + $1.doelpunten } == 2)
	}

	@Test("zet de topscorer bovenaan en laat onbekende makers weg")
	func topscorer() {
		let t = topscorers(seasonTotals(archive, players))
		/* equal goals: then playing time decides, and Bram played more */
		#expect(t.map(\.name) == ["Bram", "Aad"])
		#expect(t.reduce(0) { $0 + $1.doelpunten } == 2) /* van de 3 doelpunten */
	}

	@Test("het seizoen van één speler: speeltijd, waar, doelpunten, assists, afgemeld en trainingen")
	func eenSpeler() {
		var t = emptyState()
		t.players = players
		var eerste = archive[0]
		eerste.events.append(MatchEvent(type: .goal, t: 2400, player: "p2", assist: "p1"))
		eerste.playingTime[0].positions = ["SP": 2100, "K": 2100]
		var tweede = archive[1]
		tweede.playingTime[0].positions = [:]
		let derde = ArchivedMatch(
			date: "2026-09-12", opponent: "PSV", home: true, score: [0, 0], formation: "4-3-3", duration: 4200,
			absent: ["p1"], playingTime: [PlayingTimeRow(id: "p2", name: "Bram", seconds: 4200, keeper: 0)])
		t.archive = [eerste, tweede, derde]
		t.trainings = [
			Training(id: "t1", date: "2026-09-01", status: ["p1": .present]),
			Training(id: "t2", date: "2026-09-03", status: ["p1": .absent]),
		]

		let aad = spelerSeizoen(t, "p1")
		#expect(aad.wedstrijden.map(\.opponent) == ["Ajax", "Sparta", "PSV"])
		#expect(aad.wedstrijden.map(\.erNiet) == [false, false, true])
		#expect(aad.wedstrijden[2].index == 2)
		#expect(aad.seconds == 4200)
		#expect(aad.gespeeld == 1, "op de bank en afgemeld tellen niet als gespeeld")
		#expect(aad.gemiddeld == 4200)
		#expect(aad.keeper == 2100)
		#expect(aad.doelpunten == 1)
		#expect(aad.assists == 1)
		#expect(aad.plekken.map(\.label).sorted() == ["K", "SP"])
		#expect(aad.training == AttendanceSummary(er: 1, totaal: 2))

		let bram = spelerSeizoen(t, "p2")
		#expect(bram.doelpunten == 2)
		#expect(bram.assists == 0)
		#expect(bram.gespeeld == 3)
		#expect(spelerSeizoen(t, "onbekend").wedstrijden.isEmpty)
	}
}

