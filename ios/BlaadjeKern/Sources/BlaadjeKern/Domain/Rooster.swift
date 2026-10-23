/**
 * Het wisselplan als rooster: per speler een regel, per blok een kolom, en de
 * minuten erachter. Zo zie je in één oogopslag wie wanneer speelt en of het
 * eerlijk verdeeld is.
 *
 * Het rooster is een blik op het plan, geen tweede plan: wat erin staat volgt
 * uit de opstelling en de stappen. Tik je in een kolom wie eruit gaat en wie
 * erin komt, dan is dat gewoon een stap op de grens van dat blok.
 *
 * Meestal is een wedstrijd in vieren gehakt: bij kwarten elk kwart een blok,
 * bij helften elke helft in tweeën. Halverwege een helft is een goed moment om
 * te wisselen; bij kwarten is dat de pauze.
 */

public struct Blok: Equatable, Sendable {
	/** de minuut waarop het blok begint, over de hele wedstrijd */
	public var start: Int
	public var eind: Int
	/** begint het blok na een pauze, dan na welk deel; anders nil */
	public var naDeel: Int?
	/** kun je hier nog een wissel op de grens zetten: de grens komt nog */
	public var teVeranderen: Bool

	public init(start: Int, eind: Int, naDeel: Int?, teVeranderen: Bool) {
		self.start = start
		self.eind = eind
		self.naDeel = naDeel
		self.teVeranderen = teVeranderen
	}
}

public struct RoosterRegel: Equatable, Sendable, Identifiable {
	public var id: String
	/** per blok de plek in het veld, of nil op de bank */
	public var plekken: [String?]
	/** gespeeld en nog gepland, in hele minuten */
	public var minuten: Int
	/** duidelijk minder dan eerlijk is */
	public var weinig: Bool

	public init(id: String, plekken: [String?], minuten: Int, weinig: Bool) {
		self.id = id
		self.plekken = plekken
		self.minuten = minuten
		self.weinig = weinig
	}
}

public struct Rooster: Equatable, Sendable {
	public var blokken: [Blok]
	public var regels: [RoosterRegel]
	/** zoveel minuten krijgt iedereen als je het helemaal gelijk verdeelt */
	public var eerlijk: Int

	public init(blokken: [Blok], regels: [RoosterRegel], eerlijk: Int) {
		self.blokken = blokken
		self.regels = regels
		self.eerlijk = eerlijk
	}
}

/** De blokken van een wedstrijd: bij vier delen of meer elk deel, anders elk deel in tweeën. */
public func roosterBlokken(parts: Int, minutesPerPart: Double) -> [(start: Int, naDeel: Int?)] {
	let delen = max(1, parts)
	let perDeel = delen >= 4 ? 1 : 2
	var uit: [(start: Int, naDeel: Int?)] = []
	for d in 0..<delen {
		for k in 0..<perDeel {
			let start = Int(jsRound(minutesPerPart * (Double(d) + Double(k) / Double(perDeel))))
			uit.append((start, k == 0 && d > 0 ? d : nil))
		}
	}
	return uit
}

/**
 * Het rooster van deze wedstrijd. Vóór de aftrap alles vooruit; daarna telt wat
 * er gespeeld is, en de blokken die al voorbij zijn vallen weg.
 */
public func rooster(_ w: Match, _ players: [Player], minutesPerPart: Double, nu: Double) -> Rooster {
	let totaal = Int(jsRound(minutesPerPart * Double(max(1, w.parts))))
	let nuMinuut = ClockActions.kickedOff(w) ? Int((elapsed(w, nu: nu) / 60).rounded(.down)) : 0
	let grenzen = roosterBlokken(parts: w.parts, minutesPerPart: minutesPerPart)
	var blokken: [Blok] = []
	for (i, g) in grenzen.enumerated() {
		let eind = i + 1 < grenzen.count ? grenzen[i + 1].start : totaal
		guard eind > nuMinuut || i == grenzen.count - 1 else { continue }
		blokken.append(Blok(start: g.start, eind: eind, naDeel: g.naDeel, teVeranderen: i > 0 && g.start >= nuMinuut))
	}

	// Wie erbij hoort: wie er bij de aftrap staat, op volgorde van het veld, en dan de bank.
	let begin = standOp(w, nuMinuut)
	var ids = begin.veld.map(\.id)
	for id in begin.bank where !ids.contains(id) { ids.append(id) }
	let afwezig = Set(w.absent ?? [])
	ids.removeAll { afwezig.contains($0) }

	// De minuten: wat al gespeeld is, en per stukje tot het eind wie er dan staat.
	var minuten: [String: Double] = [:]
	let gespeeld = playingTimes(w, players, nu: nu)
	for id in ids { minuten[id] = (gespeeld[id] ?? 0) / 60 }
	var momenten = Set([nuMinuut, totaal])
	for b in blokken where b.start > nuMinuut { momenten.insert(b.start) }
	for s in w.plan ?? [] where s.minuut > nuMinuut && s.minuut < totaal { momenten.insert(s.minuut) }
	let op = momenten.sorted()
	for (a, b) in zip(op, op.dropFirst()) {
		for plek in standOp(w, a).veld { minuten[plek.id, default: 0] += Double(b - a) }
	}

	let veldplekken = positionCount(w.formation)
	let eerlijk = ids.isEmpty ? 0 : Int(jsRound(Double(min(veldplekken, ids.count) * totaal) / Double(ids.count)))
	let blokLengte = Double(totaal) / Double(max(1, grenzen.count))
	let regels = ids.map { id in
		let plekken = blokken.map { b in standOp(w, max(b.start, nuMinuut)).veld.first { $0.id == id }?.plek }
		let m = Int(jsRound(minuten[id] ?? 0))
		return RoosterRegel(id: id, plekken: plekken, minuten: m, weinig: Double(m) < Double(eerlijk) - blokLengte / 2)
	}
	return Rooster(blokken: blokken, regels: regels, eerlijk: eerlijk)
}

extension PlanActions {
	/**
	 * In het rooster op de grens van een blok twee spelers aangetikt: wie dan in
	 * het veld staat gaat eruit, wie op de bank zit komt erin. Stond precies die
	 * wissel er andersom al, dan gaat die weg: zo maak je een tik ongedaan.
	 */
	@discardableResult
	public static func wisselInRooster(
		_ w: inout Match,
		_ blok: Blok,
		_ a: String,
		_ b: String,
		nieuwId: () -> String = IdGenerator.standaard("w")
	) -> Bool {
		guard blok.teVeranderen, a != b else { return false }
		let stand = standOp(w, blok.start)
		let inVeld = Set(stand.veld.map(\.id))
		guard inVeld.contains(a) != inVeld.contains(b) else { return false }
		let eruit = inVeld.contains(a) ? a : b
		let erin = eruit == a ? b : a
		guard stand.bank.contains(erin) else { return false }
		if let terug = w.plan?.first(where: {
			$0.minuut == blok.start && $0.soort != .ruil && $0.skipped != true && $0.on == eruit && $0.off == erin
		}) {
			return haalWeg(&w, id: terug.id)
		}
		return voegToe(&w, minuut: Double(blok.start), on: erin, off: eruit, naDeel: blok.naDeel, nieuwId: nieuwId)
	}

	@discardableResult
	public static func wisselInRooster(
		_ w: inout Match?,
		_ blok: Blok,
		_ a: String,
		_ b: String,
		nieuwId: () -> String = IdGenerator.standaard("w")
	) -> Bool {
		met(&w) { wisselInRooster(&$0, blok, a, b, nieuwId: nieuwId) }
	}
}
