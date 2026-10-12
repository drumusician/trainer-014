import Foundation

public func mmss(_ sec: Double) -> String {
	func tweeBreed(_ d: Double) -> String {
		let s = jsGetal(d)
		return s.count < 2 ? "0" + s : s
	}
	let m = (sec / 60).rounded(.down)
	let r = sec.truncatingRemainder(dividingBy: 60).rounded(.down)
	return tweeBreed(m) + ":" + tweeBreed(r)
}

/** How much has been played, including the period currently running. */
public func elapsed(_ w: Match?, nu: Double) -> Double {
	guard let w else { return 0 }
	var t = w.elapsed
	if w.running, let since = w.since, since != 0 { t += (nu - since) / 1000 }
	return t.rounded(.down)
}

public func endTime(_ w: Match) -> Double {
	w.events.last { $0.type == .end }?.t ?? w.elapsed
}

public struct Interval: Equatable, Sendable {
	public var player: String
	public var position: String
	public var van: Double
	public var tot: Double

	public init(player: String, position: String, van: Double, tot: Double) {
		self.player = player
		self.position = position
		self.van = van
		self.tot = tot
	}
}

/**
 * Who stood where, and when. Everything to do with time comes out of this:
 * playing time per player, and goalkeeping minutes counted separately.
 *
 * The lineup we store is the one from RIGHT NOW, so we first wind back to
 * kick-off by undoing the substitutions in reverse order.
 */
public func fieldIntervals(_ w: Match?, nu: Double) -> [Interval] {
	guard let w else { return [] }
	let eind = w.finished ? endTime(w) : elapsed(w, nu: nu)
	/* Substitutions and swaps together: both change who stands where. */
	let beurten = w.events.filter { $0.type == .substitution || $0.type == .swap }

	var start = w.lineup
	terug: for g in beurten.reversed() {
		if g.type == .swap {
			guard let positionA = g.positionA.gevuld, let positionB = g.positionB.gevuld else { continue }
			let a = start[positionA]
			start[positionA] = start[positionB]
			start[positionB] = a
			continue
		}
		if let position = g.position.gevuld {
			/* A position that is not in the lineup at all only matches an event
			   that names nobody coming on; an empty position matches nothing. */
			let staatEr = start.has(position) ? (start[position] != nil && start[position] == g.on) : g.on == nil
			if staatEr {
				start[position] = g.off
				continue
			}
		}
		guard let on = g.on else { continue }
		for position in start.positions where start[position] == on {
			start[position] = g.off
			continue terug
		}
	}

	struct Bezetting {
		var player: String
		var since: Double
	}
	var bezet = OrderedDict<Bezetting>()
	for position in start.positions {
		if let id = start[position].gevuld { bezet[position] = Bezetting(player: id, since: 0) }
	}

	var uit: [Interval] = []
	for g in beurten {
		if g.type == .swap {
			/* Close both positions and reopen them at once, with the other player on. */
			let positionA = g.positionA.gevuld
			let positionB = g.positionB.gevuld
			let a = positionA.flatMap { bezet[$0] }
			let b = positionB.flatMap { bezet[$0] }
			if let a, let positionA { uit.append(Interval(player: a.player, position: positionA, van: a.since, tot: g.t)) }
			if let b, let positionB { uit.append(Interval(player: b.player, position: positionB, van: b.since, tot: g.t)) }
			if let positionB {
				bezet[positionB] = a.map { Bezetting(player: $0.player, since: g.t) }
			}
			if let positionA {
				bezet[positionA] = b.map { Bezetting(player: $0.player, since: g.t) }
			}
			continue
		}
		var position = g.position.gevuld
		if position == nil || bezet[position!]?.player != g.off {
			position = bezet.keys.first { bezet[$0]!.player == g.off } ?? position
		}
		if let position, let stond = bezet[position] {
			uit.append(Interval(player: stond.player, position: position, van: stond.since, tot: g.t))
		}
		if let position, let on = g.on.gevuld { bezet[position] = Bezetting(player: on, since: g.t) }
	}

	for position in bezet.keys {
		uit.append(Interval(player: bezet[position]!.player, position: position, van: bezet[position]!.since, tot: eind))
	}
	return uit
}

