public struct AttendanceSummary: Equatable, Sendable {
	/** how often present */
	public var er: Int
	/** how many sessions count towards this */
	public var totaal: Int

	public init(er: Int, totaal: Int) {
		self.er = er
		self.totaal = totaal
	}
}

/** Sessions are ordered by date, newest first. */
public func sortTrainings(_ trainings: [Training]) -> [Training] {
	trainings.jsSorted { a, b in localeCompare(b.date, a.date) }
}

/**
 * Attendance over the last n sessions this player appeared in.
 * n = 0 means all of them.
 */
public func attendanceOf(_ trainings: [Training], _ spelerId: String, _ n: Int = 0) -> AttendanceSummary {
	var er = 0
	var totaal = 0
	for t in trainings {
		if n != 0 && totaal >= n { break }
		guard let st = t.status[spelerId] else { continue }
		totaal += 1
		if st == .present { er += 1 }
	}
	return AttendanceSummary(er: er, totaal: totaal)
}

/** Under half of the recent sessions: that is worth a conversation. */
public func thinAttendance(_ p: AttendanceSummary) -> Bool {
	p.totaal >= 2 && p.er * 2 < p.totaal
}
