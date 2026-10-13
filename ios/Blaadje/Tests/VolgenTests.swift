import XCTest
@testable import Blaadje

/// Volgen als ouder: de link is de sleutel, en de server krijgt alleen het adres voor meldingen.
@MainActor
final class VolgenTests: XCTestCase {
    /// Onthoudt wat er aan de server gevraagd is.
    final class Server: @unchecked Sendable {
        private let slot = NSLock()
        private var _vragen: [(String, [String: String])] = []
        var vragen: [(String, [String: String])] { slot.withLock { _vragen } }
        var plat = false

        var verkeer: Volgen.Verkeer {
            { [self] functie, inhoud in
                slot.withLock { _vragen.append((functie, inhoud)) }
                if plat { throw URLError(.notConnectedToInternet) }
                guard functie == "volgpagina" else { return Data("true".utf8) }
                guard inhoud["p_code"] == "code-van-sem-0123456789" else { return Data("null".utf8) }
                return Data(#"{"team":"JO14-1","kind":"Sem","seizoen":"2026/27","wedstrijden":[{"datum":"2026-09-12","tegenstander":"Sparta","thuis":false,"status":"bezig","voor":1,"tegen":0}],"trainingen":[{"datum":"2026-09-03","status":null}]}"#.utf8)
            }
        }
    }

    private func maak(_ server: Server) -> (Volgen, UserDefaults) {
        let opslag = UserDefaults(suiteName: "volgen-test-\(UUID().uuidString)")!
        let v = Volgen(verkeer: server.verkeer, opslag: opslag)
        v.vraagMeldingen = {}
        return (v, opslag)
    }

    func testDeCodeKomtUitElkeVormVanDeLink() {
        XCTAssertEqual(Volgen.code(uit: "https://blaadje.app/volg/?c=code-van-sem-0123456789"), "code-van-sem-0123456789")
        XCTAssertEqual(Volgen.code(uit: "blaadje://volg/code-van-sem-0123456789"), "code-van-sem-0123456789")
        XCTAssertEqual(Volgen.code(uit: "blaadje://volg?c=code-van-sem-0123456789"), "code-van-sem-0123456789")
        XCTAssertEqual(Volgen.code(uit: "  code-van-sem-0123456789\n"), "code-van-sem-0123456789", "alleen de code plakken mag ook")
        XCTAssertNil(Volgen.code(uit: "https://blaadje.app/"))
        XCTAssertNil(Volgen.code(uit: "hoi"))
        XCTAssertNil(Volgen.code(uit: "https://blaadje.app/volg/?c=../../etc/passwd-0123456789"), "alleen letters, cijfers en streepjes")
    }

    func testEenKindVolgenMetDeLinkVanDeTrainer() async {
        let server = Server()
        let (volgen, opslag) = maak(server)
        let gelukt = await volgen.voegToe("https://blaadje.app/volg/?c=code-van-sem-0123456789")
        XCTAssertTrue(gelukt)
        XCTAssertEqual(volgen.kinderen.first?.pagina?.kind, "Sem")
        XCTAssertEqual(volgen.kinderen.first?.pagina?.wedstrijden.first?.voor, 1)
        XCTAssertNil(volgen.kinderen.first?.pagina?.trainingen.first?.status, "een training die niet is bijgehouden is geen gemiste training")

        // Dezelfde link nog een keer is geen tweede kind.
        _ = await volgen.voegToe("blaadje://volg/code-van-sem-0123456789")
        XCTAssertEqual(volgen.kinderen.count, 1)

        // Na opnieuw openen volg je nog steeds.
        let daarna = Volgen(verkeer: server.verkeer, opslag: opslag)
        XCTAssertEqual(daarna.kinderen.map(\.code), ["code-van-sem-0123456789"])
    }

    func testEenLinkDieNietKloptVolgtNiemand() async {
        let server = Server()
        let (volgen, _) = maak(server)
        var gelukt = await volgen.voegToe("https://blaadje.app/volg/?c=ingetrokken-code-0123456789")
        XCTAssertFalse(gelukt)
        XCTAssertEqual(volgen.melding, "Deze link werkt niet meer. Vraag de trainer om een nieuwe.")
        gelukt = await volgen.voegToe("zomaar wat")
        XCTAssertFalse(gelukt)
        server.plat = true
        gelukt = await volgen.voegToe("code-van-sem-0123456789")
        XCTAssertFalse(gelukt)
        XCTAssertEqual(volgen.melding, "Dat lukte niet. Heb je bereik?")
        XCTAssertTrue(volgen.kinderen.isEmpty)
    }

    func testDeServerKrijgtHetAdresVoorMeldingenEnRaaktHetKwijtBijStoppen() async throws {
        let server = Server()
        let (volgen, _) = maak(server)
        _ = await volgen.voegToe("code-van-sem-0123456789")
        XCTAssertFalse(server.vragen.contains { $0.0 == "volg" }, "zonder adres valt er niets aan te melden")

        await volgen.zetToken(Data([0xab, 0x01, 0xff]))
        let aangemeld = try XCTUnwrap(server.vragen.last { $0.0 == "volg" })
        XCTAssertEqual(aangemeld.1["p_code"], "code-van-sem-0123456789")
        XCTAssertEqual(aangemeld.1["p_token"], "ab01ff")
        XCTAssertEqual(aangemeld.1["p_omgeving"], "proef", "een app uit Xcode zit bij Apple in de proefomgeving")

        await volgen.stop(volgen.kinderen[0])
        let afgemeld = try XCTUnwrap(server.vragen.last)
        XCTAssertEqual(afgemeld.0, "ontvolg")
        XCTAssertEqual(afgemeld.1["p_token"], "ab01ff")
        XCTAssertTrue(volgen.kinderen.isEmpty)
    }
}
