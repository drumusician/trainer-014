import Foundation
import Testing
@testable import BlaadjeKern

/*
 * Niet uit de webapp: daar is JSON gewoon wat de taal doet. Hier moet het
 * bewezen worden, want de eigenaar van de app zet zijn seizoen over met een
 * back-up uit de webapp, en wat hier bewaard wordt moet daar weer open kunnen.
 */

/**
 * Een toestand zoals de webapp hem vandaag opslaat, letterlijk als tekst: de
 * veldvolgorde, de `null`-en en de velden die er soms niet zijn.
 *
 * Opgebouwd uit wat de tests van de webapp gebruiken (backup.test.ts,
 * transfer.test.ts, de wedstrijd uit bench.test.ts) met een lopende wedstrijd
 * erbij waar alles in voorkomt: een plan, een doelpunt zonder maker, een ruil met
 * een lege plek, een assist, een notitie.
 */
private let WEBAPP = """
{"teamName":"JO13-1","players":[{"id":"k1","name":"Bram","line":"","keeper":true},{"id":"v1","name":"Cas","line":"V"},{"id":"v2","name":"Dirk","line":"V","keeper":false},{"id":"m1","name":"Gijs","line":"M"},{"id":"a1","name":"Luuk","line":"A"},{"id":"b1","name":"Mees","line":"A"},{"id":"b2","name":"Zoë","line":"M"},{"id":"w1","name":"Siem","line":"M"}],"formation":"1-2-2-1","minutesPerPart":12.5,"parts":4,"match":{"date":"2026-09-20","opponent":"De \\"nummer\\" 1","home":false,"formation":"1-2-2-1","lineup":{"K":"k1","LV":"v1","RV":"v2","ML":"m1","MR":null,"SP":"b1"},"bench":["b2","a1"],"events":[{"type":"start","t":0},{"type":"goal","t":300,"player":"a1","assist":"m1"},{"type":"goal","t":420,"player":null},{"type":"conceded","t":500},{"type":"break","t":750,"part":1},{"type":"substitution","t":750,"off":"a1","on":"b1","position":"SP"},{"type":"swap","t":760,"positionA":"ML","positionB":"MR","playerA":null,"playerB":"m1"}],"elapsed":812.337,"since":1790000000000,"running":true,"parts":4,"part":2,"inBreak":false,"finished":false,"absent":["w1"],"note":"Sterk begin.\\nDaarna zakte het in.","keptBy":"tjaco@voorbeeld.nl","plan":[{"id":"wmf2k3a1b2c","minuut":25,"on":"a1","off":"b1"},{"id":"wmf2k3a9z8y","minuut":25,"on":"m1","off":"k1","naDeel":2,"soort":"ruil","skipped":true}]},"defaultLineup":{"formation":"1-2-2-1","lineup":{"K":"k1","LV":"v1","RV":"v2","ML":"m1","MR":"b2","SP":"a1"},"bench":["b1","w1"]},"archive":[{"date":"2026-09-13","opponent":"Buitenboys","home":false,"score":[1,0],"formation":"1-2-2-1","duration":2400,"parts":2,"note":"Koud.","teamName":"JO13-1","events":[{"type":"start","t":0},{"type":"goal","t":600,"player":"a1"},{"type":"substitution","t":1200,"off":"a1","on":"b1","position":"SP"},{"type":"swap","t":1500,"positionA":"ML","positionB":"MR"},{"type":"end","t":2400}],"names":{"k1":"Bram","v1":"Cas","v2":"Dirk","m1":"Gijs","a1":"Luuk","b1":"Mees","b2":"Zoë","w1":"Siem"},"absent":["w1"],"lineup":{"K":"k1","LV":"v1","RV":"v2","ML":"b2","MR":"m1","SP":"b1"},"bench":["a1"],"playingTime":[{"id":"k1","name":"Bram","seconds":2400,"keeper":2400,"positions":{"K":2400}},{"id":"v1","name":"Cas","seconds":2400,"keeper":0,"positions":{"LV":2400}},{"id":"m1","name":"Gijs","seconds":2400,"keeper":0,"positions":{"ML":1500,"MR":900}},{"id":"w1","name":"Siem","seconds":0,"keeper":0,"positions":{}}]},{"date":"2026-08-30","opponent":"Ajax","home":true,"score":[2,1],"formation":"4-3-3","duration":4200,"events":[],"playingTime":[{"id":"p1","name":"Daanish","seconds":4200,"keeper":0},{"name":"Oud","seconds":4200}]}],"trainings":[{"id":"t1","date":"2026-09-02","status":{"k1":"present","v1":"absent","v2":"excused"}}],"reportSubs":true}
"""

