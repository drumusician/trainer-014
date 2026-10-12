/**
 * Het wisselplan: een spiekbriefje, geen wekker.
 *
 * Wat je vooraf weet — Casper keept de tweede helft, Alain komt rond minuut 25
 * voor Max — staat hier. Wat er in de wedstrijd gebeurt blijft de waarheid: of
 * een stap gedaan is, volgt uit de wissels die echt in het verloop staan, niet
 * uit een vinkje. Doe je dezelfde wissel met de hand, dan telt hij. Maak je hem
 * ongedaan, dan staat de stap weer open.
 *
 * Een stap die niet meer kan (hij staat niet meer in het veld, zij is er niet)
 * zegt waarom. De app wisselt nooit zelf en zegt nooit dat het nú moet: het goede
 * moment kiest de trainer.
 */

public enum StapStatus: String, Sendable {
	case gedaan, overgeslagen, open
}

/** Waarom een stap niet kan. Kan hij wel, dan is er geen reden: nil. */
public enum KanNiet: String, Sendable {
	case afwezig, alInHetVeld, nietInHetVeld, nietBeideInHetVeld
}

/** Binnen zoveel minuten na erin of eruit is een geplande stap met hem opvallend. */
public let PAS_GELEDEN = 10

/**
 * Zoveel minuten van tevoren komt een stap onder het veld in beeld. Eerder is
 * het ruis: in minuut 10 hoef je nog niet te lezen wat er in de rust gebeurt.
 */
public let VOORUIT = 5

public struct PlanStap: Equatable, Sendable {
	public var stap: PlannedSub
	public var status: StapStatus
	/** waar `on` erin zou komen: de plek van `off`, nu */
	public var positie: String?
	/** bij een ruil: waar `on` nu staat */
	public var positieOn: String?
	/** waarom hij nu niet kan; nil als hij kan */
	public var kanNiet: KanNiet?
	/** de minuut is voorbij */
	public var aanDeBeurt: Bool
	/** zo dichtbij dat hij onder het veld hoort te staan: VOORUIT minuten ervoor, of al aan de beurt */
	public var inZicht: Bool
	/**
	 * Kan wel, maar is vreemd: wie eruit moet kwam er pas zoveel minuten geleden
	 * in, of wie erin moet ging er net uit. Na een rommelige wedstrijd met wissels
	 * die niet gepland waren. Nil als er niets opvalt.
	 */
	public var pasErin: Int?
	public var pasEruit: Int?

	public init(
		stap: PlannedSub,
		status: StapStatus,
		positie: String?,
		positieOn: String?,
		kanNiet: KanNiet?,
		aanDeBeurt: Bool,
		inZicht: Bool,
		pasErin: Int?,
		pasEruit: Int?
	) {
		self.stap = stap
		self.status = status
		self.positie = positie
		self.positieOn = positieOn
		self.kanNiet = kanNiet
		self.aanDeBeurt = aanDeBeurt
		self.inZicht = inZicht
		self.pasErin = pasErin
		self.pasEruit = pasEruit
	}
}

private func redenKanNiet(_ stap: PlannedSub, _ plekVan: (String) -> String?, _ afwezig: Set<String>) -> KanNiet? {
	let plekOff = plekVan(stap.off).gevuld
	let plekOn = plekVan(stap.on).gevuld
	if stap.soort == .ruil { return plekOff == nil || plekOn == nil ? .nietBeideInHetVeld : nil }
	if afwezig.contains(stap.on) { return .afwezig }
	if plekOn != nil { return .alInHetVeld }
	if plekOff == nil { return .nietInHetVeld }
	return nil
}

private enum Kant {
	case on, off
}

/** Hoeveel minuten geleden, als het minder is dan PAS_GELEDEN; anders nil. */
private func pasGeleden(_ w: Match, _ seconden: Double, _ id: String, _ kant: Kant) -> Int? {
	guard let laatste = w.events.last(where: { $0.type == .substitution && (kant == .on ? $0.on : $0.off) == id })
	else { return nil }
	let min = Int(((seconden - laatste.t) / 60).rounded(.down))
	return min < PAS_GELEDEN ? max(1, min) : nil
}

/* Gedaan als het in het verloop staat, ook als je het met de hand deed. */
private func gedaan(_ w: Match, _ s: PlannedSub) -> Bool {
	if s.soort == .ruil {
		return w.events.contains { g in
			g.type == .swap
				&& ((g.playerA == s.on && g.playerB == s.off) || (g.playerA == s.off && g.playerB == s.on))
		}
	}
	return w.events.contains { $0.type == .substitution && $0.on == s.on && $0.off == s.off }
}

