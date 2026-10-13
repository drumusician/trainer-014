import BlaadjeKern
import XCTest
@testable import Blaadje

/// Wat er op het vergrendelscherm hoort te staan, per moment van de wedstrijd.
@MainActor
final class VergrendelklokTests: XCTestCase {
    func testZonderWedstrijdOfVoorDeAftrapStaatErNiets() {
        let app = AppModel(bestand: nil, toestand: Proefstand.team())
        XCTAssertNil(Vergrendelklok.stand(app.toestand, nu: app.nu))
        app.nieuweWedstrijd(tegenstander: "Sparta", thuis: true)
        XCTAssertNil(Vergrendelklok.stand(app.toestand, nu: app.nu), "klaargezet is nog geen wedstrijd")
    }

    func testTijdensDeWedstrijdTeltDeKlokVanafDeAftrap() throws {
        let app = AppModel(bestand: nil, toestand: Proefstand.team())
        app.nieuweWedstrijd(tegenstander: "Sparta", thuis: false)
        app.startOfPauzeer()
        app.doelpunt("p9")
        // Tien minuten later.
        let nu = app.nu + 600_000
        let s = try XCTUnwrap(Vergrendelklok.stand(app.toestand, nu: nu))
        XCTAssertEqual([s.links, s.rechts], ["Sparta", "JO14-1"], "uit: de thuisploeg staat links")
        XCTAssertEqual([s.standLinks, s.standRechts], [0, 1])
        XCTAssertEqual(s.deel, "1e helft")
        XCTAssertTrue(s.loopt)
        XCTAssertEqual(Date(timeIntervalSince1970: nu / 1000).timeIntervalSince(s.begin), 600, accuracy: 1)
    }

    func testInDeRustStaatDeKlokStilEnNaAfloopIsHijWeg() throws {
        let app = AppModel(bestand: nil, toestand: Proefstand.team())
        app.nieuweWedstrijd(tegenstander: "Sparta", thuis: true)
        app.startOfPauzeer()
        app.volgendDeelOfRust()
        let s = try XCTUnwrap(Vergrendelklok.stand(app.toestand, nu: app.nu + 300_000))
        XCTAssertEqual(s.deel, "Rust")
        XCTAssertFalse(s.loopt)
        XCTAssertLessThan(s.verstreken, 2, "in de rust loopt de tijd niet door")

        app.sluitAf()
        XCTAssertNil(Vergrendelklok.stand(app.toestand, nu: app.nu))
    }

    func testEenPaarMillisecondenVerschilIsGeenNieuws() throws {
        let app = AppModel(bestand: nil, toestand: Proefstand.team())
        app.nieuweWedstrijd(tegenstander: "Sparta", thuis: true)
        app.startOfPauzeer()
        let a = try XCTUnwrap(Vergrendelklok.stand(app.toestand, nu: app.nu + 1000))
        var b = a
        b.begin = a.begin.addingTimeInterval(0.004)
        XCTAssertTrue(Vergrendelklok.zelfde(a, b))
        b.standLinks = 1
        XCTAssertFalse(Vergrendelklok.zelfde(a, b), "een doelpunt hoort er meteen op te staan")
    }
}