@Suite("wat de webapp opslaat, lezen en schrijven")
struct WebappOpslagTests {
	@Test("leest elk veld van een toestand uit de webapp")
	func leest() throws {
		let t = try AppState(jsonTekst: WEBAPP)
		#expect(t.teamName == "JO13-1")
		#expect(t.players.count == 8)
		#expect(t.players[0] == Player(id: "k1", name: "Bram", line: .geen, keeper: true))
		#expect(t.players[1].keeper == nil)
		#expect(t.players[2].keeper == false)
		#expect(t.minutesPerPart == 12.5)
		#expect(t.parts == 4)
		#expect(t.reportSubs == true)

		let w = try #require(t.match)
		#expect(w.opponent == "De \"nummer\" 1")
		#expect(w.lineup.positions == ["K", "LV", "RV", "ML", "MR", "SP"])
		#expect(w.lineup.has("MR"))
		#expect(w.lineup["MR"] == nil)
		#expect(w.elapsed == 812.337)
		#expect(w.since == 1_790_000_000_000)
		#expect(w.note == "Sterk begin.\nDaarna zakte het in.")
		#expect(w.events[1] == MatchEvent(type: .goal, t: 300, player: "a1", assist: "m1"))
		#expect(w.events[2] == MatchEvent(type: .goal, t: 420))
		#expect(w.events[4] == MatchEvent(type: .break, t: 750, part: 1))
		#expect(w.events[6] == MatchEvent(type: .swap, t: 760, positionA: "ML", positionB: "MR", playerB: "m1"))
		#expect(w.plan?[1] == PlannedSub(id: "wmf2k3a9z8y", minuut: 25, on: "m1", off: "k1", naDeel: 2, soort: .ruil, skipped: true))
		#expect(w.archived == nil)

		let a = t.archive[0]
		#expect(a.score == [1, 0])
		#expect(a.names?["b2"] == "Zoë")
		#expect(a.playingTime[2].positions?.keys == ["ML", "MR"])
		#expect(a.playingTime[3].positions?.isEmpty == true)
		#expect(t.archive[1].lineup == nil)
		#expect(t.archive[1].playingTime[1].id == nil)
		#expect(t.archive[1].playingTime[1].keeper == nil)
		#expect(t.trainings[0].status.keys == ["k1", "v1", "v2"])
		#expect(t.trainings[0].status["v2"] == .excused)
	}

	/* Hetzelfde erin als eruit, tot op de letter: dezelfde velden in dezelfde
	   volgorde, wat ontbrak blijft weg, null blijft null. */
	@Test("schrijft precies dezelfde tekst terug")
	func zelfdeTekst() throws {
		let t = try AppState(jsonTekst: WEBAPP)
		#expect(Opslag.schrijf(t) == WEBAPP)
	}

	@Test("leest hem ook als opslag, zonder er iets aan te veranderen")
	func alsOpslag() throws {
		let t = try #require(try Opslag.lees(WEBAPP))
		#expect(t == (try AppState(jsonTekst: WEBAPP)))
	}

