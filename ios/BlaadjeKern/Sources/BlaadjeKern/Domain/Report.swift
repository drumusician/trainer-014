/** Everything you need to read a match back, live or from the archive. */
public struct ReportSource: Equatable, Sendable {
	public var date: String
	public var opponent: String
	public var home: Bool
	public var score: Score
	public var formation: String
	public var duration: Double
	public var events: [MatchEvent]
	public var names: OrderedDict<String>?
	public var parts: Int?
	public var note: String?
	public var teamName: String?

	public init(
		date: String,
		opponent: String,
		home: Bool,
		score: Score,
		formation: String,
		duration: Double,
		events: [MatchEvent],
		names: OrderedDict<String>? = nil,
		parts: Int? = nil,
		note: String? = nil,
		teamName: String? = nil
	) {
		self.date = date
		self.opponent = opponent
		self.home = home
		self.score = score
		self.formation = formation
		self.duration = duration
		self.events = events
		self.names = names
		self.parts = parts
		self.note = note
		self.teamName = teamName
	}
}

public func bronVanWedstrijd(_ w: Match, _ teamName: String) -> ReportSource {
	ReportSource(
		date: w.date,
		opponent: w.opponent,
		home: w.home,
		score: score(w),
		formation: w.formation,
		duration: endTime(w),
		events: w.events,
		parts: w.parts,
		note: w.note,
		teamName: teamName
	)
}

public func bronVanArchief(_ a: ArchivedMatch) -> ReportSource {
	ReportSource(
		date: a.date,
		opponent: a.opponent,
		home: a.home,
		score: a.score,
		formation: a.formation,
		duration: a.duration,
		events: a.events,
		names: a.names,
		parts: a.parts,
		note: a.note,
		teamName: a.teamName
	)
}

/** The current name; falls back to the name as it was when archived. */
public func nameOf(_ id: String?, _ players: [Player], _ names: OrderedDict<String>? = nil) -> String {
	guard let id = id.gevuld else { return "onbekend" }
	return players.first { $0.id == id }?.name ?? names?[id] ?? "onbekend"
}

public func eventText(
	_ g: MatchEvent,
	_ players: [Player],
	_ names: OrderedDict<String>? = nil,
	_ parts: Int = 2,
	_ formation: String? = nil
) -> String {
	func name(_ id: String?) -> String { nameOf(id, players, names) }
	/* Without a formation we cannot know the readable name; then the raw position. */
	func position(_ id: String?) -> String {
		guard let id = id.gevuld else { return "" }
		guard let formation = formation.gevuld else { return id }
		return positionLabel(id, formation)
	}
	switch g.type {
	case .start:
		return "Aftrap"
	case .break:
		guard let part = g.part, part != 0 else { return "Rust" }
		return breakName(part, parts) + " — " + partName(part, parts) + " voorbij"
	case .end:
		return "Einde"
	case .conceded:
		return "Tegendoelpunt"
	case .goal:
		return "Doelpunt"
			+ (g.player.gevuld != nil ? " — " + name(g.player) : "")
			+ (g.assist.gevuld != nil ? " (assist " + name(g.assist) + ")" : "")
	case .substitution:
		return name(g.on) + " voor " + name(g.off) + (g.position.gevuld != nil ? " op " + position(g.position) : "")
	case .swap:
		/* Where they went says more than that they swapped. Older matches recorded
		   only the positions, not who stood there. */
		if g.playerA.gevuld != nil, g.playerB.gevuld != nil, g.positionA.gevuld != nil, g.positionB.gevuld != nil {
			return name(g.playerA) + " naar " + position(g.positionB) + ", " + name(g.playerB) + " naar "
				+ position(g.positionA)
		}
		if g.positionA.gevuld != nil, g.positionB.gevuld != nil {
			return "Van plek gewisseld: " + position(g.positionA) + " en " + position(g.positionB)
		}
		return "Van plek gewisseld"
	}
}

/**
 * The write-up for the team chat. Substitutions are left out by default: the
 * result is for everyone, the lineup is the coach's business.
 */