/** Het hele plan op volgorde van minuut, met per stap hoe het ervoor staat. */
public func planStappen(_ w: Match?, nu: Double) -> [PlanStap] {
	guard let w, let plan = w.plan, !plan.isEmpty else { return [] }
	let plekVan: (String) -> String? = { w.lineup.positionOf($0) }
	let afwezig = Set(w.absent ?? [])
	let seconden = elapsed(w, nu: nu)
	return plan
		.jsSorted { a, b in Double(a.minuut - b.minuut) }
		.map { stap in
			let status: StapStatus = gedaan(w, stap) ? .gedaan : stap.skipped == true ? .overgeslagen : .open
			let positie = plekVan(stap.off)
			let positieOn = plekVan(stap.on)
			let kanNiet = redenKanNiet(stap, plekVan, afwezig)
			/* Een pauzewissel is aan de beurt zodra de pauze er is, niet op de klok. */
			let aanDeBeurt: Bool
			if let naDeel = stap.naDeel, naDeel != 0 {
				aanDeBeurt = w.part > naDeel || (w.part == naDeel && w.inBreak)
			} else {
				aanDeBeurt = seconden >= Double(stap.minuut) * 60
			}
			let inZicht = aanDeBeurt || seconden >= Double(stap.minuut - VOORUIT) * 60
			let vreemd = status == .open && kanNiet == nil
			return PlanStap(
				stap: stap,
				status: status,
				positie: positie,
				positieOn: positieOn,
				kanNiet: kanNiet,
				aanDeBeurt: aanDeBeurt,
				inZicht: inZicht,
				pasErin: vreemd ? pasGeleden(w, seconden, stap.off, .on) : nil,
				pasEruit: vreemd && stap.soort != .ruil ? pasGeleden(w, seconden, stap.on, .off) : nil
			)
		}
}

/**
 * De eerstvolgende stap die nu kan. Wat niet meer kan schuift stil opzij in
 * plaats van dat je het langs de lijn moet wegtikken; wordt hij later weer
 * mogelijk, dan komt hij vanzelf terug.
 */
public func volgendeStap(_ w: Match?, nu: Double) -> PlanStap? {
	planStappen(w, nu: nu).first { $0.status == .open && $0.kanNiet == nil }
}

/** Hoeveel stappen er nu nog kunnen, de volgende meegeteld. */
public func nogOpen(_ w: Match?, nu: Double) -> Int {
	planStappen(w, nu: nu).filter { $0.status == .open && $0.kanNiet == nil }.count
}

/**
 * Kan deze stap op zijn eigen moment, met de stappen daarvoor meegerekend? Voor
 * de lijst in het plan: vóór de wedstrijd staat Kasper nog in het doel, maar na
 * de keeperwissel in de rust kan hij best het veld in.
 */
public func kanNietOpMoment(_ w: Match?, _ stap: PlannedSub) -> KanNiet? {
	guard let w else { return nil }
	let stand = standOp(w, stap.minuut, voorStap: stap.id)
	let plekVan: (String) -> String? = { id in stand.veld.first { $0.id == id }?.plek }
	return redenKanNiet(stap, plekVan, Set(w.absent ?? []))
}

public struct Stand: Equatable, Sendable {
	public struct Plek: Equatable, Sendable {
		public var plek: String
		public var id: String

		public init(plek: String, id: String) {
			self.plek = plek
			self.id = id
		}
	}

	/** wie er in het veld staat, per plek */
	public var veld: [Plek]
	public var bank: [String]

	public init(veld: [Plek], bank: [String]) {
		self.veld = veld
		self.bank = bank
	}
}

/**
 * Hoe het er rond deze minuut voor staat als het plan doorgaat: de opstelling
 * van nu, met de open stappen tot en met die minuut erop toegepast, op volgorde.
 *
 * Voor het maken van een plan. Wie rond minuut 35 erin kan, is wie er dan op de
 * bank zit, niet wie er nu zit. Gedane stappen zitten al in de opstelling van
 * nu; overgeslagen stappen tellen niet. Een stap die op dat moment niet kan,
 * slaan we over in plaats van te gokken.
 */
public func standOp(_ w: Match?, _ minuut: Int, voorStap: String? = nil) -> Stand {
	guard let w else { return Stand(veld: [], bank: []) }
	var lineup = w.lineup
	var bank = w.bench
	/* Hier telt alleen of een stap open is, en dat hangt niet van de klok af. */
	for s in planStappen(w, nu: 0) {
		/* voorStap: hoe het ervoor staat vlak vóór die stap, voor de plekken in de lijst */
		if s.stap.id == voorStap { break }
		if s.status != .open || s.stap.minuut > minuut { continue }
		let plek = lineup.positionOf(s.stap.off).gevuld
		if s.stap.soort == .ruil {
			guard let plek, let plekOn = lineup.positionOf(s.stap.on).gevuld else { continue }
			lineup[plek] = s.stap.on
			lineup[plekOn] = s.stap.off
			continue
		}
		let opVeld = lineup.includes(s.stap.on)
		guard let plek, !opVeld, let i = bank.firstIndex(of: s.stap.on) else { continue }
		lineup[plek] = s.stap.on
		bank.remove(at: i)
		bank.append(s.stap.off)
	}
	return Stand(
		veld: lineup.entries.compactMap { r in r.player.gevuld.map { Stand.Plek(plek: r.position, id: $0) } },
		bank: bank
	)
}

/** Wanneer een stap valt, zoals je het zegt: '25′', 'Rust' of 'Pauze na 1e kwart'. */
public func wanneer(_ stap: PlannedSub, _ parts: Int) -> String {
	if let naDeel = stap.naDeel, naDeel != 0 { return momentName(naDeel, parts) }
	return "\(stap.minuut)′"
}
