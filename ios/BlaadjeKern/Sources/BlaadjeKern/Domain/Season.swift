public struct SeizoenRegel: Equatable, Sendable {
	public var name: String
	public var seconds: Double
	public var keeper: Double
	public var wedstrijden: Int
	public var doelpunten: Int

	public init(name: String, seconds: Double = 0, keeper: Double = 0, wedstrijden: Int = 0, doelpunten: Int = 0) {
		self.name = name
		self.seconds = seconds
		self.keeper = keeper
		self.wedstrijden = wedstrijden
		self.doelpunten = doelpunten
	}
}

public struct SeizoenStand: Equatable, Sendable {
	public var wedstrijden: Int
	public var gewonnen: Int
	public var gelijk: Int
	public var verloren: Int
	public var voor: Int
	public var tegen: Int
	public var seconds: Double

	public init(
		wedstrijden: Int = 0,
		gewonnen: Int = 0,
		gelijk: Int = 0,
		verloren: Int = 0,
		voor: Int = 0,
		tegen: Int = 0,
		seconds: Double = 0
	) {
		self.wedstrijden = wedstrijden
		self.gewonnen = gewonnen
		self.gelijk = gelijk
		self.verloren = verloren
		self.voor = voor
		self.tegen = tegen
		self.seconds = seconds
	}
}

public func seizoenStand(_ archive: [ArchivedMatch]) -> SeizoenStand {
	var uit = SeizoenStand(wedstrijden: archive.count)
	for a in archive {
		let v = a.score.voor
		let t = a.score.tegen
		uit.voor += v
		uit.tegen += t
		if v > t {
			uit.gewonnen += 1
		} else if v == t {
			uit.gelijk += 1
		} else {
			uit.verloren += 1
		}
		uit.seconds += a.duration
	}
	return uit
}

/**
 * Everything in the archive added up. By player id where possible, so renaming
 * someone does not produce two rows; by name for older matches without ids.
 */
public func seasonTotals(_ archive: [ArchivedMatch], _ players: [Player]) -> [SeizoenRegel] {
	var per = OrderedDict<SeizoenRegel>()
	func player(_ id: String?) -> Player? {
		guard let id = id.gevuld else { return nil }
		return players.first { $0.id == id }
	}

	func pak(_ sleutel: String, _ name: String, _ werkBij: (inout SeizoenRegel) -> Void) {
		var rij = per[sleutel] ?? SeizoenRegel(name: name)
		rij.name = name
		werkBij(&rij)
		per[sleutel] = rij
	}

	for a in archive {
		for r in a.playingTime {
			let p = player(r.id)
			pak(p.map { "id:" + $0.id } ?? "naam:" + r.name, p?.name ?? r.name) { rij in
				rij.seconds += r.seconds
				rij.keeper += r.keeper ?? 0
				if r.seconds > 0 { rij.wedstrijden += 1 }
			}
		}
		for g in a.events where g.type == .goal {
			guard let maker = g.player.gevuld else { continue }
			let p = player(maker)
			/* scorer unknown: counts towards the score only */
			guard let name = (p?.name ?? a.names?[maker]).gevuld else { continue }
			pak(p.map { "id:" + $0.id } ?? "naam:" + name, name) { $0.doelpunten += 1 }
		}
	}

	return per.values.jsSorted { a, b in b.seconds - a.seconds }
}

public struct MakerRegel: Equatable, Sendable {
	public struct Wedstrijd: Equatable, Sendable {
		public var date: String
		public var opponent: String
		public var aantal: Int

		public init(date: String, opponent: String, aantal: Int) {
			self.date = date
			self.opponent = opponent
			self.aantal = aantal
		}
	}

	public var name: String
	public var doelpunten: Int
	/** in which matches, newest first */
	public var wedstrijden: [Wedstrijd]

	public init(name: String, doelpunten: Int = 0, wedstrijden: [Wedstrijd] = []) {
		self.name = name
		self.doelpunten = doelpunten
		self.wedstrijden = wedstrijden
	}
}

/**
 * Who scored, and when. The score counts every goal; this list only the ones
 * with a scorer attached, because sometimes you simply do not know.
 */
public func makers(_ archive: [ArchivedMatch], _ players: [Player]) -> [MakerRegel] {
	var per = OrderedDict<MakerRegel>()
	for a in archive {
		for g in a.events where g.type == .goal {
			guard let maker = g.player.gevuld else { continue }
			let p = players.first { $0.id == maker }
			guard let name = (p?.name ?? a.names?[maker]).gevuld else { continue }
			var rij = per[name] ?? MakerRegel(name: name)
			rij.doelpunten += 1
			if let i = rij.wedstrijden.firstIndex(where: { $0.date == a.date && $0.opponent == a.opponent }) {
				rij.wedstrijden[i].aantal += 1
			} else {
				rij.wedstrijden.append(.init(date: a.date, opponent: a.opponent, aantal: 1))
			}
			per[name] = rij
		}
	}
	return per.values
		.map { r in
			var uit = r
			uit.wedstrijden = r.wedstrijden.jsSorted { x, y in localeCompare(y.date, x.date) }
			return uit
		}
		.jsSorted { a, b in eersteVerschil(Double(b.doelpunten - a.doelpunten), localeCompare(a.name, b.name)) }
}

public func topscorers(_ rijen: [SeizoenRegel]) -> [SeizoenRegel] {
	rijen
		.filter { $0.doelpunten > 0 }
		.jsSorted { a, b in eersteVerschil(Double(b.doelpunten - a.doelpunten), b.seconds - a.seconds) }
}
