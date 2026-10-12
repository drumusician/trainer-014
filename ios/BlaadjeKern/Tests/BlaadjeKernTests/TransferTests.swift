import Foundation
import Testing
@testable import BlaadjeKern

private func volleToestand() -> AppState {
	var t = emptyState()
	t.players = [
		Player(id: "p1", name: "Daanish", line: .M),
		Player(id: "p2", name: "Zoë", line: .geen, keeper: true),
	]
	t.trainings = [Training(id: "t1", date: "2026-09-02", status: ["p1": .present, "p2": .absent])]
	t.archive = [
		ArchivedMatch(
			date: "2026-08-30",
			opponent: "Ajax",
			home: true,
			score: [1, 0],
			formation: "4-3-3",
			duration: 4200,
			events: [],
			playingTime: [PlayingTimeRow(id: "p1", name: "Daanish", seconds: 4200)]
		)
	]
	t.defaultLineup = DefaultLineup(formation: "4-3-3", lineup: ["K": "p2"], bench: ["p1"])
	t.match = Match(
		date: "2026-09-06",
		opponent: "Sparta",
		home: true,
		formation: "4-3-3",
		lineup: [:],
		bench: [],
		events: [],
		elapsed: 100,
		since: nil,
		running: true,
		parts: 2,
		part: 1,
		inBreak: false,
		finished: false
	)
	return t
}

private func btoa(_ tekst: String) -> String {
	Data(tekst.utf8).base64EncodedString()
}

@Suite("overzetten")
struct OverzettenTests {
	@Test("neemt alles mee behalve de wedstrijd die loopt")
	func allesBehalveDeWedstrijd() throws {
		let code = makeTransferCode(volleToestand())
		let p = try readTransferCode(code)
		#expect(p.players?.count == 2)
		#expect(p.trainings?.count == 1)
		#expect(p.archive?.count == 1)
		#expect(p.defaultLineup == .some(volleToestand().defaultLineup))
		let bytes = try #require(Data(base64Encoded: code))
		let inCode = try #require(JSONValue.parse(String(decoding: bytes, as: UTF8.self)).objectValue)
		#expect(!inCode.contains("wedstrijd"))
		#expect(!inCode.contains("match"))
		#expect(inCode["v"] == .number(2))
	}

	@Test("overleeft accenten in namen")
	func accenten() throws {
		#expect(try readTransferCode(makeTransferCode(volleToestand())).players?[1].name == "Zoë")
	}

	@Test("slikt ook een back-up, die is immers hetzelfde")
	func backup() throws {
		let backup = #"{"blaadje":1,"toestand":{"players":[{"id":"p1","name":"Aad","line":"V"}]}}"#
		#expect(try readTransferCode(backup).players?[0].name == "Aad")
	}

	@Test("laat weg wat er niet in staat, in plaats van het te wissen")
	func laatWeg() throws {
		let oud = btoa(#"{"v":1,"players":[{"id":"p1","name":"Aad","line":"V"}],"formation":"4-4-2"}"#)
		let p = try readTransferCode(oud)
		#expect(p.trainings == nil)
		#expect(p.archive == nil)
		#expect(p.v == 1)
	}

	@Test("vertelt wat erin zit")
	func watErinZit() throws {
		#expect(
			describePackage(try readTransferCode(makeTransferCode(volleToestand())))
				== "2 spelers, 1 wedstrijd, 1 training, een standaardopstelling"
		)
	}

	@Test("klaagt over een code zonder selectie")
	func zonderSelectie() {
		#expect(throws: (any Error).self) { try readTransferCode("geen geldige code") }
		#expect(throws: BlaadjeFout.geenSelectie) { try readTransferCode(btoa(#"{"v":2,"players":[]}"#)) }
	}

	/* Toegevoegd bij de overzetting naar Swift: een code die je overtypt of uit een
	   bericht plakt komt met regeleinden en zonder de = aan het eind. De browser
	   slikt dat, dus hier ook. */
	@Test("leest een code met regeleinden erin en zonder opvulling")
	func slordigeCode() throws {
		let code = makeTransferCode(volleToestand())
		let kaal = code.replacingOccurrences(of: "=", with: "")
		let gebroken = String(kaal.prefix(40)) + "\n" + String(kaal.dropFirst(40)) + "  \n"
		#expect(try readTransferCode(gebroken).players?.count == 2)
	}
}
