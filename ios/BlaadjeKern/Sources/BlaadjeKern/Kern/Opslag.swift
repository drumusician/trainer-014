/**
 * Reading and writing the state as the web app stores it.
 *
 * The web app keeps everything in one JSON text under `o14-app-v1`. This is that
 * text and the rules for reading it back, without the storage itself: where the
 * text lives is up to the app.
 */
public enum Opslag {
	/** JSON.stringify(state): what goes into storage. */
	public static func schrijf(_ t: AppState) -> String {
		t.json.tekst()
	}

	/**
	 * Reads stored text back into a state, converting older shapes on the way.
	 *
	 * Three outcomes, and the difference matters:
	 * - a state: it could be read;
	 * - nil: readable JSON, but not a shape we know;
	 * - an error: not readable at all.
	 *
	 * In the last two cases the dangerous thing is to carry on with an empty state
	 * and save that over a whole season. Unreadable must never mean overwritten,
	 * so set the original text aside before anything else can save.
	 */
	public static func lees(_ ruw: String) throws -> AppState? {
		/* Convert the old format first: the field names were Dutch and are still
		   stored that way for everyone who already used the app. */
		let d = migreerToestand(try JSONValue.parse(ruw))
		guard let o = d.objectValue, o.arr("players") != nil else { return nil }
		var samen = emptyState().json.objectValue!
		for (k, v) in o.entries { samen[k] = v }
		return try AppState(json: migrate(.object(samen)))
	}

	/** Older storage: 'K' used to be a line. Keeping now sits alongside it. */
	public static func migrate(_ toestand: JSONValue) -> JSONValue {
		guard var t = toestand.objectValue else { return toestand }

		if let players = t.arr("players") {
			t["players"] = .array(players.map { speler in
				guard var p = speler.objectValue, p.str("line") == "K" else { return speler }
				p["line"] = .string("")
				p["keeper"] = .bool(true)
				return .object(p)
			})
		}
		if t.arr("trainings") == nil { t["trainings"] = .array([]) }
		if t.num("parts") != 4 { t["parts"] = .number(2) }
		if (t.str("teamName")?.jsTrim() ?? "").isEmpty { t["teamName"] = .string("Ons team") }

		var w = t["match"]?.objectValue
		if w != nil, w!["part"] == nil {
			/* from the old days: back then it was always two halves */
			w!["parts"] = .number(2)
			w!["part"] = .number(w!.num("helft") == 2 ? 2 : 1)
			w!["inBreak"] = .bool(false)
		}

		t["trainings"] = .array(t.arr("trainings")!.enumerated().map { i, training in
			guard var tr = training.objectValue, !(tr["id"]?.truthy ?? false) else { return training }
			/* from before ids existed */
			let datum = tr["date"].flatMap { $0.isNull ? nil : $0 }
			tr["id"] = .string("t" + (datum.map(alsTekst) ?? "onbekend") + "-\(i)")
			return .object(tr)
		})
		if t.arr("archive") == nil { t["archive"] = .array([]) }

		/* Matches from before that fix: events but no start. Without that event the
		   app believes kick-off has not happened yet. */
		if w != nil, let events = w!.arr("events"), !events.isEmpty,
			!events.contains(where: { $0["type"]?.stringValue == "start" })
		{
			var start = OrderedDict<JSONValue>()
			start["type"] = .string("start")
			start["t"] = .number(0)
			w!["events"] = .array([.object(start)] + events)
		}
		if let w { t["match"] = .object(w) }
		return .object(t)
	}

	private static func alsTekst(_ v: JSONValue) -> String {
		switch v {
		case .string(let s): return s
		case .number(let n): return jsGetal(n)
		case .bool(let b): return b ? "true" : "false"
		default: return v.tekst()
		}
	}
}
