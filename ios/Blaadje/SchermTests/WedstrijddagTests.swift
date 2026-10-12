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
