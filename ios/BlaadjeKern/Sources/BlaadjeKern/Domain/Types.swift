/* The shape of everything the app remembers. Anything stored under the older
   Dutch field names is converted on the way in; see MigrateStorage.swift. */

public enum Line: String, Codable, Sendable, CaseIterable {
	case K, V, M, A
	case geen = ""
}

/** A field line: K sits apart, because keeping comes on top of your usual position. */
public enum FieldLine: String, Codable, Sendable, CaseIterable {
	case V, M, A
	case geen = ""
}

public struct Player: JSONModel, Equatable, Identifiable, Sendable {
	public var id: String
	public var name: String
	public var line: FieldLine
	/** Can keep. Separate from the field line. */
	public var keeper: Bool?

	public init(id: String, name: String, line: FieldLine = .geen, keeper: Bool? = nil) {
		self.id = id
		self.name = name
		self.line = line
		self.keeper = keeper
	}

	public init(json: JSONValue) throws {
		let o = try alsObject(json, "speler")
		id = o.str("id") ?? ""
		name = o.str("name") ?? ""
		keeper = o.bool("keeper")
		/* Older storage: 'K' used to be a line. Keeping now sits alongside it. */
		if o.str("line") == "K" {
			line = .geen
			keeper = true
		} else {
			line = FieldLine(rawValue: o.str("line") ?? "") ?? .geen
		}
	}

	public var json: JSONValue {
		var o = OrderedDict<JSONValue>()
		o["id"] = .string(id)
		o["name"] = .string(name)
		o["line"] = .string(line.rawValue)
		o.zet("keeper", keeper)
		return .object(o)
	}
}

public enum MatchEventType: String, Codable, Sendable, CaseIterable {
	case start, `break`, end, goal, conceded, substitution, swap
}

public struct MatchEvent: JSONModel, Equatable, Sendable {
	public var type: MatchEventType
	/** seconds after kick-off */
	public var t: Double
	/** on a goal: who scored it, or nil when you do not know */
	public var player: String?
	/** on a goal: who set it up. May be skipped. */
	public var assist: String?
	public var off: String?
	public var on: String?
	public var position: String?
	/** on a swap: the two positions exchanging players, and who stood there */
	public var positionA: String?
	public var positionB: String?
	public var playerA: String?
	public var playerB: String?
	/** on a break: which part has just ended */
	public var part: Int?

	public init(
		type: MatchEventType,
		t: Double,
		player: String? = nil,
		assist: String? = nil,
		off: String? = nil,
		on: String? = nil,
		position: String? = nil,
		positionA: String? = nil,
		positionB: String? = nil,
		playerA: String? = nil,
		playerB: String? = nil,
		part: Int? = nil
	) {
		self.type = type
		self.t = t
		self.player = player
		self.assist = assist
		self.off = off
		self.on = on
		self.position = position
		self.positionA = positionA
		self.positionB = positionB
		self.playerA = playerA
		self.playerB = playerB
		self.part = part
	}

	public init(json: JSONValue) throws {
		let o = try alsObject(json, "gebeurtenis")
		let soort = o.str("type") ?? ""
		guard let type = MatchEventType(rawValue: soort) else { throw BlaadjeFout.onbekendeGebeurtenis(soort) }
		self.type = type
		t = o.num("t") ?? 0
		player = o.str("player")
		assist = o.str("assist")
		off = o.str("off")
		on = o.str("on")
		position = o.str("position")
		positionA = o.str("positionA")
		positionB = o.str("positionB")
		playerA = o.str("playerA")
		playerB = o.str("playerB")
		part = o.int("part")
	}

	/* The web app writes `"player": null` on a goal nobody claimed, and both
	   players on a swap even when one of the two positions was empty. Swift has
	   one nil where JavaScript has null and undefined, so the kind of event
	   decides which of the two it becomes on the way out. */
	public var json: JSONValue {
		var o = OrderedDict<JSONValue>()
		o["type"] = .string(type.rawValue)
		o["t"] = .number(t)
		if type == .goal {
			o["player"] = nullOf(player)
		} else {
			o.zet("player", player)
		}
		o.zet("assist", assist)
		o.zet("off", off)
		o.zet("on", on)
		o.zet("position", position)
		o.zet("positionA", positionA)
		o.zet("positionB", positionB)
		if playerA != nil || playerB != nil {
			o["playerA"] = nullOf(playerA)
			o["playerB"] = nullOf(playerB)
		}
		o.zet("part", part)
		return .object(o)
	}
}

