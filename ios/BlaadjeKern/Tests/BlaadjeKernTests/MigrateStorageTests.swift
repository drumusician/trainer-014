import Testing
@testable import BlaadjeKern

/**
 * The conversion runs against a real export of a real season. That is the only
 * way to know it is right: an invented example contains exactly the cases you
 * thought of, and real storage contains the rest.
 */
@Suite("oude opslag omzetten")
struct OudeOpslagOmzettenTests {
	let oud: JSONValue
	let om: JSONValue

	init() throws {
		oud = try opgeslagen()
		om = migreerToestand(oud)
	}

	@Test("herkent het oude formaat, en het nieuwe niet als oud")
	func herkent() {
		#expect(isOudFormaat(oud) == true)
		#expect(isOudFormaat(om) == false)
		#expect(isOudFormaat(nil) == false)
		#expect(isOudFormaat(.null) == false)
	}

	@Test("zet de velden van de toestand om")
	func velden() throws {
		let o = try #require(om.objectValue)
		#expect(om["teamName"] == .string("JO13-1"))
		#expect(om["players"]?.arrayValue != nil)
		#expect(om["archive"]?.arrayValue != nil)
		#expect(!o.contains("teamnaam"))
		#expect(!o.contains("spelers"))
	}

	@Test("laat geen enkele Nederlandse veldnaam achter")
	func geenNederlands() {
		let nederlands: Set<String> = [
			"teamnaam",
			"spelers",
			"formatie",
			"helftMinuten",
			"delen",
			"wedstrijd",
			"standaard",
			"archief",
			"trainingen",
			"verslagWissels",
			"naam",
			"linie",
			"keept",
			"datum",
			"tegenstander",
			"thuis",
			"opstelling",
			"bank",
			"gebeurtenissen",
			"verstreken",
			"sinds",
			"loopt",
			"deel",
			"pauze",
			"afgelopen",
			"notitie",
			"bewaard",
			"afwezig",
			"speler",
			"eruit",
			"erin",
			"plek",
			"plekA",
			"plekB",
			"spelerA",
			"spelerB",
			"stand",
			"duur",
			"namen",
			"speeltijd",
			"seconden",
			"posities",
		]
		var gevonden = Set<String>()
		func loop(_ x: JSONValue) {
			switch x {
			case .array(let lijst): lijst.forEach(loop)
			case .object(let o):
				for (k, v) in o.entries {
					if nederlands.contains(k) { gevonden.insert(k) }
					loop(v)
				}
			default: break
			}
		}
		loop(om)
		#expect(gevonden == [])
	}

	@Test("zet ook de waarden om die als tekst zijn opgeslagen")
	func waarden() throws {
		let match = try #require(om["archive"]?.arrayValue?.first)
		let soorten = Set(try #require(match["events"]?.arrayValue).compactMap { $0["type"]?.stringValue })
		#expect(!soorten.contains("rust"))
		#expect(!soorten.contains("wissel"))
		#expect(!soorten.contains("ruil"))
		#expect(soorten.contains("break"))
		#expect(soorten.contains("substitution"))
		#expect(soorten.contains("swap"))
		#expect(match["formation"] == .string("4-4-2 diamond"))
	}

	@Test("hernoemt de enige plek met een Nederlandse code")
	func plek() throws {
		let match = try #require(om["archive"]?.arrayValue?.first)
		let plekken = try #require(match["lineup"]?.objectValue).keys
		#expect(plekken.contains("TEN"))
		#expect(!plekken.contains("TIEN"))
		let positions = try #require(match["playingTime"]?.arrayValue).flatMap { $0["positions"]?.objectValue?.keys ?? [] }
		#expect(!positions.isEmpty)
		#expect(!positions.contains("TIEN"))
	}

	@Test("houdt de cijfers precies gelijk")
	func cijfers() throws {
		/* The left-hand side reads the raw file, so those fields are still Dutch. */
		let oudeWedstrijd = try #require(oud["archief"]?.arrayValue?.first)
		let nieuw = try #require(om["archive"]?.arrayValue?.first)
		#expect(nieuw["duration"] == oudeWedstrijd["duur"])
		#expect(nieuw["duration"] != nil)
		#expect(nieuw["score"] == oudeWedstrijd["stand"])
		#expect(nieuw["events"]?.arrayValue?.count == oudeWedstrijd["gebeurtenissen"]?.arrayValue?.count)
		let somNieuw = try #require(nieuw["playingTime"]?.arrayValue).reduce(0.0) { $0 + ($1["seconds"]?.numberValue ?? 0) }
		let somOud = try #require(oudeWedstrijd["speeltijd"]?.arrayValue).reduce(0.0) { $0 + ($1["seconden"]?.numberValue ?? 0) }
		#expect(somNieuw == somOud)
		#expect(somNieuw > 0)
	}

	@Test("zet de aanwezigheid op een training om")
	func aanwezigheid() throws {
		var met = try #require(oud.objectValue)
		met["trainings"] = try JSONValue.parse(#"[{"id":"t1","date":"2026-09-01","status":{"p1":"ja","p2":"af","p3":"nee"}}]"#)
		let uit = migreerToestand(.object(met))
		let t = try #require(uit["trainings"]?.arrayValue?.first)
		#expect(t["status"] == (try JSONValue.parse(#"{"p1":"present","p2":"excused","p3":"absent"}"#)))
	}

	@Test("laat iets wat al omgezet is met rust")
	func alOmgezet() {
		#expect(migreerToestand(om) == om)
	}
}
