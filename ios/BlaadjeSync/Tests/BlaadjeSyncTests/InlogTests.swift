import Foundation
import XCTest
@testable import BlaadjeSync

final class Geheugenkluis: Kluis, @unchecked Sendable {
	private let slot = NSLock()
	private var data: Data?
	func lees() -> Data? { slot.withLock { data } }
	func schrijf(_ d: Data?) { slot.withLock { data = d } }
}

/// Een server die doet wat je hem opdraagt, en onthoudt wat hem gevraagd is.
final class Nepserver: @unchecked Sendable {
	private let slot = NSLock()
	private var _paden: [String] = []
	var antwoord: @Sendable (String, [String: Any]) throws -> ([String: Any], Int) = { _, _ in ([:], 200) }
	var paden: [String] { slot.withLock { _paden } }

	var verkeer: Inlog.Verkeer {
		{ [self] verzoek in
			let pad = verzoek.url!.path + (verzoek.url!.query.map { "?" + $0 } ?? "")
			slot.withLock { _paden.append(pad) }
			let inhoud = (try? JSONSerialization.jsonObject(with: verzoek.httpBody ?? Data())) as? [String: Any] ?? [:]
			let (uit, status) = try antwoord(pad, inhoud)
			return (try JSONSerialization.data(withJSONObject: uit), status)
		}
	}
}

final class Klok: @unchecked Sendable {
	private let slot = NSLock()
	private var _nu = 1_000_000.0
	var nu: Double {
		get { slot.withLock { _nu } }
		set { slot.withLock { _nu = newValue } }
	}
}

final class InlogTests: XCTestCase {
	private func sessie(_ n: Int) -> [String: Any] {
		["access_token": "toegang-\(n)", "refresh_token": "vernieuw-\(n)", "expires_in": 3600.0, "user": ["id": "u1", "email": "anna@voorbeeld.nl"]]
	}

	private func maak(_ server: Nepserver, _ kluis: Kluis, _ klok: Klok) -> Inlog {
		Inlog(basis: URL(string: "https://voorbeeld.supabase.co")!, sleutel: "openbaar", kluis: kluis, verkeer: server.verkeer, nu: { klok.nu })
	}

	func testInloggenMetEenCodeEnDaarnaIngelogdBlijven() async throws {
		let server = Nepserver(), kluis = Geheugenkluis(), klok = Klok()
		server.antwoord = { [self] pad, inhoud in
			if pad == "/auth/v1/verify" {
				XCTAssertEqual(inhoud["token"] as? String, "123456", "spaties om de code horen eraf")
				XCTAssertEqual(inhoud["type"] as? String, "email")
				return (sessie(1), 200)
			}
			return ([:], 200)
		}
		let inlog = maak(server, kluis, klok)
		do {
			_ = try await inlog.bewijs()
			XCTFail("zonder inloggen is er geen bewijs")
		} catch { XCTAssertEqual(error as? InlogFout, .nietIngelogd) }

		try await inlog.stuurCode(email: " anna@voorbeeld.nl ")
		let s = try await inlog.bevestig(email: "anna@voorbeeld.nl", code: " 123456 ")
		XCTAssertEqual(s.email, "anna@voorbeeld.nl")
		let bewijs = try await inlog.bewijs()
		XCTAssertEqual(bewijs, "toegang-1")
		XCTAssertEqual(server.paden, ["/auth/v1/otp", "/auth/v1/verify"], "een geldig bewijs wordt niet opnieuw gehaald")

		// De app sluiten en weer openen: de sessie komt uit de kluis.
		let daarna = maak(server, kluis, klok)
		let weer = try await daarna.bewijs()
		XCTAssertEqual(weer, "toegang-1")
	}

	func testHetReviewadresKrijgtGeenMailEnLogtInMetHetWachtwoord() async throws {
		let server = Nepserver(), klok = Klok()
		server.antwoord = { [self] pad, inhoud in
			XCTAssertEqual(inhoud["email"] as? String, Inlog.reviewAdres)
			XCTAssertEqual(inhoud["password"] as? String, "nep-wachtwoord")
			return (sessie(1), 200)
		}
		let inlog = maak(server, Geheugenkluis(), klok)
		try await inlog.stuurCode(email: " Review@Blaadje.app ")
		XCTAssertEqual(server.paden, [], "er gaat geen mail naar een adres dat niemand leest")
		try await inlog.bevestig(email: "review@blaadje.app", code: " nep-wachtwoord ")
		XCTAssertEqual(server.paden, ["/auth/v1/token?grant_type=password"])
		let bewijs = try await inlog.bewijs()
		XCTAssertEqual(bewijs, "toegang-1")
	}