/**
 * A lineup: position id from the formation -> player id.
 *
 * A position can be in the lineup and empty (`"LV": null` in storage), or not
 * be in it at all. Reading gives nil for both; `has` tells them apart. Assigning
 * nil leaves the position in place, empty; `remove` takes it out.
 *
 * The positions keep the order they were added in. Winding playing time back
 * walks them in that order.
 */
public struct Lineup: JSONModel, Equatable, Sendable, ExpressibleByDictionaryLiteral {
	private var plekken: OrderedDict<String?>

	public init() {
		plekken = OrderedDict()
	}

	public init(dictionaryLiteral elements: (String, String?)...) {
		plekken = OrderedDict(elements)
	}

	public init(_ paren: [(String, String?)]) {
		plekken = OrderedDict(paren)
	}

	public subscript(position: String) -> String? {
		get { plekken[position] ?? nil }
		set { plekken[position] = .some(newValue) }
	}

	/** Is this position in the lineup at all, filled or not? */
	public func has(_ position: String) -> Bool { plekken.contains(position) }

	public mutating func remove(_ position: String) { plekken[position] = nil }

	/** Object.keys(lineup) */
	public var positions: [String] { plekken.keys }

	/** Object.values(lineup) */
	public var values: [String?] { plekken.values }

	/** Object.entries(lineup) */
	public var entries: [(position: String, player: String?)] {
		plekken.entries.map { (position: $0.key, player: $0.value) }
	}

	/** Everyone on the pitch, in the order of the positions. */
	public var opHetVeld: [String] { plekken.values.compactMap { $0.gevuld } }

	public func includes(_ spelerId: String) -> Bool { plekken.values.contains(spelerId) }

	/** The first position this player stands in, or nil. */
	public func positionOf(_ spelerId: String) -> String? {
		plekken.entries.first { $0.value == spelerId }?.key
	}

	public var isEmpty: Bool { plekken.isEmpty }

	/** Without the order, for when only the content matters. */
	public var dictionary: [String: String?] { plekken.dictionary }

	public init(json: JSONValue) throws {
		let o = try alsObject(json, "opstelling")
		plekken = o.mapValues { $0.stringValue }
	}

	public var json: JSONValue {
		.object(plekken.mapValues(nullOf))
	}
}

/**
 * Een wedstrijd: een die nog komt (in het programma), de wedstrijd die je nu
 * voorbereidt of speelt (`AppState.match`), allemaal dezelfde soort. Wat nog
 * komt heeft al een opstelling als je die maakte, en wie er niet bij kan.
 */
public struct Match: JSONModel, Equatable, Identifiable, Sendable {
	/** Vast kenmerk, voor het synchroniseren. Oudere opslag heeft het niet. */
	public var id: String?
	public var date: String
	public var opponent: String
	public var home: Bool
	public var formation: String
	public var lineup: Lineup
	public var bench: [String]
	public var events: [MatchEvent]
	/** seconds already run, excluding the period currently running */
	public var elapsed: Double
	/** when the clock was last started, in ms */
	public var since: Double?
	public var running: Bool
	/** how many parts you play: 2 halves or 4 quarters */
	public var parts: Int
	/** the part you are in now, 1 through `parts` */
	public var part: Int
	/** between two parts: the clock is stopped and the next has yet to begin */
	public var inBreak: Bool
	public var finished: Bool
	/** how it went, in your own words */
	public var note: String?
	public var archived: Bool?
	/** who is not there today; they are off the bench and do not count */
	public var absent: [String]?
	/**
	 * Wie deze wedstrijd bijhoudt, als e-mailadres.
	 *
	 * Gezet bij de aftrap, en alleen als je ingelogd bent. Sinds er meer dan één
	 * trainer bij een team kan, kunnen er ook twee tegelijk gaan tikken — en dan
	 * duwen twee toestellen om beurten hun eigen versie naar de server en raakt de
	 * helft van de wissels zoek. Dit lost dat niet op; het maakt het zichtbaar,
	 * zodat je het onderling regelt voordat het misgaat.
	 */
	public var keptBy: String?
	/** Het wisselplan: wat je van plan bent, niet wat er gebeurde. Zie Domain/Plan.swift. */
	public var plan: [PlannedSub]?
	/** Hoe laat de aftrap is, "10:30". Uit het programma. */
	public var time: String?
	/** Kwam uit het programma: gooi je hem weg, dan gaat hij daar weer in terug. */
	public var fromProgram: Bool?

