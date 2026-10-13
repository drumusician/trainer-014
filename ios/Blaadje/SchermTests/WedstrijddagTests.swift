import XCTest

/// Bedient de app zoals een trainer langs de lijn dat doet, van aftrap tot archief.
final class WedstrijddagTests: XCTestCase {
    private var app: XCUIApplication!

    override func setUp() {
        continueAfterFailure = false
        app = XCUIApplication()
    }

    /// Schermafdrukken komen in de map uit PROEF_BEELDEN, als die gezet is.
    private func beeld(_ naam: String) {
        guard let map = ProcessInfo.processInfo.environment["PROEF_BEELDEN"] else { return }
        try? XCUIScreen.main.screenshot().pngRepresentation.write(to: URL(fileURLWithPath: map).appendingPathComponent("\(naam).png"))
    }

    func testEenWedstrijdVanAftrapTotArchief() {
        app.launchArguments = ["-proef-team"]
        app.launch()

        app.buttons["Nieuwe wedstrijd"].tap()
        let veld = app.textFields["Tegenstander"]
        XCTAssertTrue(veld.waitForExistence(timeout: 5))
        veld.typeText("Sparta")
        app.buttons["Begin"].tap()

        // Wie is er? Joep is ziek. Hij staat onderaan de lijst.
        XCTAssertTrue(app.buttons["Sem, aanwezig"].waitForExistence(timeout: 5))
        beeld("1-wie-is-er")
        app.swipeUp()
        XCTAssertTrue(app.buttons["Joep, aanwezig"].waitForExistence(timeout: 5))
        app.buttons["Joep, aanwezig"].tap()
        XCTAssertTrue(app.buttons["Joep, afwezig"].exists)
        XCTAssertTrue(app.staticTexts["13 van de 14 zijn er."].exists)
        app.buttons["Naar de opstelling"].tap()

        // De standaardopstelling staat er al; Joep zit niet op de bank.
        XCTAssertTrue(app.buttons["K: Sem"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.buttons["Bank: Stijn"].exists)
        XCTAssertFalse(app.buttons["Bank: Joep"].exists)
        beeld("2-opstelling")
        app.buttons["Naar de wedstrijd"].tap()

        XCTAssertTrue(app.buttons["Aftrap"].waitForExistence(timeout: 5))
        beeld("3-voor-de-aftrap")
        app.buttons["Aftrap"].tap()
        XCTAssertTrue(app.buttons["Pauze"].waitForExistence(timeout: 5))

        // Een wissel: Thijs eruit, Stijn erin. Twee tikken.
        app.buttons["SP: Thijs"].tap()
        sleep(1)
        beeld("4-speler-gekozen")
        app.buttons["Bank: Stijn"].tap()
        XCTAssertTrue(app.buttons["SP: Stijn"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.buttons["Bank: Thijs"].exists)

        // Een doelpunt van Ruben, zonder assist.
        app.buttons["Doelpunt"].tap()
        app.buttons["RB: Ruben"].tap()
        XCTAssertTrue(app.buttons["Geen assist"].waitForExistence(timeout: 5))
        app.buttons["Geen assist"].tap()
        XCTAssertTrue(app.staticTexts["1 – 0"].exists)

        // En een tegen, die we terugdraaien.
        app.buttons["Tegen"].tap()
        XCTAssertTrue(app.staticTexts["1 – 1"].waitForExistence(timeout: 5))
        app.buttons["Tegendoelpunt terugdraaien"].tap()
        XCTAssertTrue(app.staticTexts["1 – 0"].waitForExistence(timeout: 5))
        beeld("5-tijdens-de-wedstrijd")

        // Twee plekken na elkaar: die ruilen.
        app.buttons["K: Sem"].tap()
        app.buttons["LV: Bram"].tap()
        XCTAssertTrue(app.buttons["K: Bram"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.buttons["LV: Sem"].exists)

        app.buttons["Meer opties"].tap()
        app.buttons["Wedstrijd afsluiten"].tap()
        app.buttons["Afsluiten"].tap()

        // Afgelopen: de uitslag, wie speelde, en wie er niet was.
        XCTAssertTrue(app.buttons["Bewaar in het archief"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["1 – 0"].exists)
        XCTAssertTrue(app.staticTexts["Stijn"].exists || app.staticTexts["Sem"].exists)
        beeld("6-afgelopen")
        app.swipeUp()
        XCTAssertTrue(app.staticTexts["Joep"].waitForExistence(timeout: 5), "wie er niet was hoort apart te staan")
        app.buttons["Bewaar in het archief"].tap()

        // Terug op het beginscherm, met het seizoen erbij.
        XCTAssertTrue(app.buttons["Nieuwe wedstrijd"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["Dit seizoen"].exists)
        beeld("7-begin-na-afloop")
        app.tabBars.buttons["Seizoen"].tap()
        let bewaard = app.buttons.containing(NSPredicate(format: "label CONTAINS %@", "JO14-1 – Sparta")).firstMatch
        XCTAssertTrue(bewaard.waitForExistence(timeout: 5), "de bewaarde wedstrijd hoort bij Seizoen te staan")
        XCTAssertTrue(bewaard.label.contains("1 – 0"))
        beeld("8-seizoen")

        // Terugkijken, en een doelpunt bijwerken dat je langs de lijn miste.
        bewaard.tap()
        XCTAssertTrue(app.buttons["Bijwerken"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.buttons["SP: Thijs"].exists, "de opstelling bij de aftrap hoort terug te rekenen te zijn")
        beeld("9-bewaard")
        app.buttons["Bijwerken"].tap()
        app.swipeUp()
        let minuut = app.textFields["Minuut"]
        XCTAssertTrue(minuut.waitForExistence(timeout: 5))
        minuut.tap()
        minuut.typeText("20")
        app.buttons["Tegen"].tap()
        beeld("9-bijwerken")
        app.buttons["Voeg doelpunt toe"].tap()
        app.swipeDown()
        app.swipeDown()
        XCTAssertTrue(app.staticTexts["1 – 1"].waitForExistence(timeout: 5), "de stand telt opnieuw na een doelpunt erbij")
    }

    func testDeKlokStaatBuitenDeApp() {
        app.launchArguments = ["-proef-team", "-proef-klok"]
        app.launch()

        app.buttons["Nieuwe wedstrijd"].tap()
        XCTAssertTrue(app.buttons["Begin"].waitForExistence(timeout: 5))
        app.textFields["Tegenstander"].typeText("Sparta")
        app.buttons["Begin"].tap()
        app.buttons["Naar de opstelling"].tap()
        app.buttons["Naar de wedstrijd"].tap()
        XCTAssertTrue(app.buttons["Aftrap"].waitForExistence(timeout: 5))
        app.buttons["Aftrap"].tap()
        app.buttons["Doelpunt"].tap()
        app.buttons["Weet ik niet"].tap()

        // De app uit beeld: de stand en de klok horen bovenin te blijven staan.
        XCUIDevice.shared.press(.home)
        let buiten = XCUIApplication(bundleIdentifier: "com.apple.springboard")
        let stand = buiten.staticTexts["1–0"]
        XCTAssertTrue(stand.waitForExistence(timeout: 10), "de stand hoort buiten de app zichtbaar te zijn")
        beeld("k1-eiland")
        stand.press(forDuration: 1.2)
        sleep(2)
        beeld("k2-eiland-open")

        // Terug in de app en afsluiten: dan hoort hij weg te zijn.
        XCUIDevice.shared.press(.home)
        sleep(2)
        app.activate()
        XCTAssertTrue(app.buttons["Meer opties"].waitForExistence(timeout: 10))
        sleep(1)
        app.buttons["Meer opties"].tap()
        XCTAssertTrue(app.buttons["Wedstrijd afsluiten"].waitForExistence(timeout: 5))
        app.buttons["Wedstrijd afsluiten"].tap()
        app.buttons["Afsluiten"].tap()
        XCTAssertTrue(app.buttons["Bewaar in het archief"].waitForExistence(timeout: 5))
        XCUIDevice.shared.press(.home)
        sleep(2)
        XCTAssertFalse(buiten.staticTexts["1–0"].exists, "na het laatste fluitsignaal hoort de klok weg te zijn")
    }

    func testHetToetsenbordGaatWeerWeg() {
        app.launchArguments = ["-proef-team"]
        app.launch()

        app.tabBars.buttons["Meer"].tap()
        let code = app.textViews["Of plak hier een overzetcode"].exists
            ? app.textViews["Of plak hier een overzetcode"] : app.textFields["Of plak hier een overzetcode"]
        XCTAssertTrue(code.waitForExistence(timeout: 5))
        code.tap()
        code.typeText("geen echte code")
        XCTAssertTrue(app.keyboards.firstMatch.exists)
        beeld("m1-toetsenbord")

        // Een veld van meer regels heeft geen toets om te sluiten: dan de knop erboven.
        app.toolbars.buttons["Klaar"].tap()
        XCTAssertTrue(app.keyboards.firstMatch.waitForNonExistence(timeout: 5), "het toetsenbord hoort weg te kunnen")
        XCTAssertTrue(app.tabBars.buttons["Team"].isHittable, "anders kom je niet meer bij de andere schermen")

        // Een code die niet klopt: dat zeggen, en het toetsenbord blijft weg.
        app.buttons["Lees de code in"].tap()
        XCTAssertTrue(app.alerts["Dat lukte niet"].waitForExistence(timeout: 5))
        app.alerts.buttons["Oké"].tap()
        XCTAssertTrue(app.keyboards.firstMatch.waitForNonExistence(timeout: 5))
    }

    func testEenTrainingBijhouden() {
        app.launchArguments = ["-proef-team"]
        app.launch()

        app.tabBars.buttons["Trainingen"].tap()
        beeld("t1-leeg")
        app.buttons["Training van vandaag"].tap()
        XCTAssertTrue(app.buttons["Sem, aanwezig"].waitForExistence(timeout: 5))
        app.buttons["Noah, aanwezig"].tap()
        XCTAssertTrue(app.buttons["Noah, afgemeld"].waitForExistence(timeout: 5))
        app.buttons["Luuk, aanwezig"].tap()
        app.buttons["Luuk, afgemeld"].tap()
        XCTAssertTrue(app.buttons["Luuk, niet gekomen"].waitForExistence(timeout: 5))
        beeld("t2-training")
        app.navigationBars.buttons.firstMatch.tap()

        let regel = app.staticTexts["12 aanwezig, 1 afgemeld, 1 niet gekomen"]
        XCTAssertTrue(regel.waitForExistence(timeout: 5), "de lijst hoort te tellen wie er was")
        beeld("t3-lijst")
    }

    func testEenWisselUitHetPlan() {
        app.launchArguments = ["-proef-team"]
        app.launch()

        app.buttons["Nieuwe wedstrijd"].tap()
        XCTAssertTrue(app.buttons["Begin"].waitForExistence(timeout: 5))
        app.buttons["Begin"].tap()
        XCTAssertTrue(app.buttons["Naar de opstelling"].waitForExistence(timeout: 5))
        app.buttons["Naar de opstelling"].tap()

        // Vooraf: wie zat er al veel op de bank, en wat weten we al over de rust.
        XCTAssertTrue(app.buttons["Bank tot nu toe"].waitForExistence(timeout: 5))
        beeld("p1-opstelling")
        app.buttons["Bank tot nu toe"].tap()
        XCTAssertTrue(app.staticTexts["nu op de bank"].firstMatch.waitForExistence(timeout: 5))
        beeld("p2-bank")
        app.buttons["Klaar"].tap()

        app.buttons["Wisselplan"].tap()
        XCTAssertTrue(app.staticTexts["Nog niets gepland."].waitForExistence(timeout: 5))
        app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Eruit")).firstMatch.tap()
        app.buttons["Thijs (SP)"].tap()
        app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Erin")).firstMatch.tap()
        app.buttons["Stijn"].tap()
        app.buttons["Zet in het plan"].tap()
        XCTAssertTrue(app.staticTexts["Stijn voor Thijs (SP)"].waitForExistence(timeout: 5))
        beeld("p3-plan")
        app.buttons["Klaar"].tap()

        app.buttons["Naar de wedstrijd"].tap()
        XCTAssertTrue(app.buttons["Aftrap"].waitForExistence(timeout: 5))
        app.buttons["Aftrap"].tap()
        XCTAssertFalse(app.buttons["Wissel"].exists, "in minuut 0 hoef je nog niet te lezen wat er in de rust gebeurt")

        // Rust: nu staat de stap onder het veld, en één tik voert hem uit.
        app.buttons["Einde 1e helft"].tap()
        XCTAssertTrue(app.buttons["Wissel"].waitForExistence(timeout: 5))
        beeld("p4-rust")
        app.buttons["Wissel"].tap()
        XCTAssertTrue(app.buttons["SP: Stijn"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.buttons["Bank: Thijs"].exists)
        XCTAssertFalse(app.buttons["Wissel"].exists, "een gedane stap hoort weg te zijn")
    }

    func testEenNieuwTeamOpzetten() {
        app.launchArguments = ["-proef-leeg"]
        app.launch()

        app.buttons["Aan de slag"].tap()
        let naam = app.textFields["Bijvoorbeeld JO14-1"]
        XCTAssertTrue(naam.waitForExistence(timeout: 5))
        naam.tap()
        naam.typeText("JO11-2")
        let namen = app.textViews["Eén naam per regel"].exists ? app.textViews["Eén naam per regel"] : app.textFields["Eén naam per regel"]
        namen.tap()
        namen.typeText("Anna\nBo\nCas\n")
        beeld("0-aan-de-slag")
        app.buttons["Klaar"].tap()

        XCTAssertTrue(app.buttons["Nieuwe wedstrijd"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["JO11-2"].exists)
        app.tabBars.buttons["Team"].tap()
        XCTAssertTrue(app.staticTexts["Anna"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["Cas"].exists)
        beeld("0-team")
    }
}
