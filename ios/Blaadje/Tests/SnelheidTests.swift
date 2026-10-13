import BlaadjeKern
import XCTest
@testable import Blaadje

/// Hoe lang duurt één tik langs de lijn, met een heel seizoen in het archief?
@MainActor
final class SnelheidTests: XCTestCase {
    /// Een seizoen: 30 bewaarde wedstrijden, 40 trainingen, en een wedstrijd die loopt.
    static func seizoen(bestand: URL?) -> AppModel {
        let app = AppModel(bestand: bestand, toestand: Proefstand.team())
        for i in 0..<30 {
            app.nieuweWedstrijd(tegenstander: "Tegenstander \(i)", thuis: i % 2 == 0)
            app.startOfPauzeer()
            for (plek, id) in [("SP", "p12"), ("MC", "p13"), ("LV", "p14"), ("SP", "p10"), ("MC", "p7"), ("LV", "p5")] {
                app.gekozenPlek = plek
                app.brengIn(id)
            }
            app.doelpunt("p9")
            app.tegendoelpunt()
            app.sluitAf()
            app.bewaarInArchief()
        }
        for _ in 0..<40 { _ = app.nieuweTraining() }
        app.nieuweWedstrijd(tegenstander: "Sparta", thuis: true)
        app.startOfPauzeer()
        return app
    }

    private func meet(_ wat: String, keer: Int = 20, _ doe: () -> Void) -> Double {
        let start = CFAbsoluteTimeGetCurrent()
        for _ in 0..<keer { doe() }
        let ms = (CFAbsoluteTimeGetCurrent() - start) / Double(keer) * 1000
        print("METING \(wat): \(String(format: "%.2f", ms)) ms")
        return ms
    }

    func testEenTikIsVlotOokMetEenHeelSeizoen() {
        let bestand = FileManager.default.temporaryDirectory.appendingPathComponent("blaadje-snelheid-\(UUID().uuidString).json")
        defer { try? FileManager.default.removeItem(at: bestand) }
        let app = Self.seizoen(bestand: bestand)
        print("METING grootte: \((try? Data(contentsOf: bestand).count) ?? 0) bytes")

        _ = meet("alleen de tekst maken") { _ = try? Opslag.schrijf(app.toestand) }
        _ = meet("speeltijden uitrekenen") { _ = app.speeltijden }
        var heen = true
        let tik = meet("een wissel, met bewaren") {
            app.gekozenPlek = "SP"
            app.brengIn(heen ? "p12" : "p10")
            heen.toggle()
        }
        _ = meet("opnieuw openen") { _ = AppModel(bestand: bestand) }
        // Onder de 16 ms merk je niets; boven de 100 voelt een tik stroef.
        XCTAssertLessThan(tik, 16, "een tik hoort binnen één beeldje klaar te zijn")
    }
}
