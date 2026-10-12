public struct PlayerRow: Equatable, Identifiable, Sendable {
	public var id: String
	public var name: String
	public var line: FieldLine
	/** whether he may keep — not to be confused with keeperSeconds below */
	public var canKeep: Bool
	public var assists: Int
	/** playing time across every archived match */
	public var seconds: Double
	/** of which in goal */
	public var keeperSeconds: Double
	public var matches: Int
	public var goals: Int
	public var attendance: AttendanceSummary
	/** attendance over the last four sessions */
	public var recent: AttendanceSummary

	public init(
		id: String,
		name: String,
		line: FieldLine,
		canKeep: Bool,
		assists: Int,
		seconds: Double,
		keeperSeconds: Double,
		matches: Int,
		goals: Int,
		attendance: AttendanceSummary,
		recent: AttendanceSummary
	) {
		self.id = id
		self.name = name
		self.line = line
		self.canKeep = canKeep
		self.assists = assists
		self.seconds = seconds
		self.keeperSeconds = keeperSeconds
		self.matches = matches
		self.goals = goals
		self.attendance = attendance
		self.recent = recent
	}
}

public enum Sortering: String, Sendable, CaseIterable {
	case naam, minuten, presentie, doelpunten
}

/** Everything you know about a player, on one row. */
public func spelersOverzicht(_ players: [Player], _ archive: [ArchivedMatch], _ trainings: [Training]) -> [PlayerRow] {
	let totalen = seasonTotals(archive, players)
	var assists: [String: Int] = [:]
	for a in archive {
		for g in a.events {
			if g.type == .goal, let assist = g.assist.gevuld { assists[assist, default: 0] += 1 }
		}
	}
	return players.map { p in
		let rij = totalen.first { $0.name == p.name }
		return PlayerRow(
			id: p.id,
			name: p.name,
			line: p.line,
			canKeep: p.keeper == true,
			assists: assists[p.id] ?? 0,
			seconds: rij?.seconds ?? 0,
			keeperSeconds: rij?.keeper ?? 0,
			matches: rij?.wedstrijden ?? 0,
			goals: rij?.doelpunten ?? 0,
			attendance: attendanceOf(trainings, p.id, 0),
			recent: attendanceOf(trainings, p.id, 4)
		)
	}
}

public func sorteer(_ rijen: [PlayerRow], _ hoe: Sortering) -> [PlayerRow] {
	/* Someone with no sessions yet does not belong at the top of an attendance list. */
	func part(_ p: AttendanceSummary) -> Double {
		p.totaal != 0 ? Double(p.er) / Double(p.totaal) : 2
	}
	return rijen.jsSorted { a, b in
		switch hoe {
		case .minuten:
			return eersteVerschil(b.seconds - a.seconds, localeCompare(a.name, b.name))
		case .doelpunten:
			return eersteVerschil(
				Double(b.goals - a.goals),
				Double(b.assists - a.assists),
				b.seconds - a.seconds,
				localeCompare(a.name, b.name)
			)
		case .presentie:
			return eersteVerschil(part(a.attendance) - part(b.attendance), localeCompare(a.name, b.name))
		case .naam:
			return localeCompare(a.name, b.name)
		}
	}
}

/** Percentage present, or nil when there has been no session yet. */
public func percentage(_ p: AttendanceSummary) -> Int? {
	p.totaal != 0 ? Int(jsRound(Double(p.er) / Double(p.totaal) * 100)) : nil
}
