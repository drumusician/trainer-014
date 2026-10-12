/* Dates the way you say them, not the way they are stored.

   The web app asks the browser for Dutch month and weekday names. Here they are
   written out, so the answer does not depend on how the device is set up. */

private let MAANDEN = [
	"januari", "februari", "maart", "april", "mei", "juni",
	"juli", "augustus", "september", "oktober", "november", "december",
]
private let MAANDEN_KORT = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"]
private let WEEKDAGEN = ["zondag", "maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag"]

struct Dag {
	var jaar: Int
	var maand: Int
	var dag: Int

	/** 0 is Sunday. */
	var weekdag: Int {
		let t = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4]
		let j = maand < 3 ? jaar - 1 : jaar
		return (j + j / 4 - j / 100 + j / 400 + t[maand - 1] + dag) % 7
	}
}

/** Reads "2026-09-04". Anything else is not a date. */
func lees(_ date: String) -> Dag? {
	let delen = date.split(separator: "-", omittingEmptySubsequences: false)
	guard delen.count == 3, delen[0].count == 4, delen[1].count == 2, delen[2].count == 2,
		delen.allSatisfy({ $0.allSatisfy { $0.isASCII && $0.isNumber } }),
		let jaar = Int(delen[0]), let maand = Int(delen[1]), let dag = Int(delen[2]),
		(1...12).contains(maand)
	else { return nil }
	let schrikkel = (jaar % 4 == 0 && jaar % 100 != 0) || jaar % 400 == 0
	let dagen = [31, schrikkel ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
	guard (1...dagen[maand - 1]).contains(dag) else { return nil }
	return Dag(jaar: jaar, maand: maand, dag: dag)
}

/** "4 sep". If the date cannot be read, it stays as it was. */
public func shortDate(_ date: String) -> String {
	guard let d = lees(date) else { return date }
	return "\(d.dag) \(MAANDEN_KORT[d.maand - 1])"
}

/** "4 september 2026". */
public func datumMetJaar(_ date: String) -> String {
	guard let d = lees(date) else { return date }
	return "\(d.dag) \(MAANDEN[d.maand - 1]) \(d.jaar)"
}

/**
 * "zondag 6 september", for the report.
 *
 * A date that cannot be read becomes "Invalid Date", because that is what the
 * web app puts in the report: its fallback to the raw text never triggers.
 */
public func dateText(_ date: String) -> String {
	guard let d = lees(date) else { return "Invalid Date" }
	return "\(WEEKDAGEN[d.weekdag]) \(d.dag) \(MAANDEN[d.maand - 1])"
}
