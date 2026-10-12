import Foundation
import Testing
@testable import BlaadjeKern

/* De klok in de tests: een vast moment, zodat niets van de echte tijd afhangt. */
let NU: Double = 1_000_000

/**
 * A real export of a real season, with invented names in it. The structure is
 * untouched, because that is what matters. The same file the web app tests with.
 */
func opgeslagenTekst() throws -> String {
	let url = try #require(Bundle.module.url(forResource: "opslag-september-2026", withExtension: "json", subdirectory: "Fixtures"))
	return try String(contentsOf: url, encoding: .utf8)
}

func opgeslagen() throws -> JSONValue {
	try JSONValue.parse(opgeslagenTekst())
}

func som(_ d: OrderedDict<Double>) -> Double {
	d.values.reduce(0, +)
}

@Suite("opzet")
struct OpzetTests {
	@Test("vindt het bestand met de opslag van september 2026")
	func fixture() throws {
		#expect(try opgeslagen()["teamnaam"] == .string("JO13-1"))
	}
}