public func reportText(_ bron: ReportSource, _ players: [Player], _ metWissels: Bool = false) -> String {
	let home = bron.home
	let ons = (bron.teamName?.jsTrim()).gevuld ?? "Ons team"
	var regels: [String] = []
	regels.append(
		(home ? ons + " – " + bron.opponent : bron.opponent + " – " + ons) + " "
			+ homeFirst(bron.score, home).joined(separator: "–")
	)
	regels.append(dateText(bron.date))
	regels.append("")

	var voor = 0
	var tegen = 0
	for g in bron.events.jsSorted({ a, b in a.t - b.t }) {
		let min = jsGetal((g.t / 60).rounded(.down)) + "′"
		if g.type == .goal {
			voor += 1
			let name = g.player.gevuld != nil ? nameOf(g.player, players, bron.names) : nil
			let assist = g.assist.gevuld != nil ? nameOf(g.assist, players, bron.names) : nil
			let maker = name.gevuld != nil && name != "onbekend" ? name! : "doelpunt"
			regels.append(
				"\(min)  \(homeFirst(Score(voor, tegen), home).joined(separator: "–"))  \(maker)"
					+ (assist.gevuld != nil && assist != "onbekend" ? " (assist \(assist!))" : "")
			)
		} else if g.type == .conceded {
			tegen += 1
			regels.append("\(min)  \(homeFirst(Score(voor, tegen), home).joined(separator: "–"))  tegendoelpunt")
		} else if g.type == .substitution && metWissels {
			regels.append("\(min)       \(nameOf(g.on, players, bron.names)) voor \(nameOf(g.off, players, bron.names))")
		}
	}
	if voor + tegen == 0 { regels.append("Geen doelpunten.") }
	if let note = (bron.note?.jsTrim()).gevuld {
		regels.append("")
		regels.append(note)
	}
	return regels.joined(separator: "\n")
}

public struct TimelineRow: Equatable, Sendable {
	public var t: Double
	public var tekst: String
	/** index in the original list, so a goal remains removable */
	public var index: Int
	public var type: MatchEventType

	public init(t: Double, tekst: String, index: Int, type: MatchEventType) {
		self.t = t
		self.tekst = tekst
		self.index = index
		self.type = type
	}
}

/**
 * The timeline as rows to display.
 *
 * Swaps that sit back to back at the same timestamp become one row. A rotation
 * of four players cannot be written in fewer than three pairwise swaps, so
 * otherwise someone appears to move twice in the same second. What you want to
 * read is where everyone ended up, not how the bookkeeping got there.
 */
public func timelineRows(
	_ events: [MatchEvent],
	_ players: [Player],
	_ names: OrderedDict<String>? = nil,
	_ parts: Int = 2,
	_ formation: String? = nil
) -> [TimelineRow] {
	func name(_ id: String?) -> String { nameOf(id, players, names) }
	func position(_ id: String?) -> String {
		guard let id = id.gevuld else { return "" }
		guard let formation = formation.gevuld else { return id }
		return positionLabel(id, formation)
	}
	var uit: [TimelineRow] = []

	var i = 0
	while i < events.count {
		defer { i += 1 }
		let g = events[i]
		if g.type != .swap {
			uit.append(TimelineRow(t: g.t, tekst: eventText(g, players, names, parts, formation), index: i, type: g.type))
			continue
		}

		var vanaf: [String: String] = [:]
		var naartoe: [String: String] = [:]
		var volgorde: [String] = []
		var j = i
		while j < events.count {
			let r = events[j]
			if r.type != .swap || r.t != g.t { break }
			if let positionA = r.positionA.gevuld, let positionB = r.positionB.gevuld {
				let stappen: [(String?, String, String)] = [
					(r.playerA, positionA, positionB),
					(r.playerB, positionB, positionA),
				]
				for (speler, van, naar) in stappen {
					guard let sp = speler.gevuld else { continue }
					if vanaf[sp] == nil {
						vanaf[sp] = van
						volgorde.append(sp)
					}
					naartoe[sp] = naar
				}
			}
			j += 1
		}

		let verhuisd = volgorde.filter { vanaf[$0] != naartoe[$0] }
		if verhuisd.isEmpty {
			/* No names recorded, or everything ended up back where it started. */
			uit.append(TimelineRow(t: g.t, tekst: eventText(g, players, names, parts, formation), index: i, type: g.type))
			i = j - 1
			continue
		}
		uit.append(
			TimelineRow(
				t: g.t,
				tekst: verhuisd.map { name($0) + " naar " + position(naartoe[$0]) }.joined(separator: ", "),
				index: i,
				type: g.type
			)
		)
		i = j - 1
	}
	return uit
}
