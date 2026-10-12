/**
 * Bringing older storage up to the current format.
 *
 * The field names in storage used to be Dutch. They sit in every user's
 * localStorage, in the Supabase column, and in every backup file anyone ever
 * exported. That last one is why this code can never be removed: a backup made
 * today must still open three seasons from now.
 *
 * The conversion runs one way. What comes in is converted; what we store is
 * English from here on. So there is no layer translating back and forth on every
 * save — that would be a second place where things can go wrong.
 *
 * We recognise the old format by the fields themselves rather than a version
 * number, because the files already out there do not carry one.
 */

/** Field names, grouped by kind of object. Anything absent stays as it is. */
private let VELDEN: [String: String] = [
	/* the state as a whole */
	"teamnaam": "teamName",
	"spelers": "players",
	"formatie": "formation",
	"helftMinuten": "minutesPerPart",
	"delen": "parts",
	"wedstrijd": "match",
	"standaard": "defaultLineup",
	"archief": "archive",
	"trainingen": "trainings",
	"verslagWissels": "reportSubs",

	/* speler */
	"naam": "name",
	"linie": "line",
	"keept": "keeper",

	/* wedstrijd */
	"datum": "date",
	"tegenstander": "opponent",
	"thuis": "home",
	"opstelling": "lineup",
	"bank": "bench",
	"gebeurtenissen": "events",
	"verstreken": "elapsed",
	"sinds": "since",
	"loopt": "running",
	"deel": "part",
	"pauze": "inBreak",
	"afgelopen": "finished",
	"notitie": "note",
	"bewaard": "archived",
	"afwezig": "absent",

	/* gebeurtenis */
	"speler": "player",
	"eruit": "off",
	"erin": "on",
	"plek": "position",
	"plekA": "positionA",
	"plekB": "positionB",
	"spelerA": "playerA",
	"spelerB": "playerB",

	/* bewaarde wedstrijd */
	"stand": "score",
	"duur": "duration",
	"namen": "names",
	"speeltijd": "playingTime",
	"seconden": "seconds",
	"posities": "positions",

	/* logboekje van problemen */
	"wanneer": "when",
	"wat": "what",
	"message": "message",
]

/** Event kinds: those are stored as text. */
private let GEBEURTENISSEN: [String: String] = [
	"rust": "break",
	"eind": "end",
	"tegen": "conceded",
	"wissel": "substitution",
	"ruil": "swap",
]

/** Attendance at a training session. */
private let AANWEZIGHEID: [String: String] = [
	"ja": "present",
	"af": "excused",
	"nee": "absent",
]

/** The only position whose code was Dutch; the rest is football notation. */
private let PLEKKEN: [String: String] = ["TIEN": "TEN"]

/** Formations with a Dutch word in them. */
private let FORMATIES: [String: String] = ["4-4-2 ruit": "4-4-2 diamond"]

private func nieuwePlek(_ position: String) -> String {
	PLEKKEN[position] ?? position
}

/** Is this still the old format? One unmistakable field is enough. */
public func isOudFormaat(_ d: JSONValue?) -> Bool {
	guard let o = d?.objectValue else { return false }
	return o.contains("spelers") || o.contains("teamnaam") || o.contains("archief") || o.contains("verslagWissels")
}

/**
 * Convert everything we come across.
 *
 * Walks the whole tree rather than working per type. That is deliberate: the
 * fields mean the same thing everywhere, and a per-type conversion sooner or
 * later forgets a place where the same object also appears.
 */
public func migreerOpslag(_ waarde: JSONValue, _ sleutel: String? = nil) -> JSONValue {
	switch waarde {
	case .array(let lijst):
		return .array(lijst.map { migreerOpslag($0, sleutel) })

	case .object(let o):
		var uit = OrderedDict<JSONValue>()
		for (k, v) in o.entries {
			/* A lineup and the minutes played per position use position codes as keys,
			   not field names. */
			let opPlek = sleutel == "lineup" || sleutel == "positions"
			let nieuweSleutel = opPlek ? nieuwePlek(k) : (VELDEN[k] ?? k)
			uit[nieuweSleutel] = migreerOpslag(v, nieuweSleutel)
		}
		return .object(uit)

	case .string(let tekst):
		if sleutel == "type" { return .string(GEBEURTENISSEN[tekst] ?? tekst) }
		if sleutel == "formation" { return .string(FORMATIES[tekst] ?? tekst) }
		if sleutel == "position" || sleutel == "positionA" || sleutel == "positionB" {
			return .string(nieuwePlek(tekst))
		}
		/* Attendance per player is keyed by that player's own id. */
		if let nieuw = AANWEZIGHEID[tekst], sleutel == "status" || sleutel == nil { return .string(nieuw) }
		return waarde

	default:
		return waarde
	}
}

/**
 * A session's attendance is stored as {playerId: 'ja'}, so the key is an id and
 * says nothing. Hence handled separately.
 */
public func migreerTrainingstatus(_ waarde: JSONValue) -> JSONValue {
	guard let o = waarde.objectValue else { return waarde }
	return .object(o.mapValues { v in
		guard let tekst = v.stringValue else { return v }
		return .string(AANWEZIGHEID[tekst] ?? tekst)
	})
}

/** Convert a whole stored state, sessions included. */
public func migreerToestand(_ d: JSONValue) -> JSONValue {
	guard isOudFormaat(d), var uit = migreerOpslag(d).objectValue else { return d }
	if let trainings = uit["trainings"]?.arrayValue {
		uit["trainings"] = .array(trainings.map { t in
			var training = t.objectValue ?? OrderedDict<JSONValue>()
			if let status = training["status"] { training["status"] = migreerTrainingstatus(status) }
			return .object(training)
		})
	}
	return .object(uit)
}
