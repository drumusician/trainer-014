import Testing
@testable import BlaadjeKern

private let players: [Player] = [
	Player(id: "p1", name: "Aad", line: .A),
	Player(id: "p2", name: "Bram", line: .M),
]
private let bron = ReportSource(
	date: "2026-09-06",
	opponent: "Ajax",
	home: true,
	score: [2, 1],
	formation: "4-3-3",
	duration: 4200,
	events: [
		MatchEvent(type: .substitution, t: 1200, off: "p1", on: "p2", position: "SP"),
		MatchEvent(type: .goal, t: 900, player: "p1"),
		MatchEvent(type: .conceded, t: 1800),
		MatchEvent(type: .goal, t: 3000, player: nil),
	],
	teamName: "JO11-2"
)

private func regels(_ tekst: String) -> [String] {
	tekst.split(separator: "\n", omittingEmptySubsequences: false).map(String.init)
}

@Suite("verslag")
struct VerslagTests {
	@Test("laat de wissels weg en zet de stand op volgorde van de klok")
	func zonderWissels() {
		let tekst = reportText(bron, players)
		#expect(tekst.contains("JO11-2 – Ajax 2–1"))
		#expect(!tekst.contains("voor"))
		#expect(Array(regels(tekst).dropFirst(3)) == ["15′  1–0  Aad", "30′  1–1  tegendoelpunt", "50′  2–1  doelpunt"])
	}

	@Test("zet de wissels erbij als je dat wilt")
	func metWissels() throws {
		let tekst = reportText(bron, players, true)
		#expect(tekst.contains("Bram voor Aad"))
		let kwartier = try #require(tekst.range(of: "15′"))
		let twintig = try #require(tekst.range(of: "20′"))
		#expect(kwartier.lowerBound < twintig.lowerBound)
	}

	@Test("draait de stand om bij een uitwedstrijd")
	func uit() {
		var uit = bron
		uit.home = false
		#expect(reportText(uit, players).contains("Ajax – JO11-2 1–2"))
	}

	@Test("zet ook de tussenstanden met de thuisploeg voorop")
	func tussenstanden() {
		var uit = bron
		uit.home = false
		let tekst = reportText(uit, players)
		#expect(Array(regels(tekst).dropFirst(3)) == ["15′  0–1  Aad", "30′  1–1  tegendoelpunt", "50′  1–2  doelpunt"])
	}

	@Test("valt terug op een neutrale naam als er geen teamnaam is")
	func neutraleNaam() {
		var zonder = bron
		zonder.teamName = nil
		#expect(reportText(zonder, players).contains("Ons team – Ajax"))
		zonder.teamName = "  "
		#expect(reportText(zonder, players).contains("Ons team – Ajax"))
	}

	/* Toegevoegd bij de overzetting naar Swift: de kop van het verslag hangt in de
	   webapp van de browser af, hier staat hij vast. */
	@Test("zet de dag eronder, en zegt het als er niet gescoord is")
	func kop() {
		var leeg = bron
		leeg.events = []
		leeg.score = [0, 0]
		#expect(regels(reportText(leeg, players)) == ["JO11-2 – Ajax 0–0", "zondag 6 september", "", "Geen doelpunten."])
	}
}

@Suite("kwarten en een notitie")
struct KwartenEnNotitieTests {
	@Test("benoemt de pauzes naar het deel")
	func pauzes() {
		var g = MatchEvent(type: .break, t: 900, part: 1)
		#expect(eventText(g, players, nil, 4) == "Pauze — 1e kwart voorbij")
		g.part = 2
		#expect(eventText(g, players, nil, 4) == "Rust — 2e kwart voorbij")
		g.part = 1
		#expect(eventText(g, players, nil, 2) == "Rust — 1e helft voorbij")
	}

	@Test("zet de notitie onderaan het verslag")
	func notitie() {
		var met = bron
		met.note = "  Sterk begin.  "
		#expect(reportText(met, players).hasSuffix("\n\nSterk begin."))
	}

	@Test("laat het verslag met rust als er niets geschreven is")
	func nietsGeschreven() {
		var met = bron
		met.note = "   "
		#expect(reportText(met, players).hasSuffix("doelpunt"))
	}
}

