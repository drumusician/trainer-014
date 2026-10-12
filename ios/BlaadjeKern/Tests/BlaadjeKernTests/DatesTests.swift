import Testing
@testable import BlaadjeKern

@Suite("datums")
struct DatumsTests {
	@Test("schrijft ze zoals je ze zegt")
	func zoalsJeZeZegt() {
		#expect(shortDate("2026-09-04") == "4 sep")
		#expect(datumMetJaar("2026-09-04") == "4 september 2026")
	}

	@Test("rekent niet met tijdzones mis rond middernacht")
	func middernacht() {
		#expect(shortDate("2026-01-01") == "1 jan")
		#expect(shortDate("2026-12-31") == "31 dec")
	}

	@Test("laat onzin met rust in plaats van te klagen")
	func onzin() {
		#expect(shortDate("") == "")
		#expect(shortDate("geen datum") == "geen datum")
	}

	/* Toegevoegd bij de overzetting naar Swift: de dag van de week wordt hier zelf
	   uitgerekend in plaats van aan het toestel gevraagd. */
	@Test("weet welke dag van de week het was")
	func weekdag() {
		#expect(dateText("2026-09-06") == "zondag 6 september")
		#expect(dateText("2026-09-05") == "zaterdag 5 september")
		#expect(dateText("2024-02-29") == "donderdag 29 februari")
		#expect(dateText("2000-01-01") == "zaterdag 1 januari")
	}
}
