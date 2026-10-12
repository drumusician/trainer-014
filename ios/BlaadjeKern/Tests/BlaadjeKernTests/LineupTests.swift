import Testing
@testable import BlaadjeKern

private let names = ["Gijs", "Jack", "Maher", "Daan", "Mirza", "Siem", "Kasper", "Daanish", "Mauro", "Max", "Simon", "Amir"]
private let players: [Player] = names.enumerated().map { Player(id: "p\($0.offset)", name: $0.element, line: .geen) }
private let lineup: Lineup = [
	"K": "p0",
	"RV": "p1",
	"CVr": "p2",
	"CVl": "p3",
	"LV": "p4",
	"MR": "p5",
	"MC": "p6",
	"ML": "p7",
	"RB": "p8",
	"SP": "p9",
	"LB": "p10",
]

@Suite("opstelling als tekst")
struct OpstellingTekstTests {
	@Test("zet elke linie op een eigen regel, keeper zonder plekcode")
	func perLinie() {
		let tekst = opstellingTekst("4-3-3", lineup, ["p11"], players)
		#expect(tekst.split(separator: "\n").map(String.init) == [
			"Opstelling 4-3-3",
			"Keeper: Gijs",
			"Verdediging: Jack (RV), Maher (CV), Daan (CV), Mirza (LV)",
			"Middenveld: Siem (M), Kasper (M), Daanish (M)",
			"Aanval: Mauro (RB), Max (SP), Simon (LB)",
			"Bank: Amir",
		])
	}

	@Test("laat lege plekken en een lege bank gewoon weg")
	func legePlekken() {
		let tekst = opstellingTekst("4-3-3", ["K": "p0"], [], players)
		#expect(tekst == "Opstelling 4-3-3\nKeeper: Gijs")
	}
}

/** De opstelling zoals hij in 4-3-3 stond. */
private let vier33: Lineup = [
	"K": "keeper",
	"RV": "jack",
	"CVr": "kasper",
	"CVl": "mirza",
	"LV": "daan",
	"MR": "daanish",
	"MC": "amir",
	"ML": "mauro",
	"RB": "simon",
	"SP": "max",
	"LB": "siem",
]

@Suite("van formatie wisselen")
struct VanFormatieWisselenTests {
	@Test("houdt keeper en verdediging staan bij 4-3-3 naar 4-4-2")
	func keeperEnVerdediging() {
		let uit = convertLineup(vier33, "4-3-3", "4-4-2")
		#expect(uit.lineup["K"] == "keeper")
		#expect(uit.lineup["RV"] == "jack")
		#expect(uit.lineup["CVr"] == "kasper")
		#expect(uit.lineup["CVl"] == "mirza")
		#expect(uit.lineup["LV"] == "daan")
	}

	@Test("schuift de drie middenvelders door en laat de vierde plek leeg")
	func middenvelders() {
		let uit = convertLineup(vier33, "4-3-3", "4-4-2")
		let middenveld = ["MR", "MCr", "MCl", "ML"].compactMap { uit.lineup[$0] }
		/* There are only three. The coach fills the empty position himself; quietly
		   dropping a forward in there would make that choice for him. */
		#expect(middenveld.count == 3)
	}

	@Test("zet de aanvaller die niet meer past op de bank")
	func aanvaller() {
		let uit = convertLineup(vier33, "4-3-3", "4-4-2")
		#expect(["SPr", "SPl"].compactMap { uit.lineup[$0] }.count == 2)
		#expect(uit.afgevallen.count == 1)
		#expect(uit.lineup.opHetVeld.count == 10)
	}

	@Test("past precies bij de ruit, want die heeft ook vier middenveldplekken")
	func ruit() {
		let uit = convertLineup(vier33, "4-3-3", "4-4-2 diamond")
		#expect(uit.lineup.opHetVeld.count == 10)
		#expect(uit.bench.count == 1)
	}

	@Test("laat niemand verdwijnen bij 11 tegen 11 naar 8 tegen 8")
	func niemandVerdwijnt() {
		let uit = convertLineup(vier33, "4-3-3", "1-3-3-1", [])
		let inVeld = uit.lineup.opHetVeld
		#expect(inVeld.count == 8)
		#expect(inVeld.count + uit.bench.count == 11)
	}

	@Test("houdt de bestaande bank in stand")
	func bestaandeBank() {
		let uit = convertLineup(vier33, "4-3-3", "4-4-2", ["alain", "zenith"])
		#expect(uit.bench.contains("alain"))
		#expect(uit.bench.contains("zenith"))
	}
}
