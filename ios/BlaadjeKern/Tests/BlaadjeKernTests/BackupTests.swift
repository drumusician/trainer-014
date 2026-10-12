import Foundation
import Testing
@testable import BlaadjeKern

private func volleToestand() -> AppState {
	var t = emptyState()
	t.players = [
		Player(id: "p1", name: "Daanish", line: .M),
		Player(id: "p2", name: "Gijs", line: .geen, keeper: true),
	]
	t.trainings = [Training(id: "t1", date: "2026-09-02", status: ["p1": .present, "p2": .absent])]
	t.archive = [
		ArchivedMatch(
			date: "2026-08-30",
			opponent: "Ajax",
			home: true,
			score: [2, 1],
			formation: "4-3-3",
			duration: 4200,
			events: [],
			playingTime: [PlayingTimeRow(id: "p1", name: "Daanish", seconds: 4200, keeper: 0)]
		)
	]
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

@Suite("back-up")
struct BackupTests {
	@Test("houdt selectie, trainingen en archief vast, maar niet de lopende wedstrijd")
	func zonderLopendeWedstrijd() throws {
		let tekst = makeBackup(volleToestand(), "2026-09-03T10:00:00.000Z")
		let terug = try readBackup(tekst)
		#expect(terug.players?.count == 2)
		#expect(terug.trainings?[0].status["p2"] == .absent)
		#expect(terug.archive?[0].opponent == "Ajax")
		let inBestand = try #require(JSONValue.parse(tekst)["toestand"]?.objectValue)
		#expect(!inBestand.contains("wedstrijd"))
		#expect(!inBestand.contains("match"))
	}

	@Test("slikt ook een kale toestand, zoals een oude export")
	func kaleToestand() throws {
		let oud = #"{"players":[{"id":"p1","name":"Aad","line":"V"}],"archive":[]}"#
		#expect(try readBackup(oud).players?[0].name == "Aad")
	}

	@Test("weigert wat geen back-up is")
	func geenBackup() {
		#expect(throws: BlaadjeFout.geenSelectie) { try readBackup("{}") }
		#expect(throws: (any Error).self) { try readBackup("geen json") }
		#expect(throws: BlaadjeFout.geenSelectie) { try readBackup(#"{"players":[]}"#) }
	}

	@Test("noemt het bestand naar de dag")
	func bestandsnaam() {
		#expect(backupName("2026-09-03T10:00:00.000Z") == "blaadje-2026-09-03.json")
	}
}

@Suite("een bewaard bestand terugzetten")
struct BestandTerugzettenTests {
	/* The 'Bestand openen' button was missing while 'Bestand opslaan' was not.
	   What you save you must also be able to restore. */
	@Test("leest terug wat maakBackup schreef, met archief en al")
	func leestTerug() throws {
		let heen = makeBackup(volleToestand(), "2026-09-06T10:00:00.000Z")
		let terug = try readBackup(heen)
		#expect(terug.players?.count == volleToestand().players.count)
		#expect(terug.archive?.count == volleToestand().archive.count)
		#expect(terug.teamName == volleToestand().teamName)
	}

	@Test("beschrijft zowel een back-up als een overzetcode")
	func beschrijft() throws {
		let uitBackup = try readBackup(makeBackup(volleToestand(), "2026-09-06T10:00:00.000Z"))
		#expect(describePackage(uitBackup).contains("speler"))
	}

	/* Toegevoegd bij de overzetting naar Swift: het bestand moet er letter voor
	   letter uitzien zoals JSON.stringify(backup, null, 2) het schrijft, want een
	   back-up van hier moet ook in de webapp weer open kunnen. */
	@Test("schrijft het bestand zoals de webapp het schrijft")
	func zoalsDeWebapp() {
		var t = emptyState()
		t.players = [Player(id: "p1", name: "Zoë", line: .M), Player(id: "p2", name: "Gijs", line: .geen, keeper: true)]
		t.defaultLineup = DefaultLineup(formation: "4-3-3", lineup: ["K": "p2", "LV": nil], bench: ["p1"])
		#expect(makeBackup(t, "2026-09-03T10:00:00.000Z") == """
		{
		  "blaadje": 1,
		  "gemaakt": "2026-09-03T10:00:00.000Z",
		  "toestand": {
		    "teamName": "Ons team",
		    "players": [
		      {
		        "id": "p1",
		        "name": "Zoë",
		        "line": "M"
		      },
		      {
		        "id": "p2",
		        "name": "Gijs",
		        "line": "",
		        "keeper": true
		      }
		    ],
		    "formation": "4-3-3",
		    "minutesPerPart": 35,
		    "parts": 2,
		    "defaultLineup": {
		      "formation": "4-3-3",
		      "lineup": {
		        "K": "p2",
		        "LV": null
		      },
		      "bench": [
		        "p1"
		      ]
		    },
		    "archive": [],
		    "trainings": [],
		    "reportSubs": false
		  }
		}
		""")
	}
}
