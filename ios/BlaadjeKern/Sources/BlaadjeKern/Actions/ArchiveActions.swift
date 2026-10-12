/**
 * Amending an archived match.
 *
 * Only the score can be changed here, and that is deliberate: goals do not touch
 * the time calculation at all. Substitutions and swaps stay put, because playing
 * time hangs off them — and the calculation cannot recognise a wrong list as
 * wrong. It starts guessing instead, and returns believable, incorrect minutes.
 */
public enum ArchiveActions {
	/** The score follows from the goals, so recount after every change. */
	public static func recountScore(_ a: inout ArchivedMatch) {
		a.score = Score(a.events.filter { $0.type == .goal }.count, a.events.filter { $0.type == .conceded }.count)
	}

	/** Date, opponent, home or away. The numbers stay as they were. */
	@discardableResult
	public static func wijzig(
		_ t: inout AppState,
		_ i: Int,
		date: String? = nil,
		opponent: String? = nil,
		home: Bool? = nil
	) -> Bool {
		guard t.archive.indices.contains(i) else { return false }
		if let date { t.archive[i].date = date }
		if let opponent { t.archive[i].opponent = opponent }
		if let home { t.archive[i].home = home }
		return true
	}

	@discardableResult
	public static func setNote(_ t: inout AppState, _ i: Int, _ note: String) -> Bool {
		guard t.archive.indices.contains(i) else { return false }
		t.archive[i].note = note
		return true
	}

	public static func verwijderWedstrijd(_ t: inout AppState, _ i: Int) {
		/* Array.splice: a negative index counts from the end. */
		let start = i < 0 ? max(t.archive.count + i, 0) : i
		guard t.archive.indices.contains(start) else { return }
		t.archive.remove(at: start)
	}

	/** Remove a goal that never happened. */
	@discardableResult
	public static func removeGoal(_ t: inout AppState, _ i: Int, _ index: Int) -> Bool {
		guard t.archive.indices.contains(i), t.archive[i].events.indices.contains(index) else { return false }
		let g = t.archive[i].events[index]
		guard g.type == .goal || g.type == .conceded else { return false }
		t.archive[i].events.remove(at: index)
		recountScore(&t.archive[i])
		return true
	}

	/** A goal you missed, slotted in at the right minute. */
	@discardableResult
	public static func addGoal(
		_ t: inout AppState,
		_ i: Int,
		minuut: Double,
		spelerId: String?,
		tegen: Bool = false
	) -> Bool {
		guard t.archive.indices.contains(i) else { return false }
		let gebeurtenis = tegen
			? MatchEvent(type: .conceded, t: max(0, jsRound(minuut * 60)))
			: MatchEvent(type: .goal, t: max(0, jsRound(minuut * 60)), player: spelerId)
		t.archive[i].events = (t.archive[i].events + [gebeurtenis]).jsSorted { x, y in x.t - y.t }
		recountScore(&t.archive[i])
		return true
	}
}