	func testEenVerkeerdeCodeLogtNietIn() async throws {
		let server = Nepserver(), klok = Klok()
		server.antwoord = { _, _ in (["msg": "Token has expired or is invalid"], 403) }
		let inlog = maak(server, Geheugenkluis(), klok)
		do {
			try await inlog.bevestig(email: "anna@voorbeeld.nl", code: "000000")
			XCTFail("een verkeerde code hoort te mislukken")
		} catch { XCTAssertEqual(error as? InlogFout, .afgewezen("Token has expired or is invalid")) }
		let s = await inlog.sessie
		XCTAssertNil(s)
	}

	func testHetBewijsWordtOpTijdVernieuwdEnDatGebeurtEenKeer() async throws {
		let server = Nepserver(), kluis = Geheugenkluis(), klok = Klok()
		server.antwoord = { [self] pad, inhoud in
			if pad.hasPrefix("/auth/v1/token") {
				XCTAssertEqual(inhoud["refresh_token"] as? String, "vernieuw-1")
				return (sessie(2), 200)
			}
			return (sessie(1), 200)
		}
		let inlog = maak(server, kluis, klok)
		try await inlog.bevestig(email: "anna@voorbeeld.nl", code: "123456")
		klok.nu += 3600 - 30

		async let a = inlog.bewijs()
		async let b = inlog.bewijs()
		let (x, y) = try await (a, b)
		XCTAssertEqual([x, y], ["toegang-2", "toegang-2"])
		XCTAssertEqual(server.paden.filter { $0.hasPrefix("/auth/v1/token") }.count, 1, "twee vragers vernieuwen samen één keer")
		let bewaard = try JSONDecoder().decode(Sessie.self, from: try XCTUnwrap(kluis.lees()))
		XCTAssertEqual(bewaard.vernieuw, "vernieuw-2", "het nieuwe vernieuwbewijs hoort bewaard te zijn")
	}

	func testZonderBereikBlijfJeIngelogd() async throws {
		let server = Nepserver(), kluis = Geheugenkluis(), klok = Klok()
		server.antwoord = { [self] _, _ in (sessie(1), 200) }
		let inlog = maak(server, kluis, klok)
		try await inlog.bevestig(email: "anna@voorbeeld.nl", code: "123456")
		klok.nu += 7200

		server.antwoord = { _, _ in throw URLError(.notConnectedToInternet) }
		do {
			_ = try await inlog.bewijs()
			XCTFail("zonder bereik is er geen nieuw bewijs")
		} catch { XCTAssertEqual(error as? InlogFout, .storing) }
		var s = await inlog.sessie
		XCTAssertNotNil(s, "langs de lijn valt het bereik weg; dan mag je niet uitgelogd raken")
		XCTAssertNotNil(kluis.lees())

		server.antwoord = { _, _ in ([:], 503) }
		do { _ = try await inlog.bewijs() } catch { XCTAssertEqual(error as? InlogFout, .storing) }
		s = await inlog.sessie
		XCTAssertNotNil(s, "een server die even weg is, is ook geen reden")

		// Het bereik is terug.
		server.antwoord = { [self] _, _ in (sessie(2), 200) }
		let bewijs = try await inlog.bewijs()
		XCTAssertEqual(bewijs, "toegang-2")
	}

	func testEenIngetrokkenSessieLogtUit() async throws {
		let server = Nepserver(), kluis = Geheugenkluis(), klok = Klok()
		server.antwoord = { [self] _, _ in (sessie(1), 200) }
		let inlog = maak(server, kluis, klok)
		try await inlog.bevestig(email: "anna@voorbeeld.nl", code: "123456")
		klok.nu += 7200
		server.antwoord = { _, _ in (["msg": "Invalid Refresh Token"], 400) }
		do {
			_ = try await inlog.bewijs()
			XCTFail("een ingetrokken sessie geeft geen bewijs")
		} catch { XCTAssertEqual(error as? InlogFout, .afgewezen("Invalid Refresh Token")) }
		let s = await inlog.sessie
		XCTAssertNil(s)
		XCTAssertNil(kluis.lees(), "en hij hoort ook uit de kluis te zijn")
	}
}