	@Test("gaat heen en terug door JSONEncoder en JSONDecoder")
	func codable() throws {
		let t = try AppState(jsonTekst: WEBAPP)
		let data = try JSONEncoder().encode(t)
		let tekst = String(decoding: data, as: UTF8.self)
		#expect(tekst.contains(#""score":[1,0]"#))
		#expect(tekst.contains(#""duration":2400"#))
		#expect(tekst.contains(#""elapsed":812.337"#))
		/* Wat JSONEncoder schrijft is dezelfde JSON, op de volgorde van de velden na. */
		#expect(try JSONValue.parse(tekst) == (try JSONValue.parse(WEBAPP)))

		let terug = try JSONDecoder().decode(AppState.self, from: data)
		#expect(terug.json == t.json)
		/* JSONDecoder geeft de plekken van een opstelling in willekeurige volgorde;
		   de inhoud is gelijk. Wie de volgorde nodig heeft leest met jsonTekst. */
		#expect(terug.match?.lineup.dictionary == t.match?.lineup.dictionary)
		#expect(terug.players == t.players)
		#expect(terug.trainings.map(\.status.dictionary) == t.trainings.map(\.status.dictionary))

		let w = try JSONDecoder().decode(Match.self, from: Data(#"{"date":"2026-09-20","opponent":"X","home":true,"formation":"4-3-3","lineup":{"K":null},"bench":[],"events":[{"type":"goal","t":5,"player":null}],"elapsed":0,"since":null,"running":false,"parts":2,"part":1,"inBreak":false,"finished":false}"#.utf8))
		#expect(w.lineup.has("K"))
		#expect(w.events == [MatchEvent(type: .goal, t: 5)])
	}

	@Test("laat velden die er niet zijn ook weg bij het schrijven")
	func velden() {
		#expect(Player(id: "p1", name: "Aad", line: .V).jsonTekst() == #"{"id":"p1","name":"Aad","line":"V"}"#)
		#expect(Player(id: "p1", name: "Aad", line: .geen, keeper: false).jsonTekst() == #"{"id":"p1","name":"Aad","line":"","keeper":false}"#)
		#expect(MatchEvent(type: .conceded, t: 1800).jsonTekst() == #"{"type":"conceded","t":1800}"#)
		#expect(MatchEvent(type: .goal, t: 900).jsonTekst() == #"{"type":"goal","t":900,"player":null}"#)
		#expect(
			MatchEvent(type: .substitution, t: 1200, off: "p1", on: "p2", position: "SP").jsonTekst()
				== #"{"type":"substitution","t":1200,"off":"p1","on":"p2","position":"SP"}"#
		)
		#expect(
			MatchEvent(type: .swap, t: 5, positionA: "K", positionB: "SP", playerA: "p1").jsonTekst()
				== #"{"type":"swap","t":5,"positionA":"K","positionB":"SP","playerA":"p1","playerB":null}"#
		)
		#expect(PlannedSub(id: "w1", minuut: 25, on: "a", off: "b").jsonTekst() == #"{"id":"w1","minuut":25,"on":"a","off":"b"}"#)
		#expect(emptyState().jsonTekst() == #"{"teamName":"Ons team","players":[],"formation":"4-3-3","minutesPerPart":35,"parts":2,"match":null,"defaultLineup":null,"archive":[],"trainings":[],"reportSubs":false}"#)
	}

	/* De wedstrijd zoals de webapp hem aanmaakt, veld voor veld in dezelfde volgorde. */
	@Test("maakt een nieuwe wedstrijd zoals de webapp hem opslaat")
	func nieuweWedstrijd() {
		var t = emptyState()
		t.players = [Player(id: "p1", name: "Aad", line: .V)]
		MatchActions.nieuwe(&t, opponent: "", home: true, vandaag: "2026-09-20")
		#expect(
			t.match?.jsonTekst()
				== #"{"date":"2026-09-20","opponent":"Tegenstander","home":true,"formation":"4-3-3","lineup":{},"bench":["p1"],"events":[],"elapsed":0,"since":null,"running":false,"parts":2,"part":1,"inBreak":false,"finished":false,"absent":[]}"#
		)
	}
}

@Suite("een seizoen overzetten met een back-up uit de webapp")
struct SeizoenOverzettenTests {
	/* De weg die de eigenaar gaat: in de webapp 'Bestand opslaan', hier openen. */
	@Test("zet een back-up uit de webapp terug in een lege app")
	func terugzetten() throws {
		let web = try AppState(jsonTekst: WEBAPP)
		let bestand = makeBackup(web, "2026-10-12T09:30:00.000Z")

		var hier = emptyState()
		let pakket = try readBackup(bestand)
		#expect(describePackage(pakket) == "8 spelers, 2 wedstrijden, 1 training, een standaardopstelling")
		StoreActions.adoptPackage(&hier, pakket)

		var verwacht = web
		verwacht.match = nil /* de lopende wedstrijd hoort bij het toestel */
		#expect(hier == verwacht)
		#expect(seizoenStand(hier.archive).gewonnen == 2)
	}

