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
        abonnement.haalStatus = { .init(aan: true, abonnementTot: Date().addingTimeInterval(200 * 86400)) }
        await abonnement.ververs()
        XCTAssertNotNil(abonnement.prijs, "het abonnement staat te koop")

        let team = "11111111-1111-4111-8111-111111111111"
        await abonnement.koop(team: team)

        let jws = try XCTUnwrap(server.gemeld.last)
        let aankoop = try inhoud(jws)
        XCTAssertEqual(aankoop["productId"] as? String, "app.blaadje.ios.seizoen")
        XCTAssertEqual((aankoop["appAccountToken"] as? String)?.lowercased(), team, "de server weet zo welk team het is")
        XCTAssertNotNil(aankoop["purchaseDate"], "de server rekent vanaf de aankoopdatum het seizoen uit")
        XCTAssertNil(abonnement.melding)
        XCTAssertEqual(abonnement.status?.aan, true)
    }

    func testHetProductBestaat() async throws {
        let producten = try await Product.products(for: ["app.blaadje.ios.seizoen"])
        XCTAssertEqual(producten.map(\.id), ["app.blaadje.ios.seizoen"])
        XCTAssertEqual(producten.first?.type, .nonRenewable, "een seizoen verlengt niet vanzelf")
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
        let seizoen = try XCTUnwrap(TeamAbonnement.Status.lees(Data(#"{"aan":true,"abonnement_tot":"2027-07-31T22:00:00+00:00"}"#.utf8)))
        XCTAssertEqual(seizoen.tekst(nu: nu), "Het team staat aan tot en met 31 juli 2027.")
        let uit = try XCTUnwrap(TeamAbonnement.Status.lees(Data(#"{"aan":false,"abonnement_tot":null}"#.utf8)))
        XCTAssertTrue(uit.tekst(nu: nu).hasPrefix("Het team staat uit"))
    }

    func testJeKooptAlsHetTeamUitStaatEnVanafMeiHetVolgendeSeizoen() throws {
        let tot = try XCTUnwrap(ISO8601DateFormatter().date(from: "2027-07-31T22:00:00Z"))
        let f = ISO8601DateFormatter()
        XCTAssertTrue(Status(aan: false, abonnementTot: nil).kopen())
        XCTAssertFalse(Status(aan: true, abonnementTot: tot).kopen(nu: try XCTUnwrap(f.date(from: "2026-10-14T12:00:00Z"))))
        XCTAssertTrue(Status(aan: true, abonnementTot: tot).kopen(nu: try XCTUnwrap(f.date(from: "2027-05-01T12:00:00Z"))))
        XCTAssertTrue(Status(aan: false, abonnementTot: tot).kopen(nu: try XCTUnwrap(f.date(from: "2027-08-02T12:00:00Z"))))
    }

    private typealias Status = TeamAbonnement.Status
}
