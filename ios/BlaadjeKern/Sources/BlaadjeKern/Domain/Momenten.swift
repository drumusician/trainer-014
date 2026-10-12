/**
 * De opstelling terugkijken, moment voor moment.
 *
 * Een opgeborgen wedstrijd bewaart de opstelling zoals die aan het eind stond,
 * plus alle wissels. Wie er begon staat er dus niet in — maar is er wel uit te
 * rekenen, precies zoals de speeltijd dat al doet: terugspoelen langs de wissels.
 *
 * Dat is nodig sinds er een tweede trainer is. Deed iemand anders de wedstrijd,
 * dan zie je achteraf wel wie er gewisseld is, maar niet waar je team mee begon —
 * en dan zegt zo'n lijst wissels je weinig.
 */
public struct Moment: Equatable, Sendable {
	/** seconden na de aftrap */
	public var t: Double
	/** wat er op dat moment gebeurde, in de woorden van het verloop */
	public var tekst: String
	public var lineup: OrderedDict<String>
	public var bench: [String]
	/**
	 * De plekken die op dit moment van speler wisselden.
	 *
	 * Bij een gewone wissel blijft de pion staan en verandert alleen de naam erin;
	 * dan zie je zonder aanwijzing niet wáár het gebeurde. Bij de aftrap is er
	 * niets veranderd, dus dan is deze leeg.
	 */
	public var veranderd: [String]

	public init(t: Double, tekst: String, lineup: OrderedDict<String>, bench: [String], veranderd: [String]) {
		self.t = t
		self.tekst = tekst
		self.lineup = lineup
		self.bench = bench
		self.veranderd = veranderd
	}
}

/**
 * Elk moment waarop de opstelling veranderde, te beginnen bij de aftrap.
 *
 * Wissels op dezelfde seconde horen bij één moment: in de rust gaan er vier
 * tegelijk, en dan wil je niet vier keer op Volgende tikken voor hetzelfde beeld.
 *
 * Leeg als de eindopstelling niet bewaard is. Dat is bij wedstrijden van voor die
 * gegevens meegingen; dan valt er niets terug te rekenen en is niets tonen beter
 * dan iets verzinnen.
 */
public func momentenVan(_ a: ArchivedMatch, _ players: [Player]) -> [Moment] {
	guard let eind = a.lineup, !eind.opHetVeld.isEmpty else { return [] }

	let w = Match(herbouwdUit: a)

	/* De wedstrijd is afgelopen, dus de klok van nu doet er niet toe. */
	let intervallen = fieldIntervals(w, nu: 0)
	if intervallen.isEmpty { return [] }

	let afwezig = Set(a.absent ?? [])
	/* Wie er die dag bij was: iedereen met een speeltijdrij, min wie is afgemeld.
	   Zo staat iemand die nul minuten speelde wel op de bank, want dat is waar hij
	   stond. */
	let erbij = a.playingTime.compactMap { $0.id.gevuld }.filter { !afwezig.contains($0) }

	let regels = timelineRows(a.events, players, a.names, a.parts ?? 2, a.formation)
	func tekstOp(_ t: Double) -> String {
		regels
			.filter { r in r.t == t && (t == 0 ? r.type == .start : r.type == .substitution || r.type == .swap) }
			.map(\.tekst)
			.joined(separator: " · ")
	}

	let tijden = [0] + a.events.filter { $0.type == .substitution || $0.type == .swap }.map(\.t)

	var gezien = Set<Double>()
	var uit: [Moment] = []
	var vorige: OrderedDict<String>? = nil
	for t in tijden.sorted() {
		if gezien.contains(t) { continue }
		gezien.insert(t)
		var lineup = OrderedDict<String>()
		for i in intervallen where i.van <= t && t < i.tot { lineup[i.position] = i.player }
		let opHetVeld = Set(lineup.values)
		/* Ook plekken die leeg raakten tellen mee, vandaar allebei de kanten. */
		var plekken: [String] = []
		if let vorige {
			for plek in lineup.keys + vorige.keys where !plekken.contains(plek) { plekken.append(plek) }
		}
		let tekst = tekstOp(t)
		uit.append(
			Moment(
				t: t,
				tekst: tekst.isEmpty ? "Aftrap" : tekst,
				lineup: lineup,
				bench: erbij.filter { !opHetVeld.contains($0) },
				veranderd: plekken.filter { lineup[$0] != vorige?[$0] }
			)
		)
		vorige = lineup
	}
	return uit
}
