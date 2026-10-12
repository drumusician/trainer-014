import Testing
@testable import BlaadjeKern

private let players: [Player] = [
	Player(id: "p1", name: "Daanish", line: .M),
	Player(id: "p2", name: "Gijs", line: .geen, keeper: true),
	Player(id: "p3", name: "Nieuw", line: .A),
]

private let archive: [ArchivedMatch] = [
	ArchivedMatch(
		date: "2026-08-30",
		opponent: "Ajax",
		home: true,
		score: [1, 0],
		formation: "4-3-3",
		duration: 4200,
		events: [MatchEvent(type: .goal, t: 900, player: "p1")],
		names: ["p1": "Daanish", "p2": "Gijs"],
		playingTime: [
			PlayingTimeRow(id: "p1", name: "Daanish", seconds: 4200, keeper: 0),
			PlayingTimeRow(id: "p2", name: "Gijs", seconds: 2100, keeper: 2100),
		]
	)
]

private let trainings: [Training] = [
	Training(id: "t1", date: "2026-09-02", status: ["p1": .present, "p2": .absent]),
	Training(id: "t2", date: "2026-08-26", status: ["p1": .present, "p2": .present]),
]

@Suite("spelersoverzicht")
struct SpelersoverzichtTests {
	@Test("zet minuten, doelpunten en presentie op één regel")
	func opEenRegel() throws {
		let rijen = spelersOverzicht(players, archive, trainings)
		let daanish = try #require(rijen.first { $0.name == "Daanish" })
		#expect(daanish.seconds == 4200)
		#expect(daanish.matches == 1)
		#expect(daanish.goals == 1)
		#expect(daanish.attendance == AttendanceSummary(er: 2, totaal: 2))
		let gijs = try #require(rijen.first { $0.name == "Gijs" })
		#expect(gijs.keeperSeconds == 2100)
		#expect(percentage(gijs.attendance) == 50)
	}

	@Test("laat iemand die nog niets deed gewoon op nul staan")
	func opNul() throws {
		let nieuw = try #require(spelersOverzicht(players, archive, trainings).first { $0.name == "Nieuw" })
		#expect(nieuw.seconds == 0)
		#expect(percentage(nieuw.attendance) == nil)
	}

	@Test("zet de makers bovenaan als je op doelpunten sorteert")
	func makersBovenaan() {
		let rijen = spelersOverzicht(players, archive, trainings)
		#expect(sorteer(rijen, .doelpunten).map(\.name) == ["Daanish", "Gijs", "Nieuw"])
	}

	@Test("sorteert op naam, minuten of presentie")
	func sorteren() {
		let rijen = spelersOverzicht(players, archive, trainings)
		#expect(sorteer(rijen, .naam).map(\.name) == ["Daanish", "Gijs", "Nieuw"])
		#expect(sorteer(rijen, .minuten).map(\.name) == ["Daanish", "Gijs", "Nieuw"])
		/* whoever came least at the top; whoever never had a session at the bottom */
		#expect(sorteer(rijen, .presentie).map(\.name) == ["Gijs", "Daanish", "Nieuw"])
	}
}

@Suite("assists")
struct AssistsTests {
	@Test("telt ze mee per speler")
	func perSpeler() throws {
		var metAssist = archive
		metAssist[0].events = [MatchEvent(type: .goal, t: 900, player: "p1", assist: "p2")]
		let rijen = spelersOverzicht(players, metAssist, trainings)
		#expect(try #require(rijen.first { $0.name == "Gijs" }).assists == 1)
		#expect(try #require(rijen.first { $0.name == "Daanish" }).assists == 0)
	}
}

@Suite("presentie")
struct PresentieTests {
	/* Toegevoegd bij de overzetting naar Swift: de webapp test dit via de schermen. */
	@Test("telt alleen de laatste trainingen waar hij bij hoorde")
	func laatste() {
		let reeks: [Training] = [
			Training(id: "t4", date: "2026-09-04", status: ["p1": .absent]),
			Training(id: "t3", date: "2026-09-03", status: ["p2": .present]),
			Training(id: "t2", date: "2026-09-02", status: ["p1": .excused]),
			Training(id: "t1", date: "2026-09-01", status: ["p1": .present]),
		]
		#expect(attendanceOf(reeks, "p1", 2) == AttendanceSummary(er: 0, totaal: 2))
		#expect(attendanceOf(reeks, "p1") == AttendanceSummary(er: 1, totaal: 3))
		#expect(thinAttendance(attendanceOf(reeks, "p1", 2)))
		#expect(!thinAttendance(AttendanceSummary(er: 1, totaal: 2)))
		#expect(!thinAttendance(AttendanceSummary(er: 0, totaal: 1)))
	}

	@Test("zet trainingen op datum, de nieuwste eerst")
	func opDatum() {
		let reeks: [Training] = [
			Training(id: "a", date: "2026-09-01"),
			Training(id: "b", date: "2026-09-08"),
			Training(id: "c", date: "2026-09-01"),
		]
		#expect(sortTrainings(reeks).map(\.id) == ["b", "a", "c"])
	}
}
