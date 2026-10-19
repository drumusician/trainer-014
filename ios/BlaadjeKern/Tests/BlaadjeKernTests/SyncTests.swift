import Foundation
import Testing
@testable import BlaadjeKern

/// De toestand als rijen en terug: wat de server krijgt klopt, en wat terugkomt is hetzelfde.
@Suite struct SyncTests {
	let team = "11111111-1111-4111-8111-111111111111"

	/// Een seizoen in het klein: selectie, twee bewaarde wedstrijden, trainingen en een wedstrijd die loopt.
	func seizoen() -> AppState {
		var t = emptyState()
		t.teamName = "JO14-1"
		t.formation = "4-3-3"
		let namen = ["Sem", "Noah", "Luuk", "Finn", "Bram", "Daan", "Jesse", "Milan", "Ruben", "Thijs", "Lars", "Stijn", "Tim", "Joep"]
		t.players = namen.enumerated().map { i, n in Player(id: "p\(i + 1)", name: n, line: i < 5 ? .V : i < 8 ? .M : .A, keeper: i == 0 ? true : nil) }
		let plekken = ["K", "RV", "CVr", "CVl", "LV", "MR", "MC", "ML", "RB", "SP", "LB"]
		t.defaultLineup = DefaultLineup(
			formation: "4-3-3", lineup: Lineup(plekken.enumerated().map { i, plek in (plek, "p\(i + 1)") }), bench: ["p12", "p13", "p14"])
		var nu = 1_760_000_000_000.0
		for (i, tegen) in ["Sparta", "Excelsior"].enumerated() {
			MatchActions.nieuwe(&t, opponent: tegen, home: i == 0, vandaag: "2026-09-0\(i + 5)")
			MatchActions.setAbsent(&t, spelerId: "p14", absent: true)
			_ = ClockActions.toggleRunning(&t.match, nu: nu, vandaag: "2026-09-0\(i + 5)")
			nu += 600_000
			MatchEventActions.putOnPosition(&t.match, nu: nu, position: "SP", spelerId: "p12")
			MatchEventActions.goal(&t.match, nu: nu, spelerId: "p9")
			_ = MatchEventActions.setAssist(&t.match, spelerId: "p12")
			nu += 300_000
			MatchEventActions.concede(&t.match, nu: nu)
			_ = MatchEventActions.ruil(&t.match, nu: nu, "K", "LV")
			_ = MatchActions.finish(&t.match, nu: nu + 1_200_000)
			t.match?.note = "Goed gespeeld. "
			_ = MatchActions.archiveMatch(&t, nu: nu + 1_200_000)
			t.match = nil
		}
		for d in ["2026-09-01", "2026-09-03"] {
			let tr = TrainingActions.newTraining(&t, vandaag: d, nieuwId: { "t" + d })
			TrainingActions.cycleAttendance(&t, trainingId: tr.id, "p3")
		}
		MatchActions.nieuwe(&t, opponent: "Feyenoord", home: true, vandaag: "2026-09-12")
		_ = ClockActions.toggleRunning(&t.match, nu: nu, vandaag: "2026-09-12")
		MatchEventActions.goal(&t.match, nu: nu + 60_000, spelerId: nil)
		PlanActions.voegToe(&t.match, minuut: 35, on: "p12", off: "p10", naDeel: 1, nieuwId: { "w1" })
		SyncModel.vulKenmerkenAan(&t)
		/* Het programma, met taken: twee wedstrijden die nog komen. */
		let thuis = ProgramActions.voegToe(&t, datum: "2026-09-19", tijd: "10:30", tegenstander: "Ajax", thuis: true, nieuwId: { "prog-1" })
		ProgramActions.voegToe(&t, datum: "2026-09-26", tijd: nil, tegenstander: "PSV", thuis: false, nieuwId: { "prog-2" })
		ProgramActions.zet(&t, wedstrijd: thuis, .limonade, speler: "p4", nieuwId: { "taak-1" })
		ProgramActions.zet(&t, wedstrijd: thuis, .vlaggen, speler: "p7", nieuwId: { "taak-2" })
		ProgramActions.voegToe(&t, wedstrijd: "prog-2", .rijden, speler: "p2", nieuwId: { "taak-3" })
		ProgramActions.voegToe(&t, wedstrijd: "prog-2", .rijden, speler: nil, nieuwId: { "taak-4" })
		ProgramActions.zet(&t, wedstrijd: thuis, .fluiten, speler: ProgramActions.vereniging, nieuwId: { "taak-5" })
		ProgramActions.zet(&t, wedstrijd: thuis, .velddienst, speler: "p9", nieuwId: { "taak-6" })
		t.tasks[1].player = nil
		t.tasks[1].declinedBy = "p7"
		/* Een ouder meldde zijn kind af voor de uitwedstrijd. */
		t.program[1].absent = ["p5"]
		return t
	}

