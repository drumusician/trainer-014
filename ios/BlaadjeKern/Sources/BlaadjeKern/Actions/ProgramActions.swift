import Foundation

/**
 * Het programma en de taken: wat er aan wedstrijden komt, en wie wat regelt.
 *
 * Een wedstrijd in het programma is een gewone wedstrijd. Open je hem
 * (`open`), dan wordt hij `AppState.match`: daar maak je de opstelling, en
 * daar speel je hem. Open je een andere voordat de aftrap was, dan gaat deze
 * terug in het programma, met zijn opstelling. Het kenmerk blijft hetzelfde,
 * zodat de taken eraan vast blijven zitten.
 */
public enum ProgramActions {
	/** Vroegste eerst; zonder tijd vóór met tijd op dezelfde dag. */
	static func sorteer(_ t: inout AppState) {
		t.program.sort(by: eerder)
	}

	static func eerder(_ a: Match, _ b: Match) -> Bool {
		a.date != b.date ? a.date < b.date : (a.time ?? "") < (b.time ?? "")
	}

	/** Een aftrap als "10:30", of niets als het geen tijd is. */
	public static func tijd(_ s: String?) -> String? {
		guard let s = s?.jsTrim(), s.count == 5, s[s.index(s.startIndex, offsetBy: 2)] == ":",
			let uur = Int(s.prefix(2)), let min = Int(s.suffix(2)), (0...23).contains(uur), (0...59).contains(min)
		else { return nil }
		return s
	}

	/**
	 * Een wedstrijd erbij. Thuis staat de limonade al open, zodat een ouder hem
	 * pakt; uit zegt een ouder zelf dat hij rijdt.
	 */
	@discardableResult
	public static func voegToe(
		_ t: inout AppState, datum: String, tijd: String?, tegenstander: String, thuis: Bool,
		nieuwId: () -> String = { UUID().uuidString.lowercased() },
		taakId: () -> String = { UUID().uuidString.lowercased() }
	) -> String {
		let id = nieuwId()
		let naam = tegenstander.jsTrim()
		t.program.append(Match(
			date: datum, opponent: naam.isEmpty ? "Tegenstander" : naam, home: thuis, formation: t.formation,
			parts: t.parts, id: id, time: Self.tijd(tijd)))
		zetStandaardTaken(&t, id, thuis: thuis, taakId: taakId)
		sorteer(&t)
		return id
	}

	/**
	 * Welke taken er bij een wedstrijd horen. Uit regelt de thuisclub de
	 * limonade en het fluiten, en is er geen velddienst; thuis rijdt niemand.
	 */
	public static func soorten(thuis: Bool) -> [TaskKind] {
		thuis ? [.limonade, .fluiten, .vlaggen, .velddienst, .teamtas] : [.rijden, .vlaggen, .teamtas]
	}

	private static func zetStandaardTaken(_ t: inout AppState, _ wedstrijd: String, thuis: Bool, taakId: () -> String) {
		guard thuis, !t.tasks.contains(where: { $0.matchId == wedstrijd && $0.kind == .limonade }) else { return }
		t.tasks.append(TeamTask(id: taakId(), matchId: wedstrijd, kind: .limonade))
	}

	/** De wedstrijd die open staat, als die nog niet begonnen is. */
	private static func openNogNiet(_ t: AppState) -> Match? {
		guard let w = t.match, w.archived != true, !ClockActions.kickedOff(w) else { return nil }
		return w
	}

	/** Een wedstrijd die nog komt: uit het programma, of de wedstrijd die open staat en nog niet begon. */
	public static func wedstrijd(_ t: AppState, _ id: String) -> Match? {
		t.program.first { $0.id == id } ?? openNogNiet(t).flatMap { $0.id == id ? $0 : nil }
	}

	/** Iets aan een wedstrijd die nog komt veranderen, waar hij ook staat. */
	private static func pas(_ t: inout AppState, _ id: String, _ f: (inout Match) -> Void) -> Bool {
		if let i = t.program.firstIndex(where: { $0.id == id }) {
			f(&t.program[i])
			return true
		}
		guard openNogNiet(t)?.id == id, var w = t.match else { return false }
		f(&w)
		t.match = w
		return true
	}