	public init(
		date: String,
		opponent: String,
		home: Bool,
		formation: String,
		lineup: Lineup = Lineup(),
		bench: [String] = [],
		events: [MatchEvent] = [],
		elapsed: Double = 0,
		since: Double? = nil,
		running: Bool = false,
		parts: Int = 2,
		part: Int = 1,
		inBreak: Bool = false,
		finished: Bool = false,
		note: String? = nil,
		archived: Bool? = nil,
		absent: [String]? = nil,
		keptBy: String? = nil,
		plan: [PlannedSub]? = nil,
		id: String? = nil,
		time: String? = nil,
		fromProgram: Bool? = nil
	) {
		self.id = id
		self.time = time
		self.fromProgram = fromProgram
		self.date = date
		self.opponent = opponent
		self.home = home
		self.formation = formation
		self.lineup = lineup
		self.bench = bench
		self.events = events
		self.elapsed = elapsed
		self.since = since
		self.running = running
		self.parts = parts
		self.part = part
		self.inBreak = inBreak
		self.finished = finished
		self.note = note
		self.archived = archived
		self.absent = absent
		self.keptBy = keptBy
		self.plan = plan
	}

	public init(json: JSONValue) throws {
		let o = try alsObject(json, "wedstrijd")
		id = o.str("id")
		date = o.str("date") ?? ""
		opponent = o.str("opponent") ?? ""
		home = o.bool("home") ?? true
		formation = o.str("formation") ?? ""
		lineup = try o.obj("lineup").map(Lineup.init(json:)) ?? Lineup()
		bench = o.strings("bench") ?? []
		events = try (o.arr("events") ?? []).map(MatchEvent.init(json:))
		elapsed = o.num("elapsed") ?? 0
		since = o.num("since")
		running = o.bool("running") ?? false
		parts = o.int("parts") ?? 2
		part = o.int("part") ?? 1
		inBreak = o.bool("inBreak") ?? false
		finished = o.bool("finished") ?? false
		note = o.str("note")
		archived = o.bool("archived")
		absent = o.strings("absent")
		keptBy = o.str("keptBy")
		plan = try o.arr("plan")?.map(PlannedSub.init(json:))
		time = o.str("time")
		fromProgram = o.bool("fromProgram")
	}

	public var json: JSONValue {
		var o = OrderedDict<JSONValue>()
		o["date"] = .string(date)
		o["opponent"] = .string(opponent)
		o["home"] = .bool(home)
		o["formation"] = .string(formation)
		o["lineup"] = lineup.json
		o["bench"] = .array(bench.map(JSONValue.string))
		o["events"] = .array(events.map(\.json))
		o["elapsed"] = .number(elapsed)
		o["since"] = since.map(JSONValue.number) ?? .null
		o["running"] = .bool(running)
		o["parts"] = .number(Double(parts))
		o["part"] = .number(Double(part))
		o["inBreak"] = .bool(inBreak)
		o["finished"] = .bool(finished)
		o.zet("absent", absent)
		o.zet("note", note)
		o.zet("archived", archived)
		o.zet("keptBy", keptBy)
		if let plan { o["plan"] = .array(plan.map(\.json)) }
		o.zet("id", id)
		o.zet("time", time)
		o.zet("fromProgram", fromProgram)
		return .object(o)
	}
}

public enum PlanSoort: String, Codable, Sendable {
	case ruil
}

/**
 * Een geplande wissel: rond deze minuut komt `on` erin voor `off`.
 *
 * Bewust zonder plek. `on` komt op de plek waar `off` op dat moment staat, zodat
 * het plan blijft kloppen als er intussen iets geschoven is.
 */