	func heenEnTerug(_ t: AppState) -> AppState? {
		SyncModel.toestand(uit: SyncModel.alsTabellen(SyncModel.rijen(van: t, team: team)), team: team)
	}

	@Test func eenKenmerkWordtAltijdDezelfdeUuid() {
		let a = SyncModel.uuid("p1", team: team)
		#expect(a == SyncModel.uuid("p1", team: team))
		#expect(a != SyncModel.uuid("p2", team: team))
		#expect(a != SyncModel.uuid("p1", team: "22222222-2222-4222-8222-222222222222"), "per team, anders botsen twee teams met een p1")
		#expect(UUID(uuidString: a) != nil && a.count == 36)
		#expect(SyncModel.uuid("ABCDEF12-3456-4789-8ABC-DEF123456789", team: team) == "abcdef12-3456-4789-8abc-def123456789")
	}

	@Test func naEenKeerHeenEnTerugVerandertErNietsMeer() throws {
		let eerst = try #require(heenEnTerug(seizoen()))
		let daarna = try #require(heenEnTerug(eerst))
		#expect(eerst == daarna)
		#expect(SyncModel.rijen(van: eerst, team: team) == SyncModel.rijen(van: daarna, team: team))
	}

	@Test func watDeTrainerZietBlijftHetzelfde() throws {
		let voor = seizoen()
		let na = try #require(heenEnTerug(voor))
		#expect(na.teamName == voor.teamName)
		#expect(na.players.map(\.name) == voor.players.map(\.name))
		#expect(na.players.map(\.line) == voor.players.map(\.line))
		#expect(na.players.map { $0.keeper == true } == voor.players.map { $0.keeper == true })
		#expect(na.formation == voor.formation && na.parts == voor.parts && na.minutesPerPart == voor.minutesPerPart)
		#expect(seizoenStand(na.archive) == seizoenStand(voor.archive))
		#expect(seasonTotals(na.archive, na.players) == seasonTotals(voor.archive, voor.players))
		#expect(na.archive.map(\.opponent) == voor.archive.map(\.opponent), "nieuwste eerst, zoals het stond")
		#expect(na.archive.map(\.note) == voor.archive.map(\.note), "ook de spatie aan het eind van een notitie")
		#expect(na.archive.map { $0.events.map(\.type) } == voor.archive.map { $0.events.map(\.type) })
		#expect(na.archive.map { $0.lineup?.positions } == voor.archive.map { $0.lineup?.positions }, "de volgorde van de plekken telt")
		#expect(na.archive.map { momentenVan($0, na.players).count } == voor.archive.map { momentenVan($0, voor.players).count })
		#expect(na.trainings.map(\.date) == voor.trainings.map(\.date))
		#expect(na.trainings.map { $0.status.values } == voor.trainings.map { $0.status.values })
		#expect(benchOverview(na.players, na.archive, na.trainings).map(\.benchSeconds) == benchOverview(voor.players, voor.archive, voor.trainings).map(\.benchSeconds))

		let w = try #require(na.match), was = try #require(voor.match)
		#expect(w.opponent == was.opponent && w.running == was.running && w.since == was.since && w.elapsed == was.elapsed)
		#expect(score(w) == score(was))
		#expect(w.plan?.count == 1)
		#expect(w.lineup.positions == was.lineup.positions)
		let nu = 1_760_003_000_000.0
		#expect(playingTimes(w, na.players, nu: nu).values == playingTimes(was, voor.players, nu: nu).values)
		#expect(planStappen(w, nu: nu).map(\.kanNiet) == planStappen(was, nu: nu).map(\.kanNiet))
	}

