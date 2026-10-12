/**
 * The lineup as text, to send to a fellow coach. One line per line of the pitch,
 * with the position appended where that adds something.
 */
public func opstellingTekst(_ formation: String, _ lineup: Lineup, _ bench: [String], _ players: [Player]) -> String {
	func name(_ id: String?) -> String? {
		players.first { $0.id == id }?.name
	}
	var regels: [String] = ["Opstelling " + formation]

	for line in [Line.K, .V, .M, .A] {
		let names: [String] = positionsOf(formation)
			.filter { $0.line == line }
			.compactMap { p in
				guard let n = name(lineup[p.id]).gevuld else { return nil }
				return line == .K ? n : n + " (" + p.label + ")"
			}
		if !names.isEmpty { regels.append(LINES[line]! + ": " + names.joined(separator: ", ")) }
	}

	let opDeBank = bench.compactMap { name($0).gevuld }
	if !opDeBank.isEmpty { regels.append("Bank: " + opDeBank.joined(separator: ", ")) }
	return regels.joined(separator: "\n")
}

public struct Omgezet: Equatable, Sendable {
	public var lineup: Lineup
	public var bench: [String]
	/** who no longer fitted and went to the bench */
	public var afgevallen: [String]

	public init(lineup: Lineup, bench: [String], afgevallen: [String]) {
		self.lineup = lineup
		self.bench = bench
		self.afgevallen = afgevallen
	}
}

/**
 * Carry a lineup over to another formation. First everyone stays in a position
 * that exists in both formations; then we fill the remaining positions with
 * players from the same line. Whoever is left over goes to the bench.
 *
 * From 4-3-3 to 4-4-2 that means your four defenders and your keeper simply stay
 * put, and one of your three forwards ends up on the bench.
 */
public func convertLineup(
	_ lineup: Lineup,
	_ vanFormatie: String,
	_ naarFormatie: String,
	_ bench: [String] = []
) -> Omgezet {
	let oudePlekken = positionsOf(vanFormatie)
	let nieuwePlekken = positionsOf(naarFormatie)
	var nieuw = Lineup()
	var vrij: [(player: String, line: Line)] = []

	/* step 1: positions that exist in both formations keep their player */
	let nieuweIds = Set(nieuwePlekken.map(\.id))
	for plek in oudePlekken {
		guard let player = lineup[plek.id].gevuld else { continue }
		if nieuweIds.contains(plek.id) {
			nieuw[plek.id] = player
		} else {
			vrij.append((player: player, line: plek.line))
		}
	}

	/* step 2: spread the rest over empty positions in the same line */
	for plek in nieuwePlekken {
		if nieuw[plek.id].gevuld != nil { continue }
		if let i = vrij.firstIndex(where: { $0.line == plek.line }) {
			nieuw[plek.id] = vrij.remove(at: i).player
		}
	}

	let afgevallen = vrij.map(\.player)
	return Omgezet(
		lineup: nieuw,
		bench: bench.filter { !nieuw.includes($0) } + afgevallen,
		afgevallen: afgevallen
	)
}