public struct PlannedSub: JSONModel, Equatable, Identifiable, Sendable {
	public var id: String
	/** minuten na de aftrap, over de hele wedstrijd: de rust bij 2×35 is 35 */
	public var minuut: Int
	public var on: String
	public var off: String
	/**
	 * In de pauze na dit deel (1 = na het eerste). Dan is hij aan de beurt zodra
	 * de trainer de pauze aantikt, niet op een minuut: de rust valt zelden op
	 * 35:00 precies. `minuut` is dan het einde van dat deel, alleen voor de volgorde.
	 */
	public var naDeel: Int?
	/**
	 * 'ruil': geen wissel met de bank, maar `on` en `off` staan allebei in het veld
	 * en wisselen van plek. De keeperwissel met een veldspeler, bijvoorbeeld.
	 */
	public var soort: PlanSoort?
	/** met opzet overgeslagen */
	public var skipped: Bool?

	public init(
		id: String,
		minuut: Int,
		on: String,
		off: String,
		naDeel: Int? = nil,
		soort: PlanSoort? = nil,
		skipped: Bool? = nil
	) {
		self.id = id
		self.minuut = minuut
		self.on = on
		self.off = off
		self.naDeel = naDeel
		self.soort = soort
		self.skipped = skipped
	}

	public init(json: JSONValue) throws {
		let o = try alsObject(json, "geplande wissel")
		id = o.str("id") ?? ""
		minuut = o.int("minuut") ?? 0
		on = o.str("on") ?? ""
		off = o.str("off") ?? ""
		naDeel = o.int("naDeel")
		soort = o.str("soort").flatMap(PlanSoort.init(rawValue:))
		skipped = o.bool("skipped")
	}

	public var json: JSONValue {
		var o = OrderedDict<JSONValue>()
		o["id"] = .string(id)
		o["minuut"] = .number(Double(minuut))
		o["on"] = .string(on)
		o["off"] = .string(off)
		o.zet("naDeel", naDeel)
		o.zet("soort", soort?.rawValue)
		o.zet("skipped", skipped)
		return .object(o)
	}
}

public struct DefaultLineup: JSONModel, Equatable, Sendable {
	public var formation: String
	public var lineup: Lineup
	public var bench: [String]

	public init(formation: String, lineup: Lineup = Lineup(), bench: [String] = []) {
		self.formation = formation
		self.lineup = lineup
		self.bench = bench
	}

	public init(json: JSONValue) throws {
		let o = try alsObject(json, "standaardopstelling")
		formation = o.str("formation") ?? ""
		lineup = try o.obj("lineup").map(Lineup.init(json:)) ?? Lineup()
		bench = o.strings("bench") ?? []
	}

	public var json: JSONValue {
		var o = OrderedDict<JSONValue>()
		o["formation"] = .string(formation)
		o["lineup"] = lineup.json
		o["bench"] = .array(bench.map(JSONValue.string))
		return .object(o)
	}
}

public struct PlayingTimeRow: JSONModel, Equatable, Sendable {
	public var id: String?
	public var name: String
	public var seconds: Double
	/** of which in goal */
	public var keeper: Double?
	/** seconds per formation position, for example { K: 2100, LV: 2100 } */
	public var positions: OrderedDict<Double>?

	public init(
		id: String? = nil,
		name: String,
		seconds: Double,
		keeper: Double? = nil,
		positions: OrderedDict<Double>? = nil
	) {
		self.id = id
		self.name = name
		self.seconds = seconds
		self.keeper = keeper
		self.positions = positions
	}

	public init(json: JSONValue) throws {
		let o = try alsObject(json, "speeltijdregel")
		id = o.str("id")
		name = o.str("name") ?? ""
		seconds = o.num("seconds") ?? 0
		keeper = o.num("keeper")
		if let p = o["positions"]?.objectValue {
			var uit = OrderedDict<Double>()
			for (k, v) in p.entries { uit[k] = v.numberValue }
			positions = uit
		} else {
			positions = nil
		}
	}

