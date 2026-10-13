import BlaadjeKern
import CryptoKit
import Foundation
import XCTest
@testable import BlaadjeSync

/// Tegen de lokale opstelling uit `proef/powersync` (Postgres, PostgREST en de
/// PowerSync-dienst in Docker). Draait die niet, dan worden deze tests overgeslagen.
/// Starten: `ios/BlaadjeSync/proef.sh`.
final class SpiegelTests: XCTestCase {
	static let adres = SyncAdres(rest: URL(string: "http://localhost:3055")!, powersync: "http://localhost:8089")
	static let anna = "44444444-4444-4444-4444-444444444444"
	static let bas = "55555555-5555-5555-5555-555555555555"

	/// Een toegangsbewijs zoals Supabase het uitgeeft, getekend met het geheim van de proef.
	struct Proefbewijs: Toegang {
		let gebruiker: String
		func bewijs() async throws -> String {
			func b64(_ d: Data) -> String {
				d.base64EncodedString().replacingOccurrences(of: "+", with: "-")
					.replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "=", with: "")
			}
			let kop = b64(try JSONSerialization.data(withJSONObject: ["alg": "HS256", "typ": "JWT", "kid": "proef"]))
			let nu = Int(Date().timeIntervalSince1970)
			let inhoud = b64(try JSONSerialization.data(withJSONObject: [
				"sub": gebruiker, "role": "authenticated", "aud": "powersync", "iat": nu, "exp": nu + 3600,
			] as [String: Any]))
			let handtekening = HMAC<SHA256>.authenticationCode(
				for: Data("\(kop).\(inhoud)".utf8), using: SymmetricKey(data: Data("blaadje-proef-geheim-van-minstens-32-tekens".utf8)))
			return "\(kop).\(inhoud).\(b64(Data(handtekening)))"
		}
	}

	private var map: URL!

	override func setUp() async throws {
		var r = URLRequest(url: URL(string: "http://localhost:8089/probes/liveness")!)
		r.timeoutInterval = 2
		guard let (_, a) = try? await URLSession.shared.data(for: r), (a as? HTTPURLResponse)?.statusCode == 200 else {
			throw XCTSkip("de lokale opstelling draait niet")
		}
		map = FileManager.default.temporaryDirectory.appendingPathComponent("blaadje-sync-\(UUID().uuidString)")
		try FileManager.default.createDirectory(at: map, withIntermediateDirectories: true)
	}

	private func toestel(_ naam: String) -> Spiegel { Spiegel(bestand: map.appendingPathComponent("\(naam).sqlite").path) }

	private func tot(_ wat: String, binnen seconden: Double = 30, _ klopt: () async throws -> Bool) async throws {
		let eind = Date().addingTimeInterval(seconden)
		while Date() < eind {
			if try await klopt() { return }
			try await Task.sleep(nanoseconds: 200_000_000)
		}
		XCTFail("na \(Int(seconden)) seconden nog steeds niet: \(wat)")
	}

	private func opServer(_ pad: String, als gebruiker: String) async throws -> [[String: Any]] {
		var r = URLRequest(url: URL(string: "http://localhost:3055" + pad)!)
		r.setValue("Bearer \(try await Proefbewijs(gebruiker: gebruiker).bewijs())", forHTTPHeaderField: "Authorization")
		let (data, _) = try await URLSession.shared.data(for: r)
		return try XCTUnwrap(try JSONSerialization.jsonObject(with: data) as? [[String: Any]], String(decoding: data, as: UTF8.self))
	}

	/// Een seizoen in het klein, gemaakt met dezelfde acties als de app.
	static func seizoen() -> AppState {
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
			_ = LineupActions.ensureDefaultLineup(&t)
			MatchActions.setAbsent(&t, spelerId: "p14", absent: true)
			_ = ClockActions.toggleRunning(&t.match, nu: nu, vandaag: "2026-09-0\(i + 5)")
			nu += 600_000
			MatchEventActions.putOnPosition(&t.match, nu: nu, position: "SP", spelerId: "p12")
			MatchEventActions.goal(&t.match, nu: nu, spelerId: "p9")
			_ = MatchEventActions.setAssist(&t.match, spelerId: "p12")
			MatchEventActions.concede(&t.match, nu: nu)
			_ = MatchEventActions.ruil(&t.match, nu: nu, "K", "LV")
			_ = MatchActions.finish(&t.match, nu: nu + 1_200_000)
			t.match?.note = "Goed gespeeld."
			_ = MatchActions.archiveMatch(&t, nu: nu + 1_200_000)
			t.match = nil
		}
		let tr = TrainingActions.newTraining(&t, vandaag: "2026-09-03")
		TrainingActions.cycleAttendance(&t, trainingId: tr.id, "p3")
		MatchActions.nieuwe(&t, opponent: "Feyenoord", home: true, vandaag: "2026-09-12")
		_ = ClockActions.toggleRunning(&t.match, nu: nu, vandaag: "2026-09-12")
		MatchEventActions.goal(&t.match, nu: nu + 60_000, spelerId: nil)
		SyncModel.vulKenmerkenAan(&t)
		return t
	}

	func testEenSeizoenGaatNaarDeServerEnKomtOpEenAnderToestelHetzelfdeTerug() async throws {
		let team = UUID().uuidString.lowercased()
		let begin = Self.seizoen()
		let rijen = SyncModel.rijen(van: begin, team: team)
		/* Wat het toestel zelf verwacht terug te krijgen. */
		let verwacht = try XCTUnwrap(SyncModel.toestand(uit: SyncModel.alsTabellen(rijen), team: team))

		// Zonder account: alles staat al op het toestel.
		let telefoon = toestel("telefoon")
		try await telefoon.schrijf(SyncModel.verschil(van: [], naar: rijen))
		let gelezen = try await telefoon.lees()
		let lokaal = try XCTUnwrap(SyncModel.toestand(uit: gelezen, team: team))
		XCTAssertEqual(lokaal, verwacht, "wat je wegschrijft lees je precies zo terug")

		// Inloggen stuurt het op.
		try await telefoon.verbind(adres: Self.adres, toegang: Proefbewijs(gebruiker: Self.anna))
		try await tot("alles is opgestuurd") { try await telefoon.wachtrij() == 0 }
		XCTAssertEqual(telefoon.geweigerd, [], "de server hoort niets te weigeren")

		let spelers = try await opServer("/spelers?team_id=eq.\(team)&naam=eq.Sem", als: Self.anna)
		XCTAssertEqual(spelers.first?["keept"] as? Bool, true, "ja/nee hoort als ja/nee aan te komen")
		let wedstrijden = try await opServer("/wedstrijden?team_id=eq.\(team)&status=eq.afgelopen", als: Self.anna)
		XCTAssertEqual(wedstrijden.count, 2)
		XCTAssertNotNil(wedstrijden.first?["opstelling"] as? [Any], "de opstelling hoort als lijst aan te komen, niet als tekst")
		let doelpunten = try await opServer("/gebeurtenissen?team_id=eq.\(team)&soort=eq.doelpunt", als: Self.anna)
		XCTAssertEqual(doelpunten.count, 3)
		let vanBas = try await opServer("/spelers?team_id=eq.\(team)", als: Self.bas)
		XCTAssertEqual(vanBas.count, 0, "een andere trainer ziet er niets van")

		// Een tweede toestel van dezelfde trainer krijgt hetzelfde seizoen.
		let tablet = toestel("tablet")
		try await tablet.verbind(adres: Self.adres, toegang: Proefbewijs(gebruiker: Self.anna))
		try await tablet.wachtOpEersteKeer()
		try await tot("het seizoen staat op de tablet") {
			SyncModel.toestand(uit: try await tablet.lees(), team: team) == verwacht
		}
		let mijnTeams = try await tablet.teams()
		XCTAssertTrue(mijnTeams.contains { $0.id == team && $0.naam == "JO14-1" })

		// Wat de server terugstuurt verandert op de telefoon niets.
		try await tot("de telefoon heeft zijn eigen rijen terug") {
			SyncModel.toestand(uit: try await telefoon.lees(), team: team) == verwacht
		}

		// Een doelpunt op de telefoon staat even later op de tablet.
		var metDoelpunt = verwacht
		MatchEventActions.goal(&metDoelpunt.match, nu: 1_760_002_000_000, spelerId: metDoelpunt.players[8].id)
		let seintjes = tablet.veranderingen()
		try await telefoon.schrijf(SyncModel.verschil(van: SyncModel.rijen(van: verwacht, team: team), naar: SyncModel.rijen(van: metDoelpunt, team: team)))
		try await tot("het doelpunt staat op de tablet") {
			SyncModel.toestand(uit: try await tablet.lees(), team: team) == metDoelpunt
		}
		var kreegSeintje = false
		for await _ in seintjes { kreegSeintje = true; break }
		XCTAssertTrue(kreegSeintje, "de tablet hoort te merken dat er iets veranderde")

		// En terugdraaien haalt het ook daar weer weg.
		try await telefoon.schrijf(SyncModel.verschil(van: SyncModel.rijen(van: metDoelpunt, team: team), naar: SyncModel.rijen(van: verwacht, team: team)))
		try await tot("het doelpunt is weer weg op de tablet") {
			SyncModel.toestand(uit: try await tablet.lees(), team: team) == verwacht
		}
		XCTAssertEqual(telefoon.geweigerd, [])

		// Uitloggen wist het toestel.
		try await tablet.wis()
		let leeg = try await tablet.lees()
		XCTAssertNil(SyncModel.toestand(uit: leeg, team: team))
		try await telefoon.sluit()
		try await tablet.sluit()
	}
}