	@discardableResult
	public static func wijzig(
		_ t: inout AppState, _ id: String, datum: String? = nil, tijd: String?? = nil, tegenstander: String? = nil, thuis: Bool? = nil
	) -> Bool {
		var wissel: Bool?
		let gelukt = pas(&t, id) { w in
			if let datum { w.date = datum }
			if let tijd { w.time = Self.tijd(tijd) }
			if let tegenstander { w.opponent = tegenstander.jsTrim().isEmpty ? "Tegenstander" : tegenstander }
			if let thuis, thuis != w.home {
				w.home = thuis
				wissel = thuis
			}
		}
		guard gelukt else { return false }
		if let thuis = wissel {
			// Van thuis naar uit of andersom: wat niet meer past gaat weg, wat open hoort komt erbij.
			let passend = soorten(thuis: thuis)
			t.tasks.removeAll { $0.matchId == id && !passend.contains($0.kind) }
			zetStandaardTaken(&t, id, thuis: thuis, taakId: { UUID().uuidString.lowercased() })
		}
		sorteer(&t)
		return true
	}

	/** Een wedstrijd die toch niet doorgaat, met zijn taken. */
	@discardableResult
	public static func haalWeg(_ t: inout AppState, _ id: String) -> Bool {
		if openNogNiet(t)?.id == id {
			t.match = nil
		} else {
			guard t.program.contains(where: { $0.id == id }) else { return false }
			t.program.removeAll { $0.id == id }
		}
		t.tasks.removeAll { $0.matchId == id }
		return true
	}

	/**
	 * Een wedstrijd uit het programma openen: Wie is er, de opstelling, het
	 * wisselplan, en op de dag zelf de aftrap. Staat er een andere open die nog
	 * niet begon, dan gaat die terug in het programma; een wedstrijd die bezig is
	 * gaat voor.
	 */
	@discardableResult
	public static func open(_ t: inout AppState, _ id: String) -> Bool {
		guard var p = t.program.first(where: { $0.id == id }) else { return false }
		if let w = t.match, w.archived != true {
			guard !ClockActions.kickedOff(w) else { return false }
			terugInProgramma(&t)
		}
		let spelers = Set(t.players.map(\.id))
		if p.formation.isEmpty || FORMATIONS[p.formation] == nil {
			// van vóór de opstelling in het programma: dan ook de delen van nu
			p.formation = t.formation
			p.parts = t.parts
		}
		p.absent = (p.absent ?? []).filter { spelers.contains($0) }
		p.archived = nil
		p.fromProgram = true
		MatchActions.zonderAfwezigen(&p)
		t.program.removeAll { $0.id == id }
		t.match = p
		if p.lineup.opHetVeld.isEmpty {
			MatchActions.fillFromDefaultLineup(&t)
		} else {
			MatchActions.rebuildBench(&t)
		}
		return true
	}

	/** Een wedstrijd die open staat en nog niet begon, terug in het programma: met zijn opstelling, en zijn taken. */
	public static func terugInProgramma(_ t: inout AppState) {
		guard var w = t.match, w.archived != true, !ClockActions.kickedOff(w) else { return }
		if w.id.gevuld == nil { w.id = UUID().uuidString.lowercased() }
		w.fromProgram = nil
		w.keptBy = nil
		t.match = nil
		t.program.removeAll { $0.id == w.id }
		t.program.append(w)
		sorteer(&t)
	}

	/** De wedstrijden waar een ouder iets aan kan regelen: wat nog komt, en die van nu. */
	public static func komend(_ t: AppState) -> [Match] {
		var uit: [Match] = []
		if let w = t.match, w.archived != true, w.id != nil { uit.append(w) }
		return uit + t.program
	}

	/** Wat nog komt en nog niet begon, vroegste eerst: het programma, met de wedstrijd die open staat. */
	public static func nogTeSpelen(_ t: AppState) -> [Match] {
		((openNogNiet(t).map { [$0] } ?? []) + t.program).sorted(by: eerder)
	}

	/** Wie zich voor deze wedstrijd afmeldde, op volgorde van de selectie. */
	public static func kanNiet(_ t: AppState, wedstrijd: String) -> [Player] {
		let weg = Set(Self.wedstrijd(t, wedstrijd)?.absent ?? [])
		return t.players.filter { weg.contains($0.id) }
	}

	// MARK: - taken

	public static func taken(_ t: AppState, wedstrijd: String) -> [TeamTask] {
		t.tasks.filter { $0.matchId == wedstrijd }
	}

	/** In plaats van een speler: de vereniging regelt het, zoals een clubscheidsrechter. */
	public static let vereniging = "vereniging"