	@Test func elkeVerwijzingKomtUit() {
		let rijen = SyncModel.rijen(van: seizoen(), team: team)
		func ids(_ tabel: String) -> Set<String> { Set(rijen.filter { $0.tabel == tabel }.map(\.id)) }
		let spelers = ids("spelers"), wedstrijden = ids("wedstrijden"), trainingen = ids("trainingen")
		for tabel in SyncModel.tabellen {
			let hier = rijen.filter { $0.tabel == tabel }
			#expect(Set(hier.map(\.id)).count == hier.count, "dubbel kenmerk in \(tabel)")
		}
		var paren = Set<String>()
		for r in rijen {
			#expect(UUID(uuidString: r.id) != nil, "\(r.tabel) heeft een kenmerk dat geen uuid is")
			for k in ["speler_id", "speler", "assist", "erin", "eruit", "speler_b"] {
				if let v = r.kolommen[k]?.tekst { #expect(spelers.contains(v), "\(r.tabel).\(k) wijst naar niemand") }
			}
			if let v = r.kolommen["wedstrijd_id"]?.tekst { #expect(wedstrijden.contains(v)) }
			if let v = r.kolommen["training_id"]?.tekst { #expect(trainingen.contains(v)) }
			if r.tabel == "wedstrijd_spelers" {
				#expect(paren.insert("\(r.kolommen["wedstrijd_id"]!)\(r.kolommen["speler_id"]!)").inserted, "een speler staat twee keer bij een wedstrijd")
			}
		}
		/* Eerst waar naar verwezen wordt. */
		let volgorde = rijen.map(\.tabel)
		#expect(volgorde.firstIndex(of: "spelers")! < volgorde.firstIndex(of: "wedstrijd_spelers")!)
		#expect(volgorde.firstIndex(of: "wedstrijden")! < volgorde.firstIndex(of: "gebeurtenissen")!)
	}

	@Test func eenTikIsEenKleinVerschil() throws {
		var t = try #require(heenEnTerug(seizoen()))
		let voor = SyncModel.rijen(van: t, team: team)
		#expect(SyncModel.verschil(van: voor, naar: voor).isEmpty)

		MatchEventActions.goal(&t.match, nu: 1_760_003_000_000, spelerId: t.players[8].id)
		let metDoelpunt = SyncModel.rijen(van: t, team: team)
		let erbij = SyncModel.verschil(van: voor, naar: metDoelpunt)
		#expect(erbij.count == 2)
		#expect(erbij.contains { if case .erbij(let r) = $0 { return r.tabel == "gebeurtenissen" && r.kolommen["soort"] == .tekst("doelpunt") }; return false })
		#expect(erbij.contains { if case .bij("wedstrijden", _, let k) = $0 { return k == ["doelpunten_voor": .getal(2)] }; return false })

		_ = MatchEventActions.undoLast(&t.match)
		let terug = SyncModel.verschil(van: metDoelpunt, naar: SyncModel.rijen(van: t, team: team))
		#expect(terug.contains { if case .weg("gebeurtenissen", _) = $0 { return true }; return false })
		#expect(SyncModel.rijen(van: t, team: team) == voor, "terugdraaien geeft precies de rijen van daarvoor")
	}

	@Test func eenAssistErbijIsEenAndereGebeurtenis() throws {
		var t = try #require(heenEnTerug(seizoen()))
		MatchEventActions.goal(&t.match, nu: 1_760_003_000_000, spelerId: t.players[8].id)
		let voor = SyncModel.rijen(van: t, team: team)
		_ = MatchEventActions.setAssist(&t.match, spelerId: t.players[9].id)
		let v = SyncModel.verschil(van: voor, naar: SyncModel.rijen(van: t, team: team))
		/* Bijwerken mag daar niet van de server, dus: de oude weg en de nieuwe erbij. */
		#expect(!v.contains { if case .bij("gebeurtenissen", _, _) = $0 { return true }; return false })
		#expect(v.count == 2)
	}

	@Test func wieWeggaatBlijftBestaanAlsHijGespeeldHeeft() throws {
		var t = try #require(heenEnTerug(seizoen()))
		let voor = SyncModel.rijen(van: t, team: team)
		let thijs = try #require(t.players.first { $0.name == "Thijs" })
		t.match = nil
		let zonderWedstrijd = SyncModel.rijen(van: t, team: team)
		SquadActions.removePlayer(&t, thijs)
		let v = SyncModel.verschil(van: zonderWedstrijd, naar: SyncModel.rijen(van: t, team: team))
		#expect(v.contains(.bij(tabel: "spelers", id: thijs.id, kolommen: ["weg": .tekst(SyncModel.nu), "linie": .tekst("")])))
		#expect(!v.contains(.weg(tabel: "spelers", id: thijs.id)), "hij staat nog in bewaarde wedstrijden")
		let na = try #require(heenEnTerug(t))
		#expect(!na.players.contains { $0.name == "Thijs" })
		#expect(na.archive[0].playingTime.contains { $0.name == "Thijs" }, "zijn speeltijd van toen blijft staan")
		_ = voor
	}

	@Test func eenBackUpVanHetWebGaatHeenEnTerug() throws {
		var t = try #require(try Opslag.lees(opgeslagenTekst()))
		SyncModel.vulKenmerkenAan(&t)
		let eerst = try #require(heenEnTerug(t))
		#expect(try #require(heenEnTerug(eerst)) == eerst)
		#expect(seizoenStand(eerst.archive) == seizoenStand(t.archive))
		#expect(eerst.players.map(\.name) == t.players.map(\.name))
		#expect(eerst.archive.count == t.archive.count && eerst.trainings.count == t.trainings.count)
		/* Bij gelijke speeltijd staan spelers daarna op de volgorde van de selectie;
		   de getallen zelf horen gelijk te zijn. */
		let voor = seasonTotals(t.archive, t.players).sorted { $0.name < $1.name }
		let na = seasonTotals(eerst.archive, eerst.players).sorted { $0.name < $1.name }
		#expect(na.map(\.name) == voor.map(\.name))
		#expect(na.map(\.doelpunten) == voor.map(\.doelpunten))
		#expect(na.map(\.wedstrijden) == voor.map(\.wedstrijden))
		#expect(zip(na, voor).allSatisfy { abs($0.seconds - $1.seconds) <= Double(max(1, $1.wedstrijden)) }, "hooguit een seconde afronding per wedstrijd")
	}

	@Test func zonderTeamValtErNietsOpTeBouwen() {
		#expect(SyncModel.toestand(uit: [:], team: team) == nil)
		let ander = SyncModel.alsTabellen(SyncModel.rijen(van: seizoen(), team: "22222222-2222-4222-8222-222222222222"))
		#expect(SyncModel.toestand(uit: ander, team: team) == nil, "de rijen van een ander team zijn niet van ons")
	}

	@Test func eenTijdstipVanDeServerEnVanHetToestelZijnTeVergelijken() {
		#expect(SyncModel.tijdstip(basis: 1_760_389_200.5, volgnummer: 3) == "2025-10-13T21:00:00.503Z")
		#expect(SyncModel.moment("2026-10-13 21:00:00.123456+00") < SyncModel.moment("2026-10-13T21:00:00.124Z"))
		#expect(SyncModel.moment("2026-10-13T21:00:00Z") < SyncModel.moment("2026-10-13 21:00:00.001+00"))
	}

	/// De webapp schrijft dezelfde tabellen, met een eigen vertaling in TypeScript.
	/// Maken de twee voor dezelfde toestand niet precies dezelfde rijen, dan ziet
	/// de een de wedstrijden van de ander als nieuwe en staat alles dubbel. Dus
	/// staan de rijen van de iPhone in een bestand, en legt de webtest
	/// (`web/src/lib/supabase/rijen.test.ts`) de zijne ernaast.
	///
	/// Verandert de vertaling hier met opzet, draai dan met `SCHRIJF_RIJEN=1` en
	/// kijk of de webtest daarna nog slaagt.
	@Test func deRijenStaanVoorDeWebappKlaar() throws {
		var sept = try #require(try Opslag.lees(opgeslagenTekst()))
		var n = 0
		SyncModel.vulKenmerkenAan(&sept) { n += 1; return "wedstrijd-\(n)" }
		/* Vaste kenmerken: seizoen() geeft de wedstrijden er elke keer nieuwe. */
		var s = seizoen()
		s.match?.id = "wedstrijd-van-nu"
		for i in s.archive.indices { s.archive[i].id = "bewaard-\(i)" }
		/* Ook wat zelden voorkomt: twee kinderen die het team verlieten (de een
		   speelde nog, de ander was afgemeld), wie de wedstrijd bijhoudt, en een
		   notitie met aanhalingstekens. */
		s.players.removeAll { $0.id == "p13" || $0.id == "p14" }
		s.match?.keptBy = "trainer@voorbeeld.nl"
		s.match?.note = "Let's \"knallen\"\n"
		s.archive[0].parts = 4
		let gevallen: [(String, AppState)] = [("seizoen", s), ("september", sept)]

		func cel(_ c: Cel) -> JSONValue {
			switch c {
			case .tekst(let s): .string(s)
			case .getal(let g): .number(Double(g))
			case .leeg: .null
			}
		}
		var uit: [JSONValue] = []
		for (naam, t) in gevallen {
			var o = OrderedDict<JSONValue>()
			o["naam"] = .string(naam)
			o["team"] = .string(team)
			o["invoer"] = t.json
			o["rijen"] = .array(SyncModel.rijen(van: t, team: team).map { r in
				var k = OrderedDict<JSONValue>()
				for sleutel in r.kolommen.keys.sorted() { k[sleutel] = cel(r.kolommen[sleutel]!) }
				var rij = OrderedDict<JSONValue>()
				rij["tabel"] = .string(r.tabel)
				rij["id"] = .string(r.id)
				rij["kolommen"] = .object(k)
				return .object(rij)
			})
			uit.append(.object(o))
		}
		let tekst = JSONValue.array(uit).tekst() + "\n"
		let pad = URL(fileURLWithPath: #filePath).deletingLastPathComponent().appendingPathComponent("Fixtures/rijen-gedeeld.json")
		if ProcessInfo.processInfo.environment["SCHRIJF_RIJEN"] != nil || !FileManager.default.fileExists(atPath: pad.path) {
			try tekst.write(to: pad, atomically: true, encoding: .utf8)
		}
		#expect(try String(contentsOf: pad, encoding: .utf8) == tekst, "de rijen zijn veranderd; draai met SCHRIJF_RIJEN=1 en daarna de webtest")
	}
}
