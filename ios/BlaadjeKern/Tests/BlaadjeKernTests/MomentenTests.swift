import Testing
@testable import BlaadjeKern

/*
 * Terugkijken na een wedstrijd die iemand anders deed. De wissels staan er wel,
 * maar wie er begon niet — en dat is juist wat je als eerste wilt zien.
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

/* Eindigt met Mees op SP en Isa op CM; Gijs en Cas gingen eruit. */
private let WEDSTRIJD = ArchivedMatch(
	date: "2026-09-13",
	opponent: "Buitenboys",
	home: true,
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

@Suite("de opstelling terugkijken")
struct OpstellingTerugkijkenTests {
	@Test("rekent terug wie er begon, ook al is alleen het eind bewaard")
	func wieBegon() {
		let momenten = momentenVan(WEDSTRIJD, SPELERS)
		#expect(momenten[0].t == 0)
		#expect(momenten[0].lineup.dictionary == ["K": "k1", "LV": "v1", "RV": "v2", "CM": "m1", "SP": "a1"])
	}

	@Test("zet wie niet begon op de bank, en laat wie is afgemeld weg")
	func opDeBank() {
		let momenten = momentenVan(WEDSTRIJD, SPELERS)
		#expect(momenten[0].bench.sorted() == ["b1", "b2"])
		/* Siem was afgemeld: die stond niet op de bank */
		#expect(!momenten[0].bench.contains("w1"))
	}

	/* In de rust gaan er vier tegelijk; dan wil je niet vier keer tikken. */
	@Test("maakt van wissels op dezelfde seconde één moment")
	func zelfdeSeconde() {
		let momenten = momentenVan(WEDSTRIJD, SPELERS)
		#expect(momenten.map(\.t) == [0, 1200, 1800])
	}

	@Test("laat per moment zien hoe de opstelling er dan bij staat")
	func perMoment() {
		let momenten = momentenVan(WEDSTRIJD, SPELERS)
		#expect(momenten[1].lineup.dictionary == ["K": "k1", "LV": "v1", "RV": "v2", "CM": "b2", "SP": "b1"])
		#expect(momenten[2].lineup.dictionary.mapValues(Optional.some) == WEDSTRIJD.lineup!.dictionary)
	}

	@Test("benoemt elk moment met de woorden uit het verloop")
	func woorden() {
		let momenten = momentenVan(WEDSTRIJD, SPELERS)
		#expect(momenten[0].tekst == "Aftrap")
		#expect(momenten[1].tekst.contains("Mees"))
		#expect(momenten[1].tekst.contains("Luuk"))
		#expect(momenten[2].tekst.contains("Cas"))
	}

	/*
	 * Bij een wissel blijft de pion staan en verandert alleen de naam erin. Zonder
	 * aanwijzing zie je dan niet waar het gebeurde — vandaar dat elk moment zegt
	 * welke plekken veranderden.
	 */
	@Test("wijst aan welke plekken op dit moment veranderden")
	func veranderd() {
		let momenten = momentenVan(WEDSTRIJD, SPELERS)
		/* bij de aftrap is er nog niets veranderd */
		#expect(momenten[0].veranderd == [])
		/* twee wissels tegelijk: twee plekken */
		#expect(momenten[1].veranderd.sorted() == ["CM", "SP"])
		#expect(momenten[2].veranderd == ["LV"])
	}

	@Test("wijst bij een ruil allebei de plekken aan")
	func ruil() {
		var metRuil = WEDSTRIJD
		metRuil.events = [
			MatchEvent(type: .start, t: 0),
			MatchEvent(type: .swap, t: 900, positionA: "LV", positionB: "SP", playerA: "v1", playerB: "a1"),
		]
		metRuil.lineup = ["K": "k1", "LV": "a1", "RV": "v2", "CM": "m1", "SP": "v1"]
		let momenten = momentenVan(metRuil, SPELERS)
		#expect(momenten[1].veranderd.sorted() == ["LV", "SP"])
	}

	/*
	 * Wedstrijden van voordat de eindopstelling meeging zijn niet terug te rekenen.
	 * Dan hoort er niets te staan, want iets verzinnen is erger dan niets tonen.
	 */
	@Test("geeft niets terug als de eindopstelling niet bewaard is")
	func nietBewaard() {
		var zonder = WEDSTRIJD
		zonder.lineup = nil
		#expect(momentenVan(zonder, SPELERS) == [])
		zonder.lineup = [:]
		#expect(momentenVan(zonder, SPELERS) == [])
	}
}
