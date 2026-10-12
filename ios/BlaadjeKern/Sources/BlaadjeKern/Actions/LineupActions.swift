/**
 * Picking a lineup outside a running match: the default lineup, and the
 * shuffling you do before kick-off.
 *
 * These functions never touch the event list. What happens during a match does
 * belong in that list, and therefore lives in MatchEventActions rather than here.
 */
public enum LineupActions {
	/** What you are picking: today's match, or the default lineup. */
	public enum Bron: String, Sendable {
		case wedstrijd, standaard
	}

	/** The lineup you are working on, as it stands: a copy to read from. */
	public struct Opzet: Equatable, Sendable {
		public var formation: String
		public var lineup: Lineup
		public var bench: [String]

		public init(formation: String, lineup: Lineup, bench: [String]) {
			self.formation = formation
			self.lineup = lineup
			self.bench = bench
		}
	}

	public static func doelVan(_ t: AppState, _ bron: Bron) -> Opzet? {
		switch bron {
		case .standaard:
			return t.defaultLineup.map { Opzet(formation: $0.formation, lineup: $0.lineup, bench: $0.bench) }
		case .wedstrijd:
			return t.match.map { Opzet(formation: $0.formation, lineup: $0.lineup, bench: $0.bench) }
		}
	}

	/* Change the lineup and the bench of whichever of the two you are picking. */
	private static func metDoel(
		_ t: inout AppState,
		_ bron: Bron,
		_ doe: (inout Lineup, inout [String]) -> Bool
	) -> Bool {
		switch bron {
		case .standaard:
			guard var st = t.defaultLineup else { return false }
			let gelukt = doe(&st.lineup, &st.bench)
			t.defaultLineup = st
			return gelukt
		case .wedstrijd:
			guard var w = t.match else { return false }
			let gelukt = doe(&w.lineup, &w.bench)
			t.match = w
			return gelukt
		}
	}

	/** Makes sure a default lineup exists that matches the squad and the formation. */
	@discardableResult
	public static func ensureDefaultLineup(_ t: inout AppState) -> DefaultLineup {
		if t.defaultLineup == nil { t.defaultLineup = DefaultLineup(formation: t.formation, lineup: Lineup(), bench: []) }
		if !FORMATIONS.contains(t.defaultLineup!.formation) { t.defaultLineup!.formation = t.formation }
		moveDefaultToFormation(&t, t.formation)
		var st = t.defaultLineup!
		let ids = t.players.map(\.id)
		for position in st.lineup.positions {
			if let id = st.lineup[position], ids.contains(id) { continue }
			st.lineup.remove(position)
		}
		let inVeld = st.lineup.opHetVeld
		st.bench = ids.filter { !inVeld.contains($0) }
		t.defaultLineup = st
		return st
	}

	/** Swap two positions. If one is empty, the other player simply moves there. */
	@discardableResult
	public static func swapPositions(_ t: inout AppState, _ bron: Bron, _ positionA: String, _ positionB: String) -> Bool {
		if positionA == positionB { return false }
		return metDoel(&t, bron) { lineup, _ in
			let a = lineup[positionA]
			let b = lineup[positionB]
			if a.gevuld == nil && b.gevuld == nil { return false }
			lineup[positionA] = b
			lineup[positionB] = a
			return true
		}
	}

	/** Take someone off the pitch without anyone coming on in their place. */
	@discardableResult
	public static func takeOffPitch(_ t: inout AppState, _ bron: Bron, _ position: String) -> Bool {
		metDoel(&t, bron) { lineup, bench in
			guard let id = lineup[position].gevuld else { return false }
			lineup[position] = nil
			if !bench.contains(id) { bench.append(id) }
			return true
		}
	}

	/** Put someone in the chosen position; whoever stood there goes to the bench. */
	@discardableResult
	public static func zetOpPlekInOpzet(_ t: inout AppState, _ bron: Bron, _ position: String, _ spelerId: String) -> Bool {
		metDoel(&t, bron) { lineup, bench in
			let oud = lineup[position]
			lineup[position] = spelerId
			bench = bench.filter { $0 != spelerId }
			if let oud = oud.gevuld { bench.append(oud) }
			return true
		}
	}

	/**
	 * Carry the default lineup over to another formation. Anyone in a position that
	 * also exists in the new formation stays put; the rest shift along within their
	 * own line. What does not fit goes to the bench, and positions left over stay
	 * empty: the coach fills those in.
	 */
	@discardableResult
	public static func moveDefaultToFormation(_ t: inout AppState, _ formation: String) -> Bool {
		guard var st = t.defaultLineup, st.formation != formation, FORMATIONS.contains(formation) else { return false }
		let uit = convertLineup(st.lineup, st.formation, formation, st.bench)
		st.formation = formation
		st.lineup = uit.lineup
		st.bench = uit.bench
		t.defaultLineup = st
		return true
	}

	/**
	 * The team's formation. There is only one: your default lineup is in it and your
	 * next match starts from it. Wherever you change it, it moves along.
	 */
	@discardableResult
	public static func chooseFormation(_ t: inout AppState, _ formation: String) -> Bool {
		if !FORMATIONS.contains(formation) { return false }
		t.formation = formation
		moveDefaultToFormation(&t, formation)
		return true
	}

	public static func clearDefaultLineup(_ t: inout AppState) {
		t.defaultLineup = nil
	}
}
