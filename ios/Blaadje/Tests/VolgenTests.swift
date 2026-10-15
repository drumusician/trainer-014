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

    func testDeLinkVanHetTeamGaatOverGeenEnkelKind() throws {
        let pagina = try JSONDecoder().decode(Volgen.Pagina.self, from: Data(#"{"team":"JO14-1","kind":null,"seizoen":"2026/27","wedstrijden":[],"trainingen":[]}"#.utf8))
        XCTAssertNil(pagina.kind)
        XCTAssertEqual(pagina.naam, "JO14-1", "dan heet wat je volgt naar het team")
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

    // MARK: - je kind en de taken

    /// De link van het team, met een wedstrijd die komt en drie taken.
    final class TeamServer: @unchecked Sendable {
        private let slot = NSLock()
        private var _vragen: [(String, [String: String])] = []
        var vragen: [(String, [String: String])] { slot.withLock { _vragen } }
        var antwoord = "true"

        var verkeer: Volgen.Verkeer {
            { [self] functie, inhoud in
                slot.withLock { _vragen.append((functie, inhoud)) }
                guard functie == "volgpagina" else { return Data(antwoord.utf8) }
                let mijn = inhoud["p_token"] != nil ? #"{"id":"s1","naam":"Sem"}"# : "null"
                return Data("""
                {"team":"JO14-1","kind":null,"mijn_kind":\(mijn),"spelers":[{"id":"s1","naam":"Sem"},{"id":"s2","naam":"Noah"}],
                 "seizoen":"2026/27","trainingen":[],
                 "wedstrijden":[{"id":"w1","datum":"2026-10-25","aanvang":"10:30","tegenstander":"Ajax","thuis":true,"status":"gepland","voor":null,"tegen":null,
                   "taken":[{"id":"t1","soort":"limonade","wie":"Sem","van_mij":true},{"id":"t2","soort":"rijden","wie":null,"van_mij":false}]}]}
                """.utf8)
            }
        }
    }

    private func maakTeam(_ server: TeamServer) -> Volgen {
        let v = Volgen(verkeer: server.verkeer, opslag: UserDefaults(suiteName: "volgen-team-\(UUID().uuidString)")!)
        v.vraagMeldingen = {}
        return v
    }

    func testMetDeTeamlinkKiesJeJeKindEnGaatDieKeuzeMeeNaarDeServer() async throws {
        let server = TeamServer()
        let volgen = maakTeam(server)
        _ = await volgen.voegToe("teamlink-jo14-0123456789")
        XCTAssertTrue(try XCTUnwrap(volgen.kinderen.first?.pagina).kindKiezen, "zonder adres weet de server nog niet wie je bent")

        // Kiezen kan al voordat er een adres voor meldingen is; dat gaat later mee.
        await volgen.kiesKind("teamlink-jo14-0123456789", "s1")
        XCTAssertFalse(server.vragen.contains { $0.0 == "kies_kind" })
        await volgen.zetToken(Data([0xab, 0x01]))
        let aangemeld = try XCTUnwrap(server.vragen.last { $0.0 == "volg" })
        XCTAssertEqual(aangemeld.1["p_speler"], "s1")

        // Met een adres gaat een andere keuze meteen naar de server.
        await volgen.kiesKind("teamlink-jo14-0123456789", "s2")
        let gekozen = try XCTUnwrap(server.vragen.last { $0.0 == "kies_kind" })
        XCTAssertEqual(gekozen.1, ["p_code": "teamlink-jo14-0123456789", "p_token": "ab01", "p_speler": "s2"])
        XCTAssertEqual(server.vragen.last { $0.0 == "volgpagina" }?.1["p_token"], "ab01")
    }

    func testDeTakenStaanBijDeWedstrijdEnJeKuntErIetsMeeDoen() async throws {
        let server = TeamServer()
        let volgen = maakTeam(server)
        _ = await volgen.voegToe("teamlink-jo14-0123456789")
        await volgen.zetToken(Data([0xab, 0x01]))
        await volgen.ververs()
        let w = try XCTUnwrap(volgen.kinderen.first?.pagina?.wedstrijden.first)
        XCTAssertEqual(w.aanvang, "10:30")
        XCTAssertEqual(w.taken.map(\.woord), ["Limonade", "Rijden"])
        XCTAssertTrue(w.taken[0].vanMij)
        XCTAssertNil(w.taken[1].wie)

        await volgen.kanNiet("teamlink-jo14-0123456789", "t1")
        XCTAssertEqual(server.vragen.last { $0.0 == "taak_kan_niet" }?.1, ["p_code": "teamlink-jo14-0123456789", "p_token": "ab01", "p_taak": "t1"])
        XCTAssertNil(volgen.melding)

        server.antwoord = "false"
        await volgen.doeIk("teamlink-jo14-0123456789", "t2")
        XCTAssertEqual(server.vragen.last { $0.0 == "taak_doe_ik" }?.1["p_taak"], "t2")
        XCTAssertEqual(volgen.melding, "Iemand anders was je net voor.")
    }

    func testZonderAdresVoorMeldingenKanEenTaakNiet() async {
        let server = TeamServer()
        let volgen = maakTeam(server)
        _ = await volgen.voegToe("teamlink-jo14-0123456789")
        await volgen.kanNiet("teamlink-jo14-0123456789", "t1")
        XCTAssertFalse(server.vragen.contains { $0.0 == "taak_kan_niet" })
        XCTAssertNotNil(volgen.melding)
    }

    /// Een server van vóór het programma stuurt geen kenmerk en geen taken.
    func testEenOudeServerWerktNog() throws {
        let pagina = try JSONDecoder().decode(Volgen.Pagina.self, from: Data(#"{"team":"JO14-1","kind":"Sem","wedstrijden":[{"datum":"2026-09-12","tegenstander":"Sparta","thuis":false,"status":"gepland","voor":null,"tegen":null}],"trainingen":[]}"#.utf8))
        XCTAssertEqual(pagina.wedstrijden.first?.taken, [])
        XCTAssertFalse(pagina.kindKiezen)
    }
}
