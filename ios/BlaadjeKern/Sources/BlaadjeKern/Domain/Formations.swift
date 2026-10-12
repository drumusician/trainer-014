/** Position id, label on the pitch, x in %, y in %, line. */
public struct PositionSlot: Equatable, Sendable {
	public var id: String
	public var label: String
	public var x: Double
	public var y: Double
	public var line: Line

	public init(_ id: String, _ label: String, _ x: Double, _ y: Double, _ line: Line) {
		self.id = id
		self.label = label
		self.x = x
		self.y = y
		self.line = line
	}
}

private func p(_ id: String, _ label: String, _ x: Double, _ y: Double, _ line: Line) -> PositionSlot {
	PositionSlot(id, label, x, y, line)
}

/**
 * Formations per format. Nowhere does the app assume a fixed number of players:
 * how many are on the pitch follows from the list of positions below. That way
 * the same screen works for 11-a-side and for the youngest age groups.
 *
 * The x values sit far enough apart that the name bubbles do not touch, even on
 * a small phone. If you change them, check that the widest line still fits.
 */
/* The rows below mirror the lines on the pitch: keeper, defence, midfield,
   attack. That reads as a lineup and we want to keep it that way. */
public let FORMATIONS: OrderedDict<[PositionSlot]> = [
	/* ---------- 11-a-side ---------- */
	"4-3-3": [
		p("K", "K", 50, 92, .K),
		p("RV", "RV", 88, 73, .V), p("CVr", "CV", 64, 79, .V), p("CVl", "CV", 36, 79, .V), p("LV", "LV", 12, 73, .V),
		p("MR", "M", 75, 55, .M), p("MC", "M", 50, 61, .M), p("ML", "M", 25, 55, .M),
		p("RB", "RB", 80, 26, .A), p("SP", "SP", 50, 18, .A), p("LB", "LB", 20, 26, .A),
	],
	"4-4-2": [
		p("K", "K", 50, 92, .K),
		p("RV", "RV", 88, 75, .V), p("CVr", "CV", 64, 80, .V), p("CVl", "CV", 36, 80, .V), p("LV", "LV", 12, 75, .V),
		p("MR", "RM", 88, 51, .M), p("MCr", "M", 63, 57, .M), p("MCl", "M", 37, 57, .M), p("ML", "LM", 12, 51, .M),
		p("SPr", "SP", 62, 22, .A), p("SPl", "SP", 38, 22, .A),
	],
	/* The diamond: one holding midfielder, two wide, one behind the strikers.
	   Exactly the midfield where one sits deeper than the other. */
	"4-4-2 diamond": [
		p("K", "K", 50, 92, .K),
		p("RV", "RV", 88, 75, .V), p("CVr", "CV", 64, 80, .V), p("CVl", "CV", 36, 80, .V), p("LV", "LV", 12, 75, .V),
		p("VM", "VM", 50, 64, .M),
		p("MR", "RM", 84, 50, .M), p("ML", "LM", 16, 50, .M),
		p("TEN", "10", 50, 38, .M),
		p("SPr", "SP", 62, 20, .A), p("SPl", "SP", 38, 20, .A),
	],
	"4-2-3-1": [
		p("K", "K", 50, 92, .K),
		p("RV", "RV", 88, 75, .V), p("CVr", "CV", 64, 80, .V), p("CVl", "CV", 36, 80, .V), p("LV", "LV", 12, 75, .V),
		p("VMr", "VM", 64, 62, .M), p("VMl", "VM", 36, 62, .M),
		p("RA", "RA", 84, 38, .A), p("TEN", "10", 50, 43, .A), p("LA", "LA", 16, 38, .A),
		p("SP", "SP", 50, 18, .A),
	],

	/* ---------- 8-a-side ---------- */
	"1-3-3-1": [
		p("K", "K", 50, 91, .K),
		p("RV", "RV", 80, 74, .V), p("CV", "CV", 50, 79, .V), p("LV", "LV", 20, 74, .V),
		p("MR", "M", 78, 52, .M), p("MC", "M", 50, 58, .M), p("ML", "M", 22, 52, .M),
		p("SP", "SP", 50, 22, .A),
	],
	"1-3-2-2": [
		p("K", "K", 50, 91, .K),
		p("RV", "RV", 80, 76, .V), p("CV", "CV", 50, 81, .V), p("LV", "LV", 20, 76, .V),
		p("MR", "M", 70, 55, .M), p("ML", "M", 30, 55, .M),
		p("SPr", "SP", 66, 24, .A), p("SPl", "SP", 34, 24, .A),
	],
	"1-2-3-2": [
		p("K", "K", 50, 91, .K),
		p("RV", "RV", 70, 78, .V), p("LV", "LV", 30, 78, .V),
		p("MR", "M", 80, 54, .M), p("MC", "M", 50, 60, .M), p("ML", "M", 20, 54, .M),
		p("SPr", "SP", 66, 24, .A), p("SPl", "SP", 34, 24, .A),
	],

	/* ---------- 6-a-side ---------- */
	"1-2-2-1": [
		p("K", "K", 50, 90, .K),
		p("RV", "RV", 70, 73, .V), p("LV", "LV", 30, 73, .V),
		p("MR", "M", 70, 49, .M), p("ML", "M", 30, 49, .M),
		p("SP", "SP", 50, 24, .A),
	],
	"1-1-3-1": [
		p("K", "K", 50, 90, .K),
		p("CV", "CV", 50, 75, .V),
		p("MR", "M", 78, 51, .M), p("MC", "M", 50, 57, .M), p("ML", "M", 22, 51, .M),
		p("SP", "SP", 50, 22, .A),
	],
	"1-2-1-2": [
		p("K", "K", 50, 90, .K),
		p("RV", "RV", 70, 75, .V), p("LV", "LV", 30, 75, .V),
		p("MC", "M", 50, 54, .M),
		p("SPr", "SP", 66, 25, .A), p("SPl", "SP", 34, 25, .A),
	],

	/* ---------- 4-a-side, no keeper ---------- */
	"1-2-1": [
		p("V", "V", 50, 80, .V),
		p("MR", "M", 72, 52, .M), p("ML", "M", 28, 52, .M),
		p("SP", "SP", 50, 22, .A),
	],
	"2-2": [
		p("RV", "RV", 68, 76, .V), p("LV", "LV", 32, 76, .V),
		p("SPr", "SP", 66, 28, .A), p("SPl", "SP", 34, 28, .A),
	],
]

