import Foundation
import Testing
@testable import BlaadjeKern

/**
 * Can the app read what was stored in September 2026?
 *
 * This file is a real export of a real season, with invented names in it. The
 * structure is untouched, because that is what matters.
 *
 * Why this exists: while renaming to English, "verstreken" turned out to be both
 * a function name and a stored field name. I renamed both, and the app read
 * w.elapsed while storage held verstreken. The clock showed NaN:NaN. All 172
 * tests stayed green, because a test builds its own objects and never reads real
 * storage. This test closes that gap.
 *
 * Change the storage format and you change what sits on someone else's device.
 * A migration belongs with that change, and this test stays green.
 */
private func zetKlaar() throws -> AppState {
	try #require(try Opslag.lees(opgeslagenTekst()))
}

@Suite("opslag van september 2026")
struct OpslagSeptemberTests {
	@Test("leest de selectie, het archief en de trainingen")
	func leest() throws {
		let toestand = try zetKlaar()
		#expect(toestand.players.count == 16)
		#expect(toestand.archive.count == 1)
		#expect(toestand.teamName == "JO13-1")
	}

	@Test("rekent de bewaarde wedstrijd na uit zijn eigen gegevens")
	func rekentNa() throws {
		let toestand = try zetKlaar()
		let a = toestand.archive[0]
		let w = Match(herbouwdUit: a)

		let tijden = playingTimes(w, toestand.players, nu: NU)
		/* Eleven players on the pitch, every second of the match. */
		#expect(jsRound(som(tijden)) == 11 * a.duration)

		/* And exactly one keeper at every moment, not a second doubled or empty. */
		let keepers = keeperTimes(w, nu: NU)
		#expect(jsRound(som(keepers)) == a.duration)
	}

	@Test("geeft dezelfde speeltijd als toen hij bewaard werd")
	func zelfdeSpeeltijd() throws {
		let toestand = try zetKlaar()
		let a = toestand.archive[0]
		let tijden = playingTimes(Match(herbouwdUit: a), toestand.players, nu: NU)
		#expect(a.playingTime.count == 16)
		for regel in a.playingTime {
			let id = try #require(regel.id)
			#expect(jsRound(try #require(tijden[id])) == regel.seconds, "\(regel.name)")
		}
	}

	/* Dit is de test die NaN:NaN gevangen zou hebben. */
	@Test("leest de klok van een wedstrijd die nog loopt")
	func lopendeKlok() throws {
		var met = try #require(try opgeslagen().objectValue)
		met["match"] = try JSONValue.parse(
			"""
			{
				"date": "2026-09-06",
				"opponent": "Testclub",
				"home": true,
				"formation": "4-4-2 ruit",
				"lineup": {},
				"bench": [],
				"events": [{ "type": "start", "t": 0 }],
				"elapsed": 1234,
				"since": null,
				"running": false,
				"parts": 2,
				"part": 1,
				"inBreak": false,
				"finished": false,
				"absent": []
			}
			"""
		)
		let toestand = try #require(try Opslag.lees(JSONValue.object(met).tekst()))
		let w = try #require(toestand.match)
		#expect(elapsed(w, nu: NU).isFinite)
		#expect(elapsed(w, nu: NU) == 1234)
	}
}

@Suite("oude gegevens die van buiten binnenkomen")
struct OudeGegevensVanBuitenTests {
	/* Three ways in, and all three can deliver something from before the
	   translation: a backup file someone saved, a transfer code from a device that
	   has not been updated, and the server. */
	@Test("leest een back-upbestand van voor de vertaalslag")
	func backupbestand() throws {
		let bestand = #"{"blaadje":1,"gemaakt":"2026-09-06T10:00:00.000Z","toestand":"# + (try opgeslagenTekst()) + "}"
		let terug = try readBackup(bestand)
		#expect(terug.players?.count == 16)
		#expect(terug.teamName == "JO13-1")
		#expect(terug.archive?.count == 1)
		#expect((terug.archive?[0].duration ?? 0) > 0)
	}

	@Test("leest een overzetcode van voor de vertaalslag")
	func overzetcode() throws {
		let pakket = try readTransferCode(try opgeslagenTekst())
		#expect(pakket.players?.count == 16)
		#expect(pakket.teamName == "JO13-1")
	}

	@Test("neemt een syncpakket van voor de vertaalslag over")
	func syncpakket() throws {
		var toestand = emptyState()
		let gelukt = StoreActions.adoptSyncPayload(&toestand, try opgeslagen())
		#expect(gelukt == true)
		#expect(toestand.players.count == 16)
		#expect(toestand.teamName == "JO13-1")
		#expect(toestand.archive.count == 1)
	}

	@Test("schrijft na het lezen het nieuwe formaat terug")
	func nieuwFormaat() throws {
		let opnieuw = try #require(try JSONValue.parse(Opslag.schrijf(try zetKlaar())).objectValue)
		#expect(opnieuw.contains("teamName"))
		#expect(!opnieuw.contains("teamnaam"))
		#expect(opnieuw["archive"]?.arrayValue?.first?["duration"] != nil)
	}
}

@Suite("opslag die we niet kunnen lezen")
struct OnleesbareOpslagTests {
	/*
	 * Dit is de gevaarlijkste weg die er is, en hij is niet theoretisch: een
	 * toestel dat nog oudere code draait leest de omgezette opslag niet, start
	 * leeg, en schrijft die lege staat bij de eerste tik over het seizoen heen.
	 * Onleesbaar mag nooit betekenen: overschrijven.
	 *
	 * In de webapp zet de store het origineel apart en meldt hij het. Dat stuk
	 * hoort hier bij de app; wat dit pakket moet doen is het verschil laten zien
	 * tussen 'niets opgeslagen', 'een vorm die ik niet ken' en 'niet te lezen'.
	 */
	@Test("gooit een seizoen niet weg als het formaat onbekend is")
	func onbekendFormaat() throws {
		#expect(try Opslag.lees(#"{"eenNieuwerFormaat":true,"spullen":[1,2,3]}"#) == nil)
	}

	/* Without this, unreadable storage looks like losing everything, unexplained. */
	@Test("zet onleesbare gegevens apart in plaats van ze te laten vallen")
	func onleesbaar() {
		#expect(throws: (any Error).self) { try Opslag.lees(#"{"spelers":[ dit is geen json"#) }
	}
}
