import Foundation

/* The web app is the specification, and it runs on JavaScript. These helpers
   pin down the handful of places where JavaScript and Swift would otherwise
   quietly disagree: rounding, sort stability, string order, truthiness. */

/** Math.round: halves go up, also below zero. Swift's rounded() goes away from zero. */
func jsRound(_ x: Double) -> Double {
	(x + 0.5).rounded(.down)
}

/** A number the way JavaScript prints it inside a string: 25, not 25.0. */
func jsGetal(_ d: Double) -> String {
	if d.isNaN { return "NaN" }
	if d.isInfinite { return d < 0 ? "-Infinity" : "Infinity" }
	if d == d.rounded(), abs(d) < 9e15 { return String(Int64(d)) }
	return "\(d)"
}

private let nederlands = Locale(identifier: "nl_NL")

/** String.localeCompare: -1, 0 or 1. */
func localeCompare(_ a: String, _ b: String) -> Double {
	switch a.compare(b, options: [], range: nil, locale: nederlands) {
	case .orderedAscending: return -1
	case .orderedDescending: return 1
	case .orderedSame: return 0
	}
}

/** The first comparison that decides, like `a || b || c` in a sort callback. */
func eersteVerschil(_ verschillen: Double...) -> Double {
	verschillen.first { $0 != 0 } ?? 0
}

extension Array {
	/** Array.sort with a comparator: stable, as JavaScript guarantees and Swift does not. */
	func jsSorted(_ vergelijk: (Element, Element) -> Double) -> [Element] {
		enumerated()
			.sorted { a, b in
				let v = vergelijk(a.element, b.element)
				return v < 0 || (v == 0 && a.offset < b.offset)
			}
			.map(\.element)
	}
}

extension String {
	/** String.trim */
	func jsTrim() -> String {
		trimmingCharacters(in: .whitespacesAndNewlines)
	}
}

extension Optional where Wrapped == String {
	/** Truthiness of `string | null | undefined`: an empty string counts as nothing. */
	var gevuld: String? {
		switch self {
		case .some(let s) where !s.isEmpty: return s
		default: return nil
		}
	}
}