public struct Format: Equatable, Sendable {
	public struct Formatie: Equatable, Sendable {
		public var sleutel: String
		public var uitleg: String?

		public init(sleutel: String, uitleg: String? = nil) {
			self.sleutel = sleutel
			self.uitleg = uitleg
		}
	}

	public var name: String
	public var uitleg: String?
	public var formaties: [Formatie]

	public init(name: String, uitleg: String? = nil, formaties: [Formatie]) {
		self.name = name
		self.uitleg = uitleg
		self.formaties = formaties
	}
}

/**
 * Which formations belong to which format, in menu order.
 *
 * In youth football the keeper is written into the name (1-3-3-1 for 8-a-side);
 * at 11-a-side he is not (4-3-3). That is inconsistent, but it is how coaches
 * say it, so we follow them.
 */
public let FORMATS: [Format] = [
	Format(
		name: "11 tegen 11",
		formaties: [
			.init(sleutel: "4-3-3"),
			.init(sleutel: "4-4-2", uitleg: "vlak middenveld"),
			.init(sleutel: "4-4-2 diamond", uitleg: "één diep, één hoog"),
			.init(sleutel: "4-2-3-1"),
		]
	),
	Format(
		name: "8 tegen 8",
		formaties: [.init(sleutel: "1-3-3-1", uitleg: "meest gespeeld"), .init(sleutel: "1-3-2-2"), .init(sleutel: "1-2-3-2")]
	),
	Format(
		name: "6 tegen 6",
		formaties: [.init(sleutel: "1-2-2-1", uitleg: "meest gespeeld"), .init(sleutel: "1-1-3-1"), .init(sleutel: "1-2-1-2")]
	),
	Format(
		name: "4 tegen 4",
		uitleg: "zonder keeper",
		formaties: [
			.init(sleutel: "1-2-1", uitleg: "ruit"),
			.init(sleutel: "2-2", uitleg: "blok"),
		]
	),
]

/** Every formation name, in menu order. */
public func alleFormaties() -> [String] {
	FORMATS.flatMap { $0.formaties.map(\.sleutel) }
}

public let LINES: [Line: String] = [
	.A: "Aanval",
	.M: "Middenveld",
	.V: "Verdediging",
	.K: "Keeper",
	.geen: "Zonder linie",
]

/** Top to bottom, just like on the pitch. */
public let LINE_ORDER: [Line] = [.A, .M, .V, .K, .geen]

public func positionsOf(_ formation: String) -> [PositionSlot] {
	FORMATIONS[formation] ?? FORMATIONS["4-3-3"]!
}

/** How many players this formation puts on the pitch. */
public func positionCount(_ formation: String) -> Int {
	positionsOf(formation).count
}

/** Which lines occur in this formation. At 4-a-side that excludes the keeper. */
public func linesIn(_ formation: String) -> [Line] {
	let gevonden = Set(positionsOf(formation).map(\.line))
	return LINE_ORDER.filter { $0 != .geen && gevonden.contains($0) }
}

/** Which format this formation belongs to. */
public func formatOf(_ formation: String) -> String {
	FORMATS.first { $0.formaties.contains { $0.sleutel == formation } }?.name ?? ""
}

/**
 * Do we know this formation?
 *
 * Not replaceable by positionsOf(): that always falls back to 4-3-3 and so never
 * returns anything empty. A check using it does nothing at all, and then an
 * unknown name slips into the state unnoticed.
 */
public func knowsFormation(_ name: String?) -> Bool {
	guard let name = name.gevuld else { return false }
	return FORMATIONS.contains(name)
}

/** The readable name of a position: CVl is called CV, TEN is called 10. */
public func positionLabel(_ plekId: String, _ formation: String) -> String {
	positionsOf(formation).first { $0.id == plekId }?.label ?? plekId
}

public func positionLine(_ plekId: String, _ formation: String) -> Line {
	positionsOf(formation).first { $0.id == plekId }?.line ?? .geen
}

public func canKeep(_ p: Player) -> Bool {
	p.keeper == true
}

/** Which bench group someone belongs to: their field line, or Keeper if that is all they do. */
public func groupOf(_ p: Player) -> Line {
	switch p.line {
	case .V: return .V
	case .M: return .M
	case .A: return .A
	case .geen: return p.keeper == true ? .K : .geen
	}
}
