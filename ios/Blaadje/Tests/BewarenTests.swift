import BlaadjeKern
import SwiftUI
import XCTest
@testable import Blaadje

/// Wat de app bewaart, moet er na afsluiten nog staan. Langs de lijn sluit iOS
/// een app zonder waarschuwing af; dan mag er geen wissel zoek zijn.
@MainActor
final class BewarenTests: XCTestCase {
    private var bestand: URL!

    override func setUp() {
        bestand = FileManager.default.temporaryDirectory.appendingPathComponent("blaadje-test-\(UUID().uuidString).json")
    }

    override func tearDown() {
        try? FileManager.default.removeItem(at: bestand)
    }

    func testEenLopendeWedstrijdStaatErNaOpnieuwOpenenNog() {
        let eerst = AppModel(bestand: bestand, toestand: Proefstand.team())
        eerst.nieuweWedstrijd(tegenstander: "Sparta", thuis: false)
        eerst.startOfPauzeer()
        eerst.gekozenPlek = "SP"
        eerst.brengIn("p12")
        eerst.doelpunt("p9")

        let daarna = AppModel(bestand: bestand)
        XCTAssertEqual(daarna.toestand, eerst.toestand)
        XCTAssertEqual(daarna.match?.opponent, "Sparta")
        XCTAssertEqual(daarna.match?.lineup["SP"], "p12")
        XCTAssertEqual(daarna.stand.voor, 1)
        XCTAssertTrue(daarna.afgetrapt)
        XCTAssertEqual(daarna.match?.running, true, "de klok loopt door terwijl de app dicht was")
    }

    func testAlleenEenTikVanDeTrainerGaatNaarDeServer() {
        let app = AppModel(bestand: bestand, toestand: Proefstand.team())
        var seintjes = 0
        app.naBewaren = { seintjes += 1 }

        app.nieuweWedstrijd(tegenstander: "Sparta", thuis: true)
        XCTAssertEqual(seintjes, 1)
        XCTAssertEqual(app.match?.id?.count, 36, "een wedstrijd krijgt een vast kenmerk")
        app.voegSpelersToe("Nieuw")
        XCTAssertEqual(app.spelers.last?.id.count, 36, "een nieuwe speler krijgt meteen het kenmerk dat de server wil")
        XCTAssertEqual(seintjes, 2)

        // Wat van de server komt wordt bewaard, maar gaat niet terug naar de server.
        var vanServer = app.toestand
        vanServer.teamName = "JO14-2"
        app.neemOver(vanServer)
        XCTAssertEqual(seintjes, 2, "anders stuiteren twee toestellen eindeloos heen en weer")
        XCTAssertEqual(AppModel(bestand: bestand).toestand.teamName, "JO14-2")
    }

    func testEenBewaardeWedstrijdHoudtZijnKenmerk() {
        let app = AppModel(bestand: bestand, toestand: Proefstand.team())
        app.nieuweWedstrijd(tegenstander: "Sparta", thuis: true)
        let kenmerk = app.match?.id
        app.startOfPauzeer()
        app.sluitAf()
        app.bewaarInArchief()
        XCTAssertNotNil(kenmerk)
        XCTAssertEqual(app.toestand.archive.first?.id, kenmerk, "op de server is het dezelfde rij, die van 'bezig' naar 'afgelopen' gaat")
    }

    func testZonderBestandBegintDeAppLeeg() {
        let app = AppModel(bestand: bestand)
        XCTAssertTrue(app.spelers.isEmpty)
        XCTAssertNil(app.match)
    }

    func testEenOnleesbaarBestandWordtOpzijGezetEnNietOverschreven() throws {
        try "dit is geen blaadje".write(to: bestand, atomically: true, encoding: .utf8)
        let app = AppModel(bestand: bestand)
        XCTAssertTrue(app.spelers.isEmpty)
        app.voegSpelersToe("Anna")

        let map = bestand.deletingLastPathComponent()
        let opzij = try FileManager.default.contentsOfDirectory(at: map, includingPropertiesForKeys: nil)
            .filter { $0.lastPathComponent.hasPrefix("blaadje-onleesbaar-") }
        defer { opzij.forEach { try? FileManager.default.removeItem(at: $0) } }
        XCTAssertTrue(opzij.contains { (try? String(contentsOf: $0, encoding: .utf8)) == "dit is geen blaadje" },
                      "wat er stond is weg, terwijl het opzij gezet had moeten zijn")
        XCTAssertEqual(AppModel(bestand: bestand).spelers.map(\.name), ["Anna"])
    }

    func testEenBackUpVanHetWebKomtErin() throws {
        let web = AppModel(bestand: nil, toestand: Proefstand.team())
        let backup = web.maakBackup()

        let app = AppModel(bestand: bestand)
        _ = try app.leesIn(backup)
        XCTAssertEqual(app.toestand.teamName, "JO14-1")
        XCTAssertEqual(app.spelers.count, 14)
        XCTAssertEqual(app.toestand.defaultLineup?.lineup["K"], "p1")

        XCTAssertThrowsError(try app.leesIn("zomaar wat tekst"))
        XCTAssertEqual(app.spelers.count, 14, "een mislukte poging laat staan wat er stond")
    }

    func testHetVeldPastNaastDeBankOpElkScherm() {
        // iPhone SE, iPhone 17, iPhone Pro Max, iPad: breedte en hoogte van het vak voor veld en bank.
        for (b, h) in [(355.0, 363.0), (382.0, 560.0), (420.0, 640.0), (800.0, 900.0)] as [(CGFloat, CGFloat)] {
            let m = VeldMetBank<EmptyView, EmptyView>.maten(breedte: b, hoogte: h)
            XCTAssertLessThanOrEqual(m.hoog, h + 0.5, "het veld is hoger dan het scherm bij \(b)×\(h)")
            XCTAssertLessThanOrEqual(m.veld + m.bank + 10, b + 0.5, "veld en bank passen niet naast elkaar bij \(b)×\(h)")
            XCTAssertGreaterThanOrEqual(m.bank, 92, "de bank is te smal voor een naam bij \(b)×\(h)")
            XCTAssertGreaterThanOrEqual(m.hoog, m.veld * 1.6 - 0.5, "het veld is platter dan een veld bij \(b)×\(h)")
            XCTAssertLessThanOrEqual(m.hoog, m.veld * 1.9 + 0.5, "het veld is te ver uitgerekt bij \(b)×\(h)")
            XCTAssertGreaterThan(m.veld, 200, "het veld is te klein om op te tikken bij \(b)×\(h)")
        }
    }
}
