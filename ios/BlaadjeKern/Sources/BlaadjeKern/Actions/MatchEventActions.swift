/**
 * What happens during a match: substitutions, swaps, goals.
 *
 * Everything that changes the lineup also lands in the event list, and that is
 * not bookkeeping but the heart of it: playing time is derived from that list
 * and never typed in anywhere. Change the lineup without leaving an event
 * behind, and you rewrite the whole match retroactively.
 *
 * Before kick-off it is different: then you are simply picking a lineup, and
 * there is nothing yet to wind back to.
 */
public enum MatchEventActions {
	/** Put someone from the bench into a position. During a match that is a substitution. */
	@discardableResult
	public static func putOnPosition(_ w: inout Match, nu: Double, position: String, spelerId: String) -> Bool {
		let off = w.lineup[position]
		w.lineup[position] = spelerId
		w.bench = w.bench.filter { $0 != spelerId }
		if let off = off.gevuld {
			w.bench.append(off)
			if ClockActions.kickedOff(w) {
				ClockActions.log(&w, nu: nu, .substitution) {
					$0.off = off
					$0.on = spelerId
					$0.position = position
				}
			}
		}
		return true
	}

	@discardableResult
	public static func putOnPosition(_ w: inout Match?, nu: Double, position: String, spelerId: String) -> Bool {
		met(&w) { putOnPosition(&$0, nu: nu, position: position, spelerId: spelerId) }
	}

	/**
	 * Two players on the pitch swap positions. Recorded, because otherwise the time
	 * per position stops adding up.
	 */
	@discardableResult
	public static func ruil(_ w: inout Match, nu: Double, _ positionA: String, _ positionB: String) -> Bool {
		if positionA == positionB { return false }
		let a = w.lineup[positionA]
		let b = w.lineup[positionB]
		if a.gevuld == nil && b.gevuld == nil { return false }
		w.lineup[positionA] = b
		w.lineup[positionB] = a
		if ClockActions.kickedOff(w) {
			ClockActions.log(&w, nu: nu, .swap) {
				$0.positionA = positionA
				$0.positionB = positionB
				$0.playerA = a
				$0.playerB = b
			}
		}
		return true
	}

	@discardableResult
	public static func ruil(_ w: inout Match?, nu: Double, _ positionA: String, _ positionB: String) -> Bool {
		met(&w) { ruil(&$0, nu: nu, positionA, positionB) }
	}

	public static func goal(_ w: inout Match, nu: Double, spelerId: String?) {
		ClockActions.log(&w, nu: nu, .goal) { $0.player = spelerId }
	}

	public static func goal(_ w: inout Match?, nu: Double, spelerId: String?) {
		ClockActions.log(&w, nu: nu, .goal) { $0.player = spelerId }
	}

	public static func concede(_ w: inout Match, nu: Double) {
		ClockActions.log(&w, nu: nu, .conceded)
	}

	public static func concede(_ w: inout Match?, nu: Double) {
		ClockActions.log(&w, nu: nu, .conceded)
	}

	/** The assist on the last goal. May come later, may be skipped entirely. */
	@discardableResult
	public static func setAssist(_ w: inout Match, spelerId: String?) -> Bool {
		guard let i = w.events.lastIndex(where: { $0.type == .goal }) else { return false }
		w.events[i].assist = spelerId
		return true
	}

	@discardableResult
	public static func setAssist(_ w: inout Match?, spelerId: String?) -> Bool {
		met(&w) { setAssist(&$0, spelerId: spelerId) }
	}

	/** Tapped by mistake? The last action can be undone, as long as nothing came after it. */
	public static func undoable(_ w: Match?) -> String? {
		guard let laatste = w?.events.last else { return nil }
		switch laatste.type {
		case .goal: return "Doelpunt"
		case .conceded: return "Tegendoelpunt"
		case .substitution: return "Wissel"
		/* A position swap too. Tap the player who scored and then the one who set it
		   up, and you have accidentally made a swap — that has to be undoable. */
		case .swap: return "Positiewissel"
		default: return nil
		}
	}

	@discardableResult
	public static func undoLast(_ w: inout Match) -> Bool {
		guard undoable(w) != nil, let laatste = w.events.last else { return false }
		if laatste.type == .substitution, let position = laatste.position.gevuld {
			w.lineup[position] = laatste.off
			w.bench = w.bench.filter { $0 != laatste.off }
			if let on = laatste.on.gevuld, !w.bench.contains(on) { w.bench.append(on) }
		}
		if laatste.type == .swap, let positionA = laatste.positionA.gevuld, let positionB = laatste.positionB.gevuld {
			let a = w.lineup[positionA]
			w.lineup[positionA] = w.lineup[positionB]
			w.lineup[positionB] = a
		}
		w.events.removeLast()
		return true
	}

	@discardableResult
	public static func undoLast(_ w: inout Match?) -> Bool {
		met(&w) { undoLast(&$0) }
	}
}