	@Test("schrijft dezelfde back-up terug als hij las")
	func zelfdeBackup() throws {
		let web = try AppState(jsonTekst: WEBAPP)
		let bestand = makeBackup(web, "2026-10-12T09:30:00.000Z")
		var hier = emptyState()
		StoreActions.adoptPackage(&hier, try readBackup(bestand))
		#expect(makeBackup(hier, "2026-10-12T09:30:00.000Z") == bestand)
	}

	@Test("doet hetzelfde met een overzetcode")
	func overzetcode() throws {
		let web = try AppState(jsonTekst: WEBAPP)
		var hier = emptyState()
		StoreActions.adoptPackage(&hier, try readTransferCode(makeTransferCode(web)))
		var verwacht = web
		verwacht.match = nil
		#expect(hier == verwacht)
	}

	/* En de echte: een seizoen van voor de vertaalslag, met Nederlandse veldnamen. */
	@Test("leest de opslag van september 2026 en schrijft hem terug zonder iets te verliezen")
	func september() throws {
		let ruw = try opgeslagenTekst()
		let t = try #require(try Opslag.lees(ruw))

		/* Wat eruit komt is wat erin ging, omgezet naar de nieuwe namen en
		   aangevuld met wat een lege app heeft. */
		var verwacht = try #require(emptyState().json.objectValue)
		for (k, v) in try #require(migreerToestand(try JSONValue.parse(ruw)).objectValue).entries { verwacht[k] = v }
		#expect(try JSONValue.parse(Opslag.schrijf(t)) == Opslag.migrate(.object(verwacht)))

		/* nog een keer rond verandert niets meer */
		#expect(try Opslag.lees(Opslag.schrijf(t)) == t)

		let a = t.archive[0]
		#expect(a.score == [9, 0])
		#expect(a.formation == "4-4-2 diamond")
		#expect(a.lineup?.has("TEN") == true)
		#expect(t.defaultLineup?.lineup.positions.last == "TEN")
		#expect(t.players.first?.keeper == true)
		#expect(seasonTotals(t.archive, t.players).count == 16)
		#expect(momentenVan(a, t.players).first?.lineup.count == 11)
	}

	@Test("zet de back-up van dat seizoen over naar een lege app")
	func septemberAlsBackup() throws {
		let bestand = #"{"blaadje":1,"gemaakt":"2026-09-06T10:00:00.000Z","toestand":"# + (try opgeslagenTekst()) + "}"
		var hier = emptyState()
		StoreActions.adoptPackage(&hier, try readBackup(bestand))
		let rechtstreeks = try #require(try Opslag.lees(try opgeslagenTekst()))
		#expect(hier == rechtstreeks)
	}
}

@Suite("oudere vormen lezen")
struct OudereVormenTests {
	/* Spelers met de oude linie K worden bij het laden omgezet naar keeper: true,
	   want keepen staat nu los van je veldlinie. */
	@Test("maakt van de oude linie K iemand die kan keepen")
	func linieK() throws {
		let oud = #"{"players":[{"id":"p1","name":"Gijs","line":"K"},{"id":"p2","name":"Aad","line":"V"}]}"#
		let t = try #require(try Opslag.lees(oud))
		#expect(t.players[0] == Player(id: "p1", name: "Gijs", line: .geen, keeper: true))
		#expect(t.players[1] == Player(id: "p2", name: "Aad", line: .V))
		/* ook als hij langs een back-up binnenkomt, waar de webapp pas bij de
		   volgende keer laden omzet */
		#expect(try readBackup(oud).players?[0] == Player(id: "p1", name: "Gijs", line: .geen, keeper: true))
	}

	@Test("vult aan wat een oude toestand mist")
	func vultAan() throws {
		let t = try #require(try Opslag.lees(#"{"players":[],"parts":3,"teamName":"  ","archive":"kapot"}"#))
		#expect(t.teamName == "Ons team")
		#expect(t.parts == 2)
		#expect(t.formation == "4-3-3")
		#expect(t.minutesPerPart == 35)
		#expect(t.archive == [])
		#expect(t.trainings == [])
		#expect(t.match == nil)
	}

