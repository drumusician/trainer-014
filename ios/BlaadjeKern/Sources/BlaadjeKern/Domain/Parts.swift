/**
 * A match runs in halves or in quarters. In Dutch youth football up to 8-a-side
 * the KNVB plays four quarters, and coaches substitute per quarter.
 */
private let RANGTELWOORD = ["", "1e", "2e", "3e", "4e"]

public func partName(_ part: Int, _ parts: Int) -> String {
	let soort = parts == 4 ? "kwart" : "helft"
	return (RANGTELWOORD.indices.contains(part) ? RANGTELWOORD[part] : "\(part)e") + " " + soort
}

/** The break at the midpoint is half-time; the others are just breaks. */
public func breakName(_ naDeel: Int, _ parts: Int) -> String {
	naDeel == Int((Double(parts) / 2).rounded(.down)) ? "Rust" : "Pauze"
}

/** How long the match lasts according to the settings. */
public func speelduur(_ minutenPerDeel: Double, _ parts: Int) -> Double {
	minutenPerDeel * Double(parts)
}

/** Een wisselmoment in een pauze, zoals je het zegt: 'Rust', of 'Pauze na 1e kwart'. */
public func momentName(_ naDeel: Int, _ parts: Int) -> String {
	breakName(naDeel, parts) == "Rust" ? "Rust" : "Pauze na " + partName(naDeel, parts)
}