@Suite("van plek ruilen in het verloop")
struct RuilenInVerloopTests {
	/* Where they went says more than that something swapped. */
	@Test("noemt wie waar naartoe ging")
	func wieWaarheen() {
		let g = MatchEvent(type: .swap, t: 800, positionA: "K", positionB: "SP", playerA: "p1", playerB: "p2")
		#expect(eventText(g, players, nil, 2, "4-3-3") == "Aad naar SP, Bram naar K")
	}

	@Test("gebruikt de leesbare naam van de plek")
	func leesbareNaam() {
		let g = MatchEvent(type: .swap, t: 800, positionA: "CVl", positionB: "TEN", playerA: "p1", playerB: "p2")
		#expect(eventText(g, players, nil, 2, "4-4-2 diamond") == "Aad naar 10, Bram naar CV")
	}

	@Test("houdt oude wedstrijden zonder namen leesbaar")
	func zonderNamen() {
		let g = MatchEvent(type: .swap, t: 800, positionA: "K", positionB: "SP")
		#expect(eventText(g, players, nil, 2, "4-3-3") == "Van plek gewisseld: K en SP")
	}
}

@Suite("een wissel in het verloop")
struct WisselInVerloopTests {
	@Test("zegt er ook bij op welke plek")
	func opWelkePlek() {
		let g = MatchEvent(type: .substitution, t: 800, off: "p1", on: "p2", position: "TEN")
		#expect(eventText(g, players, nil, 2, "4-4-2 diamond") == "Bram voor Aad op 10")
	}
}

@Suite("ruilen op hetzelfde moment samenvatten")
struct RuilenSamenvattenTests {
	/* A rotation of four cannot be done in fewer than three pairwise swaps. Without
	   collapsing them, someone appears to move twice in the same second. */
	@Test("maakt van een rondje van vier één regel met de netto verhuizing")
	func rondjeVanVier() {
		let vier: [Player] = [
			Player(id: "a", name: "Maher", line: .geen),
			Player(id: "b", name: "Kasper", line: .geen),
			Player(id: "c", name: "Jack", line: .geen),
			Player(id: "d", name: "Zenith", line: .geen),
		]
		/* voor: K=Maher, VM=Kasper, CVr=Jack, RV=Zenith */
		let g: [MatchEvent] = [
			MatchEvent(type: .swap, t: 2110, positionA: "K", positionB: "VM", playerA: "a", playerB: "b"),
			MatchEvent(type: .swap, t: 2110, positionA: "CVr", positionB: "RV", playerA: "c", playerB: "d"),
			MatchEvent(type: .swap, t: 2110, positionA: "VM", positionB: "CVr", playerA: "a", playerB: "d"),
		]
		let rijen = timelineRows(g, vier, nil, 2, "4-4-2 diamond")
		#expect(rijen.count == 1)
		#expect(rijen[0].tekst == "Maher naar CV, Kasper naar K, Jack naar RV, Zenith naar VM")
	}

	@Test("laat ruilen op verschillende tijdstippen apart staan")
	func apart() {
		let g: [MatchEvent] = [
			MatchEvent(type: .swap, t: 100, positionA: "K", positionB: "SP", playerA: "p1", playerB: "p2"),
			MatchEvent(type: .swap, t: 200, positionA: "K", positionB: "SP", playerA: "p2", playerB: "p1"),
		]
		#expect(timelineRows(g, players, nil, 2, "4-3-3").count == 2)
	}

	@Test("houdt de plek in de lijst kloppend, zodat een doelpunt te wissen blijft")
	func plekInDeLijst() {
		let g: [MatchEvent] = [
			MatchEvent(type: .swap, t: 100, positionA: "K", positionB: "SP", playerA: "p1", playerB: "p2"),
			MatchEvent(type: .swap, t: 100, positionA: "SP", positionB: "K", playerA: "p1", playerB: "p2"),
			MatchEvent(type: .goal, t: 300, player: "p1"),
		]
		let rijen = timelineRows(g, players, nil, 2, "4-3-3")
		let goal = rijen.first { $0.type == .goal }
		#expect(goal?.index == 2)
	}
}