	public var json: JSONValue {
		var o = OrderedDict<JSONValue>()
		o.zet("id", id)
		o["name"] = .string(name)
		o["seconds"] = .number(seconds)
		o.zet("keeper", keeper)
		if let positions { o["positions"] = .object(positions.mapValues(JSONValue.number)) }
		return .object(o)
	}
}

/**
 * A score: ours first, theirs second. In storage a list of two numbers.
 *
 * Only `homeFirst` turns it round, for showing an away match the way it is said
 * out loud; from then on `voor` simply means "the first number".
 */
public struct Score: Equatable, Sendable, Codable, ExpressibleByArrayLiteral {
	public var voor: Int
	public var tegen: Int

	public init(_ voor: Int, _ tegen: Int) {
		self.voor = voor
		self.tegen = tegen
	}

	public init(arrayLiteral elements: Int...) {
		precondition(elements.count == 2, "een stand is twee getallen")
		self.init(elements[0], elements[1])
	}

	public subscript(i: Int) -> Int { i == 0 ? voor : tegen }

	/** [voor, tegen].join(separator) */
	public func joined(separator: String) -> String { "\(voor)\(separator)\(tegen)" }

	init?(json: JSONValue?) {
		guard let a = json?.arrayValue, a.count >= 2, let v = a[0].numberValue, let t = a[1].numberValue else {
			return nil
		}
		self.init(Int(jsRound(v)), Int(jsRound(t)))
	}

	var json: JSONValue { .array([.number(Double(voor)), .number(Double(tegen))]) }

	public init(from decoder: Decoder) throws {
		var c = try decoder.unkeyedContainer()
		voor = try c.decode(Int.self)
		tegen = try c.decode(Int.self)
	}

	public func encode(to encoder: Encoder) throws {
		var c = encoder.unkeyedContainer()
		try c.encode(voor)
		try c.encode(tegen)
	}
}

public struct ArchivedMatch: JSONModel, Equatable, Sendable {
	/** Vast kenmerk, voor het synchroniseren. Oudere opslag heeft het niet. */
	public var id: String?
	public var date: String
	public var opponent: String
	public var home: Bool
	public var score: Score
	public var formation: String
	public var duration: Double
	/** what your team was called when you archived it */
	public var teamName: String?
	public var parts: Int?
	public var note: String?
	public var events: [MatchEvent]
	/** the names as they were when you archived it */
	public var names: OrderedDict<String>?
	/** who was not there that day. Without this you cannot tell two kinds of zero
	    apart: was he absent, or on the bench all match? */
	public var absent: [String]?
	public var playingTime: [PlayingTimeRow]
	/**
	 * The lineup as it stood at the end, plus who was on the bench then.
	 *
	 * Stored not because a screen needs it, but because playing time is wound back
	 * from the final lineup. Without this an archived match cannot be recalculated
	 * and is therefore beyond repair forever, even if we wanted to later. Storing
	 * it costs one field; not storing it is irreversible.
	 */
	public var lineup: Lineup?
	public var bench: [String]?

	public init(
		date: String,
		opponent: String,
		home: Bool,
		score: Score,
		formation: String,
		duration: Double,
		teamName: String? = nil,
		parts: Int? = nil,
		note: String? = nil,
		events: [MatchEvent] = [],
		names: OrderedDict<String>? = nil,
		absent: [String]? = nil,
		playingTime: [PlayingTimeRow] = [],
		lineup: Lineup? = nil,
		bench: [String]? = nil,
		id: String? = nil
	) {
		self.id = id
		self.date = date
		self.opponent = opponent
		self.home = home
		self.score = score
		self.formation = formation
		self.duration = duration
		self.teamName = teamName
		self.parts = parts
		self.note = note
		self.events = events
		self.names = names
		self.absent = absent
		self.playingTime = playingTime
		self.lineup = lineup
		self.bench = bench
	}