/** Seconds per player. Everyone in the squad is listed, zero included. */
public func playingTimes(_ w: Match?, _ players: [Player], nu: Double) -> OrderedDict<Double> {
	var totaal = OrderedDict<Double>()
	for p in players { totaal[p.id] = 0 }
	for i in fieldIntervals(w, nu: nu) {
		totaal[i.player] = (totaal[i.player] ?? 0) + (i.tot - i.van)
	}
	return totaal
}

/** Seconds in goal. Keeping for a half is not half a match of football. */
public func keeperTimes(_ w: Match?, nu: Double) -> OrderedDict<Double> {
	var uit = OrderedDict<Double>()
	guard let w else { return uit }
	for i in fieldIntervals(w, nu: nu) where positionLine(i.position, w.formation) == .K {
		uit[i.player] = (uit[i.player] ?? 0) + (i.tot - i.van)
	}
	return uit
}

/** Seconds per player per position. Who stood where, and for how long. */
public func positionTimes(_ w: Match?, nu: Double) -> OrderedDict<OrderedDict<Double>> {
	var uit = OrderedDict<OrderedDict<Double>>()
	for i in fieldIntervals(w, nu: nu) {
		var perPlek = uit[i.player] ?? OrderedDict<Double>()
		perPlek[i.position] = (perPlek[i.position] ?? 0) + (i.tot - i.van)
		uit[i.player] = perPlek
	}
	return uit
}

/**
 * A player's positions as one readable line, longest first:
 * "35 min K · 35 min LV". More than three positions becomes unreadable, so the
 * rest is collapsed into "overig".
 */
public func positionText(_ perPlek: OrderedDict<Double>?, _ formation: String) -> String {
	guard let perPlek else { return "" }
	let rijen = perPlek.entries
		.filter { $0.value > 0 }
		.jsSorted { a, b in b.value - a.value }
	if rijen.isEmpty { return "" }
	var eerste = rijen.prefix(3).map { jsGetal(jsRound($0.value / 60)) + " min " + positionLabel($0.key, formation) }
	let rest = rijen.dropFirst(3).reduce(0) { $0 + $1.value }
	if rest > 0 { eerste.append(jsGetal(jsRound(rest / 60)) + " min overig") }
	return eerste.joined(separator: " · ")
}

/**
 * The score the way it is said out loud: the home team first.
 *
 * `score` and every stored score stay ours first, because that is what all the
 * counting runs on. Only the moment it goes on a screen or into the report does it
 * turn around for an away match: 3–5 at Buitenboys, not 5–3.
 */
public func homeFirst(_ s: Score, _ home: Bool) -> Score {
	home ? s : Score(s.tegen, s.voor)
}

public func score(_ w: Match?) -> Score {
	guard let w else { return Score(0, 0) }
	return Score(w.events.filter { $0.type == .goal }.count, w.events.filter { $0.type == .conceded }.count)
}

public extension Match {
	/**
	 * An archived match set up again as a finished match, so everything that
	 * calculates from a match can calculate from the archive: the final lineup,
	 * the events, and the clock stopped at the duration.
	 */
	init(herbouwdUit a: ArchivedMatch) {
		self.init(
			date: a.date,
			opponent: a.opponent,
			home: a.home,
			formation: a.formation,
			lineup: a.lineup ?? Lineup(),
			bench: a.bench ?? [],
			events: a.events,
			elapsed: a.duration,
			since: nil,
			running: false,
			parts: a.parts ?? 2,
			part: a.parts ?? 2,
			inBreak: false,
			finished: true,
			note: a.note,
			absent: a.absent
		)
	}
}
