/**
 * The clock, and the events that hang off it.
 *
 * The clock is the only place where time is recorded, and therefore also where
 * kick-off enters the event list. That is delicate: the rest of the app does not
 * read "has it kicked off" from the clock but from the event list, and those two
 * must never drift apart.
 *
 * Every function exists twice: on a match that may be missing (`inout Match?`,
 * as the state holds it; nothing happens when there is none) and on a match you
 * have in hand.
 */
public enum ClockActions {
	/** Has it kicked off? Only then is the lineup fixed and does the clock count. */
	public static func kickedOff(_ w: Match?) -> Bool {
		w?.events.contains { $0.type == .start } ?? false
	}

	/** An event stamped with the clock as it reads right now. */
	public static func log(
		_ w: inout Match,
		nu: Double,
		_ type: MatchEventType,
		_ extra: (inout MatchEvent) -> Void = { _ in }
	) {
		var g = MatchEvent(type: type, t: elapsed(w, nu: nu))
		extra(&g)
		w.events.append(g)
	}

	public static func log(
		_ w: inout Match?,
		nu: Double,
		_ type: MatchEventType,
		_ extra: (inout MatchEvent) -> Void = { _ in }
	) {
		guard var m = w else { return }
		log(&m, nu: nu, type, extra)
		w = m
	}

	/** Adjust when the referee disagrees. Never below zero. */
	@discardableResult
	public static func verschuif(_ w: inout Match, seconds: Double) -> Bool {
		if w.finished { return false }
		w.elapsed = max(0, w.elapsed + seconds)
		return true
	}

	@discardableResult
	public static func verschuif(_ w: inout Match?, seconds: Double) -> Bool {
		met(&w) { verschuif(&$0, seconds: seconds) }
	}

	/**
	 * Start or pause.
	 *
	 * On the first start, kick-off enters the list and the match day is stamped —
	 * not on creation, because you can set a match up the evening before. The
	 * condition asks whether a start event already exists, not whether the list is
	 * empty: anyone still shuffling players before the whistle has already filled
	 * that list, and then kick-off was never recorded at all.
	 */
	@discardableResult
	public static func toggleRunning(_ w: inout Match, nu: Double, vandaag: String, wie: String? = nil) -> Bool {
		if w.finished { return false }
		if w.running {
			w.elapsed += (nu - (w.since ?? nu)) / 1000
			w.running = false
			w.since = nil
		} else {
			if !kickedOff(w) {
				w.date = vandaag
				/* Wie er tikt wordt hier vastgelegd en nergens anders. Bij de aftrap, want
				   daarna verandert het niet meer: wie begonnen is maakt de wedstrijd af. */
				if let wie = wie.gevuld { w.keptBy = wie }
				log(&w, nu: nu, .start)
			}
			w.running = true
			w.since = nu
		}
		return true
	}

	@discardableResult
	public static func toggleRunning(_ w: inout Match?, nu: Double, vandaag: String, wie: String? = nil) -> Bool {
		met(&w) { toggleRunning(&$0, nu: nu, vandaag: vandaag, wie: wie) }
	}

	/**
	 * End the current part, or begin the next one. Works the same for two halves as
	 * for four quarters.
	 */
	@discardableResult
	public static func togglePart(_ w: inout Match, nu: Double, vandaag: String) -> Bool {
		if w.finished { return false }
		if w.inBreak {
			w.part = min(w.part + 1, w.parts)
			w.inBreak = false
			if !w.running { toggleRunning(&w, nu: nu, vandaag: vandaag) }
		} else if w.part < w.parts {
			if w.running { toggleRunning(&w, nu: nu, vandaag: vandaag) }
			let deel = w.part
			log(&w, nu: nu, .break) { $0.part = deel }
			w.inBreak = true
		}
		return true
	}

	@discardableResult
	public static func togglePart(_ w: inout Match?, nu: Double, vandaag: String) -> Bool {
		met(&w) { togglePart(&$0, nu: nu, vandaag: vandaag) }
	}

	/**
	 * Set the clock to a given minute.
	 *
	 * This existed only as ±1′, which is fine when the referee is a minute out. It
	 * does not work when you enter a match afterwards: then you tap a whole hour
	 * together. If the clock is running we also move the reference point, otherwise
	 * the time since the last start would be added on top.
	 */
	@discardableResult
	public static func zetOp(_ w: inout Match, nu: Double, minuten: Double) -> Bool {
		if w.finished || !minuten.isFinite { return false }
		w.elapsed = max(0, jsRound(minuten * 60))
		if w.running { w.since = nu }
		return true
	}

	@discardableResult
	public static func zetOp(_ w: inout Match?, nu: Double, minuten: Double) -> Bool {
		met(&w) { zetOp(&$0, nu: nu, minuten: minuten) }
	}

	/** Is there another part to come, or is this the last one? */
	public static func canStartNextPart(_ w: Match?) -> Bool {
		guard let w else { return false }
		return !w.finished && (w.inBreak || w.part < w.parts)
	}
}

/** Do it to the match if there is one; without a match nothing happens and the answer is no. */
func met(_ w: inout Match?, _ doe: (inout Match) -> Bool) -> Bool {
	guard var m = w else { return false }
	let gelukt = doe(&m)
	w = m
	return gelukt
}