	/** In plaats van een speler: de taak staat open, een ouder kan hem pakken. */
	public static let open = "open"

	/**
	 * Eén familie voor een taak die er één keer is (limonade, fluiten, vlaggen,
	 * velddienst, teamtas), `vereniging`, of `open` zodat een ouder hem pakt.
	 * Niemand (`nil`) haalt de taak weg.
	 */
	public static func zet(
		_ t: inout AppState, wedstrijd: String, _ soort: TaskKind, speler: String?,
		nieuwId: () -> String = { UUID().uuidString.lowercased() }
	) {
		let i = t.tasks.firstIndex { $0.matchId == wedstrijd && $0.kind == soort }
		guard let speler = speler.gevuld else {
			if let i { t.tasks.remove(at: i) }
			return
		}
		let club = speler == vereniging
		let openTaak = speler == open
		if let i {
			t.tasks[i].player = club || openTaak ? nil : speler
			t.tasks[i].club = club
			t.tasks[i].declinedBy = nil
		} else {
			t.tasks.append(TeamTask(id: nieuwId(), matchId: wedstrijd, kind: soort, player: club || openTaak ? nil : speler, club: club))
		}
	}

	/** Bij rijden kunnen het er meer zijn. Leeg is een plek waar nog iemand voor gezocht wordt. */
	@discardableResult
	public static func voegToe(
		_ t: inout AppState, wedstrijd: String, _ soort: TaskKind, speler: String?,
		nieuwId: () -> String = { UUID().uuidString.lowercased() }
	) -> String {
		let id = nieuwId()
		t.tasks.append(TeamTask(id: id, matchId: wedstrijd, kind: soort, player: speler.gevuld))
		return id
	}

	public static func wijs(_ t: inout AppState, taak: String, speler: String?) {
		guard let i = t.tasks.firstIndex(where: { $0.id == taak }) else { return }
		t.tasks[i].player = speler.gevuld
		t.tasks[i].declinedBy = nil
	}

	public static func haalTaakWeg(_ t: inout AppState, _ taak: String) {
		t.tasks.removeAll { $0.id == taak }
	}

	public static func woord(_ soort: TaskKind) -> String {
		switch soort {
		case .limonade: "Limonade"
		case .rijden: "Rijden"
		case .fluiten: "Fluiten"
		case .vlaggen: "Vlaggen"
		case .velddienst: "Velddienst"
		case .teamtas: "Teamtas"
		}
	}

	// MARK: - wie deed wat

	/** Eén keer dat een familie een taak had of heeft. */
	public struct Beurt: Equatable, Sendable {
		public let wedstrijd: String
		public let datum: String
		public let tegenstander: String
		public let speler: String?
		public let club: Bool
		/** Al gespeeld; anders staat hij nog in het programma of is hij bezig. */
		public let geweest: Bool
	}

	/**
	 * Per wedstrijd van dit seizoen wie deze taak had, oudste eerst: gespeeld,
	 * bezig, en wat nog komt. Bij rijden kunnen het er meer per wedstrijd zijn.
	 */
	public static func beurten(_ t: AppState, _ soort: TaskKind) -> [Beurt] {
		var wedstrijden: [(id: String, datum: String, tegen: String, geweest: Bool)] = []
		for w in t.archive { if let id = w.id { wedstrijden.append((id, w.date, w.opponent, true)) } }
		for k in komend(t) { if let id = k.id { wedstrijden.append((id, k.date, k.opponent, false)) } }
		var uit: [Beurt] = []
		for w in wedstrijden.sorted(by: { $0.datum < $1.datum }) {
			for taak in t.tasks where taak.matchId == w.id && taak.kind == soort && !taak.open {
				uit.append(Beurt(wedstrijd: w.id, datum: w.datum, tegenstander: w.tegen, speler: taak.player, club: taak.club, geweest: w.geweest))
			}
		}
		return uit
	}

	/** Hoe vaak elke speler deze taak had of heeft, minst vaak eerst; spelers die nog nooit aan de beurt waren ook. */
	public static func telling(_ t: AppState, _ soort: TaskKind) -> [(speler: Player, keer: Int)] {
		let beurten = beurten(t, soort)
		return t.players
			.map { p in (speler: p, keer: beurten.filter { $0.speler == p.id }.count) }
			.sorted { $0.keer != $1.keer ? $0.keer < $1.keer : $0.speler.name.localizedCompare($1.speler.name) == .orderedAscending }
	}
}
