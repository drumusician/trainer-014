import Testing
@testable import BlaadjeKern

@Suite("formaties")
struct FormatiesTests {
	@Test("heeft precies zoveel plekken als de speelvorm zegt")
	func aantalPlekken() {
		let verwacht: [String: Int] = [
			"11 tegen 11": 11,
			"8 tegen 8": 8,
			"6 tegen 6": 6,
			"4 tegen 4": 4,
		]
		for s in FORMATS {
			for f in s.formaties {
				#expect(positionCount(f.sleutel) == verwacht[s.name], "\(f.sleutel)")
			}
		}
	}

	@Test("kent elke formatie uit het menu, en geen enkele blijft ongenoemd")
	func menu() {
		let inMenu = alleFormaties()
		#expect(Set(inMenu).count == inMenu.count)
		#expect(inMenu.sorted() == FORMATIONS.keys.sorted())
	}

	@Test("geeft elke plek een eigen id")
	func eigenId() {
		for (name, lijst) in FORMATIONS.entries {
			let ids = lijst.map(\.id)
			#expect(Set(ids).count == ids.count, "\(name)")
		}
	}

	@Test("zet iedereen binnen het veld")
	func binnenHetVeld() {
		for (name, lijst) in FORMATIONS.entries {
			for p in lijst {
				#expect(p.x >= 10, "\(name) \(p.id)")
				#expect(p.x <= 90, "\(name) \(p.id)")
				#expect(p.y >= 10, "\(name) \(p.id)")
				#expect(p.y <= 95, "\(name) \(p.id)")
			}
		}
	}

	@Test("heeft een keeper, behalve bij 4 tegen 4")
	func keeper() {
		for s in FORMATS {
			for f in s.formaties {
				let heeftKeeper = positionsOf(f.sleutel).contains { $0.line == .K }
				#expect(heeftKeeper == (s.name != "4 tegen 4"), "\(f.sleutel)")
				#expect(linesIn(f.sleutel).contains(.K) == (s.name != "4 tegen 4"), "\(f.sleutel)")
			}
		}
	}

	@Test("weet bij welke speelvorm een formatie hoort")
	func speelvorm() {
		#expect(formatOf("4-4-2 diamond") == "11 tegen 11")
		#expect(formatOf("1-3-3-1") == "8 tegen 8")
		#expect(formatOf("1-2-2-1") == "6 tegen 6")
		#expect(formatOf("4-3-3") == "11 tegen 11")
		#expect(formatOf("bestaat-niet") == "")
	}
}
