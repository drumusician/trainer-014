import Testing
@testable import BlaadjeKern

/** The squad exactly as it stood in the app on 4 September 2026. */
private let selectie: [Player] = [
	Player(id: "1", name: "Casper", line: .M, keeper: true),
	Player(id: "2", name: "Maher", line: .V, keeper: true),
	Player(id: "3", name: "Daan", line: .V, keeper: true),
	Player(id: "4", name: "Max", line: .A),
	Player(id: "5", name: "Kasper", line: .M, keeper: true),
	Player(id: "6", name: "Mauro", line: .M),
	Player(id: "7", name: "Yassir", line: .A),
	Player(id: "8", name: "Zenith", line: .M),
	Player(id: "9", name: "Amir", line: .M),
	Player(id: "10", name: "Mirza", line: .V),
	Player(id: "11", name: "Simon", line: .A),
	Player(id: "12", name: "Alain", line: .A),
	Player(id: "13", name: "Daanish", line: .M),
	Player(id: "14", name: "Siem", line: .M),
	Player(id: "15", name: "Jack", line: .V),
	Player(id: "16", name: "Gijs", line: .V),
]

private struct Telling: Equatable {
	var name: String
	var players: Int
	var positionsOf: Int
}

@Suite("bezetting per linie")
struct BezettingTests {
	@Test("telt spelers tegen plekken in 4-3-3")
	func tellen() {
		let b = bezetting(selectie, "4-3-3")
		#expect(b.map { Telling(name: $0.name, players: $0.players, positionsOf: $0.positionsOf) } == [
			Telling(name: "Aanval", players: 4, positionsOf: 3),
			Telling(name: "Middenveld", players: 7, positionsOf: 3),
			Telling(name: "Verdediging", players: 5, positionsOf: 4),
			Telling(name: "Keeper", players: 4, positionsOf: 1),
		])
	}

	@Test("ziet het gedrang op het middenveld, en dat 4-4-2 beter past")
	func gedrangOpHetMiddenveld() throws {
		func middenveld(_ f: String) throws -> LineCoverage {
			try #require(bezetting(selectie, f).first { $0.line == .M })
		}
		#expect(gedrang(try middenveld("4-3-3")) == true)
		#expect(gedrang(try middenveld("4-4-2")) == false)
	}

	@Test("waarschuwt als een linie niet vol te krijgen is")
	func nietVol() throws {
		let zonderVerdedigers = selectie.filter { $0.line != .V }
		let b = try #require(bezetting(zonderVerdedigers, "4-3-3").first { $0.line == .V })
		#expect(tekort(b) == true)
	}

	@Test("ziet vier keepers niet als gedrang, want keepen is een kunnen")
	func vierKeepers() throws {
		let keeper = try #require(bezetting(selectie, "4-3-3").first { $0.line == .K })
		#expect(keeper.players == 4)
		#expect(gedrang(keeper) == false)
		#expect(tekort(keeper) == false)
	}

	@Test("merkt op als er maar één kan keepen")
	func eenKeeper() {
		let een = selectie.map { p -> Player in
			var q = p
			q.keeper = p.name == "Maher"
			return q
		}
		#expect(dunneKeepersbezetting(bezetting(een, "4-3-3")) == true)
		#expect(dunneKeepersbezetting(bezetting(selectie, "4-3-3")) == false)
	}

	@Test("laat de keeper weg bij 4 tegen 4")
	func zonderKeeper() {
		#expect(bezetting(selectie, "2-2").map(\.line) == [.A, .V])
	}
}

@Suite("iemand die alleen keeper is")
struct AlleenKeeperTests {
	let alleenKeeper = Player(id: "99", name: "Vaste keeper", line: .geen, keeper: true)
	var metVaste: [Player] { selectie + [alleenKeeper] }

	@Test("telt alleen mee bij de keepers, niet in een veldlinie")
	func alleenBijDeKeepers() throws {
		let b = bezetting(metVaste, "4-3-3")
		#expect(try #require(b.first { $0.line == .K }).players == 5)
		#expect(try #require(b.first { $0.line == .V }).players == 5) /* onveranderd */
		#expect(try #require(b.first { $0.line == .M }).players == 7)
		#expect(try #require(b.first { $0.line == .A }).players == 4)
	}

	@Test("staat op de bank in het keepersgroepje")
	func keepersgroepje() {
		#expect(groupOf(alleenKeeper) == .K)
	}

	@Test("licht op bij de keeperplek en niet bij een veldplek")
	func keeperplek() {
		#expect(canKeep(alleenKeeper) == true)
		#expect(alleenKeeper.line == .geen) /* so no field line claims him */
	}

	@Test("valt zonder K-vinkje in \"zonder linie\", niet stilletjes ergens anders")
	func zonderLinie() {
		#expect(groupOf(Player(id: "x", name: "Nieuw", line: .geen)) == .geen)
	}
}
