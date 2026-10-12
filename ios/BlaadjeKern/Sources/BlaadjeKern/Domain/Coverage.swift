public struct LineCoverage: Equatable, Sendable {
	public var line: Line
	public var name: String
	/** how many players you marked for this line */
	public var players: Int
	/** how many positions the formation has for it */
	public var positionsOf: Int

	public init(line: Line, name: String, players: Int, positionsOf: Int) {
		self.line = line
		self.name = name
		self.players = players
		self.positionsOf = positionsOf
	}
}

/**
 * How many players you have per line against how many positions your formation
 * offers. That way you see without counting that seven midfielders for three
 * positions is lopsided.
 *
 * Keepers count separately: keeping is an ability, not a position on the pitch.
 */
public func bezetting(_ players: [Player], _ formation: String) -> [LineCoverage] {
	var plekkenPerLinie: [Line: Int] = [:]
	for p in positionsOf(formation) { plekkenPerLinie[p.line, default: 0] += 1 }

	return linesIn(formation).map { line in
		LineCoverage(
			line: line,
			name: LINES[line]!,
			players: line == .K
				? players.filter { $0.keeper == true }.count
				: players.filter { groupOf($0) == line }.count,
			positionsOf: plekkenPerLinie[line] ?? 0
		)
	}
}

/** Too few for this line: you cannot even fill it. */
public func tekort(_ b: LineCoverage) -> Bool {
	b.players < b.positionsOf
}

/**
 * Well over twice as many players as positions. Then someone who sees themselves
 * in that line is structurally on the bench.
 *
 * Does not apply to the keeper: keeping is an ability, not a position on the
 * pitch. Four players who can keep is not a crowd but exactly what you want,
 * because then you can rotate and are not stuck when one is ill.
 */
public func gedrang(_ b: LineCoverage) -> Bool {
	b.line != .K && b.positionsOf > 0 && b.players > b.positionsOf * 2
}

/** One keeper is enough until the day he is not there. */
public func dunneKeepersbezetting(_ rijen: [LineCoverage]) -> Bool {
	rijen.first { $0.line == .K }?.players == 1
}
