import StoreKit
import StoreKitTest
import XCTest
@testable import Blaadje

/// Het teamabonnement: kopen in de simulator, zonder App Store Connect
/// (Blaadje.storekit), en kijken wat er naar de server gaat.
@MainActor
final class AbonnementTests: XCTestCase {
    final class Server: @unchecked Sendable {
        private let slot = NSLock()
        private var _gemeld: [String] = []
        var gemeld: [String] { slot.withLock { _gemeld } }
        func meld(_ jws: String) -> Bool { slot.withLock { _gemeld.append(jws) }; return true }
    }

    private var sessie: SKTestSession!

    override func setUp() async throws {
        sessie = try SKTestSession(configurationFileNamed: "Blaadje")
        sessie.resetToDefaultState()
        sessie.disableDialogs = true
        sessie.clearTransactions()
    }

    /// Het midden van een JWS, als woordenboek.
    private func inhoud(_ jws: String) throws -> [String: Any] {
        var deel = jws.split(separator: ".")[1].replacingOccurrences(of: "-", with: "+").replacingOccurrences(of: "_", with: "/")
        while deel.count % 4 != 0 { deel += "=" }
        return try XCTUnwrap(JSONSerialization.jsonObject(with: try XCTUnwrap(Data(base64Encoded: deel))) as? [String: Any])
    }

    func testKopenGeeftHetTeamMeeEnMeldtHetBijDeServer() async throws {
        let server = Server()
        let abonnement = TeamAbonnement()
        abonnement.meld = { server.meld($0) }
        abonnement.haalStatus = { .init(aan: true, gratisTot: nil, abonnementTot: Date().addingTimeInterval(365 * 86400)) }
        await abonnement.ververs()
        XCTAssertNotNil(abonnement.prijs, "het abonnement staat te koop")

        let team = "11111111-1111-4111-8111-111111111111"
        await abonnement.koop(team: team)

        let jws = try XCTUnwrap(server.gemeld.last)
        let aankoop = try inhoud(jws)
        XCTAssertEqual(aankoop["productId"] as? String, "app.blaadje.ios.team")
        XCTAssertEqual((aankoop["appAccountToken"] as? String)?.lowercased(), team, "de server weet zo welk team het is")
        XCTAssertNotNil(aankoop["expiresDate"])
        XCTAssertNil(abonnement.melding)
        XCTAssertEqual(abonnement.status?.aan, true)
    }

    func testHetProductBestaat() async throws {
        let producten = try await Product.products(for: ["app.blaadje.ios.team"])
        XCTAssertEqual(producten.map(\.id), ["app.blaadje.ios.team"])
    }

    func testZonderTeamWordtErNietsGekocht() async {
        let server = Server()
        let abonnement = TeamAbonnement()
        abonnement.meld = { server.meld($0) }
        await abonnement.ververs()
        await abonnement.koop(team: "geen-team")
        XCTAssertTrue(server.gemeld.isEmpty)
        XCTAssertNotNil(abonnement.melding)
    }

    func testDeStandVanHetTeamInWoorden() throws {
        let nu = try XCTUnwrap(ISO8601DateFormatter().date(from: "2026-10-14T12:00:00Z"))
        let gratis = try XCTUnwrap(TeamAbonnement.Status.lees(Data(#"{"aan":true,"gratis_tot":"2027-01-31T23:00:00+00:00","abonnement_tot":null}"#.utf8)))
        XCTAssertEqual(gratis.tekst(nu: nu), "Tot 1 februari 2027 is alles gratis. Daarna zet het teamabonnement het team aan.")
        let betaald = try XCTUnwrap(TeamAbonnement.Status.lees(Data(#"{"aan":true,"gratis_tot":"2027-01-31T23:00:00+00:00","abonnement_tot":"2027-10-14T10:00:00.123+00:00"}"#.utf8)))
        XCTAssertEqual(betaald.tekst(nu: nu), "Het team staat aan tot 14 oktober 2027.")
        let uit = Status(aan: false, gratisTot: nil, abonnementTot: nil)
        XCTAssertTrue(uit.tekst(nu: nu).hasPrefix("Het team staat uit"))
    }

    private typealias Status = TeamAbonnement.Status
}
