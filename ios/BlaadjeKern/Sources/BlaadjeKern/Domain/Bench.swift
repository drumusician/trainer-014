/**
 * Wie zat er op de bank, en hoe vaak begon hij daar.
 *
 * Voor bij het maken van de opstelling. Op gevoel doorwisselen gaat goed tot
 * dezelfde twee jongens drie weken achter elkaar op de bank beginnen; dat zie
 * je pas als het er zwart op wit staat.
 *
 * Alleen wedstrijden waarbij hij er was tellen mee. Afgemeld is geen bankzitten.
 */
public struct BenchRow: Equatable, Identifiable, Sendable {
	public var id: String
	public var name: String
	/** bewaarde wedstrijden waarbij hij er was */
	public var matches: Int
	/** seconden op de bank in die wedstrijden */
	public var benchSeconds: Double
	/** hoe vaak hij op de bank begon */
	public var startedOnBench: Int
	/**
	 * Van hoeveel wedstrijden we weten wie er begon. Dat is uit de wissels terug
	 * te rekenen, maar alleen als de eindopstelling bewaard is — bij oudere
	 * wedstrijden niet, en dan tellen die hier niet mee in plaats van te gokken.
	 */
	public var startsKnown: Int
	/** over alle trainingen van het seizoen */
	public var attendance: AttendanceSummary

	public init(
		id: String,
		name: String,
		matches: Int = 0,
		benchSeconds: Double = 0,
		startedOnBench: Int = 0,
		startsKnown: Int = 0,
		attendance: AttendanceSummary
	) {
		self.id = id
		self.name = name
		self.matches = matches
		self.benchSeconds = benchSeconds
		self.startedOnBench = startedOnBench
		self.startsKnown = startsKnown
		self.attendance = attendance
	}
}

public func benchOverview(_ players: [Player], _ archive: [ArchivedMatch], _ trainings: [Training]) -> [BenchRow] {
	var per = OrderedDict<BenchRow>()
	for p in players {
		per[p.id] = BenchRow(id: p.id, name: p.name, attendance: attendanceOf(trainings, p.id, 0))
	}

	for a in archive {
		let afwezig = Set(a.absent ?? [])
		let aftrap = momentenVan(a, players).first
		let opDeBank = Set(aftrap?.bench ?? [])
		for r in a.playingTime {
			guard let id = r.id.gevuld, var rij = per[id], !afwezig.contains(rij.id) else { continue }
			rij.matches += 1
			rij.benchSeconds += max(0, a.duration - r.seconds)
			if aftrap != nil {
				rij.startsKnown += 1
				if opDeBank.contains(rij.id) { rij.startedOnBench += 1 }
			}
			per[id] = rij
		}
	}

	return per.values.jsSorted { a, b in
		eersteVerschil(
			b.benchSeconds - a.benchSeconds,
			Double(b.startedOnBench - a.startedOnBench),
			localeCompare(a.name, b.name)
		)
	}
}