	public init(json: JSONValue) throws {
		let o = try alsObject(json, "bewaarde wedstrijd")
		id = o.str("id")
		date = o.str("date") ?? ""
		opponent = o.str("opponent") ?? ""
		home = o.bool("home") ?? true
		score = Score(json: o["score"]) ?? Score(0, 0)
		formation = o.str("formation") ?? ""
		duration = o.num("duration") ?? 0
		teamName = o.str("teamName")
		parts = o.int("parts")
		note = o.str("note")
		events = try (o.arr("events") ?? []).map(MatchEvent.init(json:))
		if let n = o["names"]?.objectValue {
			var uit = OrderedDict<String>()
			for (k, v) in n.entries { uit[k] = v.stringValue }
			names = uit
		} else {
			names = nil
		}
		absent = o.strings("absent")
		playingTime = try (o.arr("playingTime") ?? []).map(PlayingTimeRow.init(json:))
		lineup = try o.obj("lineup").map(Lineup.init(json:))
		bench = o.strings("bench")
	}

	public var json: JSONValue {
		var o = OrderedDict<JSONValue>()
		o["date"] = .string(date)
		o["opponent"] = .string(opponent)
		o["home"] = .bool(home)
		o["score"] = score.json
		o["formation"] = .string(formation)
		o["duration"] = .number(duration)
		o.zet("parts", parts)
		o.zet("note", note)
		o.zet("teamName", teamName)
		o["events"] = .array(events.map(\.json))
		if let names { o["names"] = .object(names.mapValues(JSONValue.string)) }
		o.zet("absent", absent)
		if let lineup { o["lineup"] = lineup.json }
		o.zet("bench", bench)
		o["playingTime"] = .array(playingTime.map(\.json))
		o.zet("id", id)
		return .object(o)
	}
}

public enum Attendance: String, Codable, Sendable, CaseIterable {
	case present, excused, absent
}

public struct Training: JSONModel, Equatable, Identifiable, Sendable {
	/** its own id, so an address stays valid when the order changes */
	public var id: String
	public var date: String
	public var status: OrderedDict<Attendance>

	public init(id: String, date: String, status: OrderedDict<Attendance> = OrderedDict()) {
		self.id = id
		self.date = date
		self.status = status
	}

	public init(json: JSONValue) throws {
		let o = try alsObject(json, "training")
		id = o.str("id") ?? ""
		date = o.str("date") ?? ""
		var uit = OrderedDict<Attendance>()
		for (k, v) in o["status"]?.objectValue?.entries ?? [] {
			uit[k] = v.stringValue.flatMap(Attendance.init(rawValue:))
		}
		status = uit
	}

	public var json: JSONValue {
		var o = OrderedDict<JSONValue>()
		o["id"] = .string(id)
		o["date"] = .string(date)
		o["status"] = .object(status.mapValues { .string($0.rawValue) })
		return .object(o)
	}
}

/** Wat ouders bij een wedstrijd regelen. */
public enum TaskKind: String, CaseIterable, Codable, Sendable {
	case limonade, rijden, fluiten, vlaggen, velddienst, teamtas
}

/**
 * Een taak bij een wedstrijd, voor de familie van een speler. Zonder speler staat
 * hij open. `declinedBy`: die familie kon niet, en gaf hem terug. `club`: de
 * vereniging regelt het (een clubscheidsrechter); dan hoeft geen familie.
 */
public struct TeamTask: JSONModel, Equatable, Identifiable, Sendable {
	public var id: String
	public var matchId: String
	public var kind: TaskKind
	public var player: String?
	public var declinedBy: String?
	public var club: Bool

	public init(id: String, matchId: String, kind: TaskKind, player: String? = nil, declinedBy: String? = nil, club: Bool = false) {
		self.id = id
		self.matchId = matchId
		self.kind = kind
		self.player = player
		self.declinedBy = declinedBy
		self.club = club
	}

	/** Er moet nog iemand voor gevonden worden. */
	public var open: Bool { player == nil && !club }

	public init(json: JSONValue) throws {
		let o = try alsObject(json, "taak")
		id = o.str("id") ?? ""
		matchId = o.str("matchId") ?? ""
		kind = o.str("kind").flatMap(TaskKind.init(rawValue:)) ?? .limonade
		player = o.str("player")
		declinedBy = o.str("declinedBy")
		club = o.bool("club") ?? false
	}