	@Test("leest een bewaarde wedstrijd waar velden aan ontbreken")
	func kaleWedstrijd() throws {
		let a = try ArchivedMatch(jsonTekst: #"{"date":"2026-01-01"}"#)
		#expect(a.date == "2026-01-01")
		#expect(a.home == true)
		#expect(a.score == [0, 0])
		#expect(a.events == [])
		#expect(a.playingTime == [])
		#expect(seizoenStand([a]).gelijk == 1)
		#expect(momentenVan(a, []) == [])
	}

	@Test("weigert een gebeurtenis die hij niet kent, in plaats van hem stil te laten vallen")
	func onbekendeGebeurtenis() {
		#expect(throws: BlaadjeFout.onbekendeGebeurtenis("penalty")) {
			try MatchEvent(jsonTekst: #"{"type":"penalty","t":5}"#)
		}
	}
}

@Suite("JSON lezen en schrijven")
struct JSONLezenEnSchrijvenTests {
	@Test("houdt de volgorde van de velden vast")
	func volgorde() throws {
		let v = try JSONValue.parse(#"{"z":1,"a":{"y":true,"b":null},"m":[3,2,1]}"#)
		#expect(v.objectValue?.keys == ["z", "a", "m"])
		#expect(v["a"]?.objectValue?.keys == ["y", "b"])
		#expect(v.tekst() == #"{"z":1,"a":{"y":true,"b":null},"m":[3,2,1]}"#)
	}

	@Test("leest tekst met accenten, aanhalingstekens en codes")
	func tekst() throws {
		let v = try JSONValue.parse(#"["Zoë","a\"b\\c","regel\nregel","é😀","tab\t"]"#)
		#expect(v.arrayValue?.compactMap(\.stringValue) == ["Zoë", "a\"b\\c", "regel\nregel", "é😀", "tab\t"])
		#expect(v.tekst() == #"["Zoë","a\"b\\c","regel\nregel","é😀","tab\t"]"#)
		#expect(JSONValue.string("\u{01}").tekst() == #""\u0001""#)
	}

	@Test("leest getallen en schrijft hele getallen zonder komma")
	func getallen() throws {
		let v = try JSONValue.parse("[0, -1, 2100, 12.5, 1e3, 1790000000000, -0.25]")
		#expect(v.arrayValue?.compactMap(\.numberValue) == [0, -1, 2100, 12.5, 1000, 1_790_000_000_000, -0.25])
		#expect(v.tekst() == "[0,-1,2100,12.5,1000,1790000000000,-0.25]")
		#expect(JSONValue.number(.nan).tekst() == "null")
	}

	@Test("vindt twee objecten gelijk als alleen de volgorde verschilt")
	func gelijk() throws {
		#expect(try JSONValue.parse(#"{"a":1,"b":[{"x":1,"y":2}]}"#) == (try JSONValue.parse(#"{"b":[{"y":2,"x":1}],"a":1}"#)))
		#expect(try JSONValue.parse(#"{"a":1}"#) != (try JSONValue.parse(#"{"a":1,"b":null}"#)))
		#expect(try JSONValue.parse("[1,2]") != (try JSONValue.parse("[2,1]")))
	}

	@Test("weigert wat geen JSON is")
	func geenJSON() {
		for kapot in ["", "geen json", "{", #"{"a":1,}"#, "[1 2]", #"{"a" 1}"#, "01", "1.", #""open"#, "nul", "{} extra", #"{'a':1}"#] {
			#expect(throws: (any Error).self, "\(kapot)") { try JSONValue.parse(kapot) }
		}
	}

	@Test("schrijft ingesprongen zoals JSON.stringify met twee spaties")
	func ingesprongen() throws {
		let v = try JSONValue.parse(#"{"a":[],"b":{},"c":[1,{"d":null}]}"#)
		#expect(v.tekst(inspringing: 2) == """
		{
		  "a": [],
		  "b": {},
		  "c": [
		    1,
		    {
		      "d": null
		    }
		  ]
		}
		""")
	}
}
