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

// MARK: - één speler over het seizoen

/** Alles wat het seizoen over één speler zegt: speeltijd, waar, doelpunten, trainingen. */
public struct SpelerSeizoen: Equatable, Sendable {
	public struct Wedstrijd: Equatable, Sendable {
		/** plek in het archief, om de wedstrijd te openen */
		public var index: Int
		public var date: String
		public var opponent: String
		public var home: Bool
		public var score: Score
		public var seconds: Double
		public var doelpunten: Int
		public var assists: Int
		/** afgemeld of er niet: dan telt de wedstrijd niet mee */
		public var erNiet: Bool
	}

	public struct Plek: Equatable, Sendable {
		/** het label op het veld, zoals "SP" of "CV" */
		public var label: String
		public var seconds: Double
	}

	public var wedstrijden: [Wedstrijd] = []
	public var seconds: Double = 0
	public var keeper: Double = 0
	/** wedstrijden waarin hij speelde */
	public var gespeeld = 0
	public var doelpunten = 0
	public var assists = 0
	/** meeste minuten eerst */
	public var plekken: [Plek] = []
	public var training = AttendanceSummary(er: 0, totaal: 0)

	/** gemiddelde speeltijd in seconden, over de wedstrijden waarin hij speelde */
	public var gemiddeld: Double { gespeeld == 0 ? 0 : seconds / Double(gespeeld) }
}

/**
 * Het seizoen van één speler, in de volgorde van het archief. Een wedstrijd van
 * voordat hij in het team kwam staat er niet in: daar was hij niet afgemeld en
 * had hij geen speeltijd.
 */
public func spelerSeizoen(_ t: AppState, _ id: String) -> SpelerSeizoen {
	var uit = SpelerSeizoen()
	var plekken = OrderedDict<Double>()
	for (i, a) in t.archive.enumerated() {
		let rij = a.playingTime.first { $0.id == id }
		let erNiet = a.absent?.contains(id) == true
		guard rij != nil || erNiet else { continue }
		let seconden = rij?.seconds ?? 0
		let goals = a.events.filter { $0.type == .goal && $0.player == id }.count
		let assists = a.events.filter { $0.type == .goal && $0.assist == id }.count
		uit.wedstrijden.append(.init(
			index: i, date: a.date, opponent: a.opponent, home: a.home, score: a.score,
			seconds: seconden, doelpunten: goals, assists: assists, erNiet: erNiet))
		uit.seconds += seconden
		uit.keeper += rij?.keeper ?? 0
		if seconden > 0 { uit.gespeeld += 1 }
		uit.doelpunten += goals
		uit.assists += assists
		let slots = positionsOf(a.formation)
		for (plek, s) in (rij?.positions ?? OrderedDict()).entries {
			let label = slots.first { $0.id == plek }?.label ?? plek
			plekken[label] = (plekken[label] ?? 0) + s
		}
	}
	uit.plekken = plekken.entries.map { SpelerSeizoen.Plek(label: $0.key, seconds: $0.value) }
		.filter { $0.seconds > 0 }
		.sorted { $0.seconds > $1.seconds }
	uit.training = attendanceOf(t.trainings, id)
	return uit
}
