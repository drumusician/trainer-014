/** Setting up a match, tracking who is there, and finishing it. */
public enum MatchActions {
	public static func nieuwe(_ t: inout AppState, opponent: String, home: Bool, vandaag: String) {
		t.match = Match(
			date: vandaag,
			opponent: opponent.isEmpty ? "Tegenstander" : opponent,
			home: home,
			formation: t.formation,
			lineup: Lineup(),
			bench: [],
			events: [],
			elapsed: 0,
			since: nil,
			running: false,
			parts: t.parts,
			part: 1,
			inBreak: false,
			finished: false,
			absent: []
		)
		fillFromDefaultLineup(&t)
	}

	/** The match starts from the default lineup, as far as it still applies. */
	public static func fillFromDefaultLineup(_ t: inout AppState) {
		guard var w = t.match else { return }
		let ids = Set(t.players.map(\.id))
		if let st = t.defaultLineup, st.formation == w.formation {
			for (position, id) in st.lineup.entries {
				if let id = id.gevuld, ids.contains(id) { w.lineup[position] = id }
			}
		}
		t.match = w
		rebuildBench(&t)
	}

	/** The bench is everyone who is present and not on the pitch. */
	public static func rebuildBench(_ t: inout AppState) {
		guard var w = t.match else { return }
		let inVeld = w.lineup.opHetVeld
		let absent = w.absent ?? []
		w.bench = t.players.map(\.id).filter { !inVeld.contains($0) && !absent.contains($0) }
		t.match = w
	}

	public static func isOnPitch(_ w: Match?, _ spelerId: String) -> Bool {
		w?.lineup.includes(spelerId) ?? false
	}

	/**
	 * Marking someone absent is allowed as long as it does not change the lineup
	 * retroactively.
	 *
	 * Before kick-off: taking someone off the pitch is fine, their position falls
	 * empty. After that, no. Playing time is wound back from the lineup as it stands
	 * now, so anyone you remove from it never played according to that calculation —
	 * a fully played match silently becomes zero minutes. Someone who is playing you
	 * take off with a substitution. From the bench it is fine: that does not touch
	 * the pitch, and people do drop out after kick-off.
	 */
	@discardableResult
	public static func setAbsent(_ t: inout AppState, spelerId: String, absent: Bool) -> Bool {
		guard var w = t.match else { return false }
		if absent && ClockActions.kickedOff(w) && isOnPitch(w, spelerId) { return false }
		var lijst = (w.absent ?? []).filter { $0 != spelerId }
		if absent {
			lijst.append(spelerId)
			for position in w.lineup.positions where w.lineup[position] == spelerId {
				w.lineup[position] = nil
			}
		}
		w.absent = lijst
		t.match = w
		rebuildBench(&t)
		return true
	}

	@discardableResult
	public static func finish(_ w: inout Match, nu: Double) -> Bool {
		if w.finished { return false }
		if w.running {
			w.elapsed += (nu - (w.since ?? nu)) / 1000
			w.running = false
			w.since = nil
		}
		ClockActions.log(&w, nu: nu, .end)
		w.finished = true
		return true
	}

	@discardableResult
	public static func finish(_ w: inout Match?, nu: Double) -> Bool {
		met(&w) { finish(&$0, nu: nu) }
	}

	/**
	 * Put the match into the archive.
	 *
	 * Playing time is calculated once here and then stored. The final lineup goes
	 * with it: without that lineup there is nothing left to wind back from, and an
	 * archived match is beyond repair for good.
	 */
	@discardableResult
	public static func archiveMatch(_ t: inout AppState, nu: Double) -> ArchivedMatch? {
		guard var w = t.match, w.archived != true else { return nil }
		let tijden = playingTimes(w, t.players, nu: nu)
		let keepers = keeperTimes(w, nu: nu)
		let positions = positionTimes(w, nu: nu)
		var names = OrderedDict<String>()
		for p in t.players { names[p.id] = p.name }

		let regel = ArchivedMatch(
			date: w.date,
			opponent: w.opponent,
			home: w.home,
			score: score(w),
			formation: w.formation,
			duration: endTime(w),
			teamName: t.teamName,
			parts: w.parts,
			note: w.note,
			events: w.events,
			names: names,
			absent: w.absent ?? [],
			playingTime: t.players.compactMap { p in
				guard let seconden = tijden[p.id] else { return nil }
				/* only positions he actually stood in; a zero says nothing */
				var plekken = OrderedDict<Double>()
				for (position, sec) in (positions[p.id] ?? OrderedDict()).entries {
					let afgerond = jsRound(sec)
					if afgerond > 0 { plekken[position] = afgerond }
				}
				return PlayingTimeRow(
					id: p.id,
					name: p.name,
					seconds: jsRound(seconden),
					keeper: jsRound(keepers[p.id] ?? 0),
					positions: plekken
				)
			},
			lineup: w.lineup,
			bench: w.bench,
			id: w.id
		)
		t.archive.insert(regel, at: 0)
		w.archived = true
		t.match = w
		return regel
	}
}