	public var json: JSONValue {
		var o = OrderedDict<JSONValue>()
		o["id"] = .string(id)
		o["matchId"] = .string(matchId)
		o["kind"] = .string(kind.rawValue)
		o.zet("player", player)
		o.zet("declinedBy", declinedBy)
		if club { o["club"] = .bool(true) }
		return .object(o)
	}
}

/**
 * Everything the app remembers. `State` in the web app; here `AppState`, because
 * SwiftUI already has a `State`.
 */
public struct AppState: JSONModel, Equatable, Sendable {
	/** what your team is called; appears in the header and in the report */
	public var teamName: String
	public var players: [Player]
	public var formation: String
	/** minutes per part, whether you play halves or quarters */
	public var minutesPerPart: Double
	public var parts: Int
	public var match: Match?
	public var defaultLineup: DefaultLineup?
	public var archive: [ArchivedMatch]
	public var trainings: [Training]
	public var reportSubs: Bool
	/** de wedstrijden die nog komen, vroegste eerst; zonder de wedstrijd die open staat */
	public var program: [Match]
	/** de taken bij wedstrijden: limonade, rijden, fluiten */
	public var tasks: [TeamTask]

	public init(
		teamName: String = "Ons team",
		players: [Player] = [],
		formation: String = "4-3-3",
		minutesPerPart: Double = 35,
		parts: Int = 2,
		match: Match? = nil,
		defaultLineup: DefaultLineup? = nil,
		archive: [ArchivedMatch] = [],
		trainings: [Training] = [],
		reportSubs: Bool = false,
		program: [Match] = [],
		tasks: [TeamTask] = []
	) {
		self.program = program
		self.tasks = tasks
		self.teamName = teamName
		self.players = players
		self.formation = formation
		self.minutesPerPart = minutesPerPart
		self.parts = parts
		self.match = match
		self.defaultLineup = defaultLineup
		self.archive = archive
		self.trainings = trainings
		self.reportSubs = reportSubs
	}

	/* Missing fields get what emptyState() gives them, as `{ ...emptyState(), ...d }`
	   does when the web app loads. */
	public init(json: JSONValue) throws {
		let o = try alsObject(json, "toestand")
		let leeg = emptyState()
		teamName = o.str("teamName") ?? leeg.teamName
		players = try (o.arr("players") ?? []).map(Player.init(json:))
		formation = o.str("formation") ?? leeg.formation
		minutesPerPart = o.num("minutesPerPart") ?? leeg.minutesPerPart
		parts = o.int("parts") ?? leeg.parts
		match = try o.obj("match").map(Match.init(json:))
		defaultLineup = try o.obj("defaultLineup").map(DefaultLineup.init(json:))
		archive = try (o.arr("archive") ?? []).map(ArchivedMatch.init(json:))
		trainings = try (o.arr("trainings") ?? []).map(Training.init(json:))
		reportSubs = o.bool("reportSubs") ?? leeg.reportSubs
		program = try (o.arr("program") ?? []).map(Match.init(json:))
		tasks = try (o.arr("tasks") ?? []).map(TeamTask.init(json:))
	}

	public var json: JSONValue {
		var o = OrderedDict<JSONValue>()
		o["teamName"] = .string(teamName)
		o["players"] = .array(players.map(\.json))
		o["formation"] = .string(formation)
		o["minutesPerPart"] = .number(minutesPerPart)
		o["parts"] = .number(Double(parts))
		o["match"] = match?.json ?? .null
		o["defaultLineup"] = defaultLineup?.json ?? .null
		o["archive"] = .array(archive.map(\.json))
		o["trainings"] = .array(trainings.map(\.json))
		o["reportSubs"] = .bool(reportSubs)
		/* Alleen als er iets in staat: zo blijft de opslag van wie het niet gebruikt
		   precies zoals hij was. */
		if !program.isEmpty { o["program"] = .array(program.map(\.json)) }
		if !tasks.isEmpty { o["tasks"] = .array(tasks.map(\.json)) }
		return .object(o)
	}
}

public func emptyState() -> AppState {
	AppState(
		teamName: "Ons team",
		players: [],
		formation: "4-3-3",
		minutesPerPart: 35,
		parts: 2,
		match: nil,
		defaultLineup: nil,
		archive: [],
		trainings: [],
		reportSubs: false
	)
}
