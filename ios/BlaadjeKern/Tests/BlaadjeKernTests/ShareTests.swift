import Testing
@testable import BlaadjeKern

/*
 * Er moet altijd een weg zijn. Een trainer die op 'delen' drukt en niets ziet
 * gebeuren, probeert het niet nog een keer.
 */
private actor Gezien {
	var gedeeld: [(title: String?, text: String)] = []
	var gekopieerd: [String] = []

	func deel(_ title: String?, _ text: String) { gedeeld.append((title: title, text: text)) }
	func kopieer(_ text: String) { gekopieerd.append(text) }
}

private struct Afgebroken: Error {}

@Suite("iets doorgeven aan een ander")
struct DelenTests {
	@Test("gebruikt het deelvenster van het toestel als dat er is")
	func deelvenster() async {
		let gezien = Gezien()
		let n = Deelbaar(share: { await gezien.deel($0, $1) }, writeText: { await gezien.kopieer($0) })
		#expect(await deel("de uitleg", "Blaadje", via: n) == .gedeeld)
		let gedeeld = await gezien.gedeeld
		#expect(gedeeld.count == 1)
		#expect(gedeeld.first?.title == "Blaadje")
		#expect(gedeeld.first?.text == "de uitleg")
		#expect(await gezien.gekopieerd.isEmpty)
	}

	/* Een laptop heeft dat venster meestal niet. */
	@Test("valt terug op het klembord")
	func klembord() async {
		let gezien = Gezien()
		let n = Deelbaar(writeText: { await gezien.kopieer($0) })
		#expect(await deel("de uitleg", via: n) == .gekopieerd)
		#expect(await gezien.gekopieerd == ["de uitleg"])
	}

	/* Wie het deelvenster wegtikt wil de tekst misschien nog steeds. */
	@Test("kopieert alsnog als je het deelvenster wegtikt")
	func weggetikt() async {
		let gezien = Gezien()
		let n = Deelbaar(share: { _, _ in throw Afgebroken() }, writeText: { await gezien.kopieer($0) })
		#expect(await deel("de uitleg", via: n) == .gekopieerd)
		#expect(await gezien.gekopieerd.count == 1)
	}

	/* En lukt er helemaal niets, dan zegt hij dat, zodat het scherm de tekst kan
	   laten zien om met de hand te pakken. */
	@Test("zegt het als de trainer het zelf moet doen")
	func zelf() async {
		#expect(await deel("de uitleg", via: Deelbaar()) == .zelf)
		#expect(await deel("de uitleg", via: nil) == .zelf)
		#expect(await deel("de uitleg", via: Deelbaar(writeText: { _ in throw Afgebroken() })) == .zelf)
	}
}
