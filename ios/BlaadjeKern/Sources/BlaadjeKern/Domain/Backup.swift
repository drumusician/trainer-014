/* Everything the app remembers, as text. For when your phone ends up in a ditch.

   The file is `{ "blaadje": 1, "gemaakt": <when>, "toestand": <the state without
   the running match> }`. */

public func makeBackup(_ t: AppState, _ gemaakt: String) -> String {
	/* a running match belongs to the device */
	var backup = OrderedDict<JSONValue>()
	backup["blaadje"] = .number(1)
	backup["gemaakt"] = .string(gemaakt)
	backup["toestand"] = Overzetbaar(t).json
	return JSONValue.object(backup).tekst(inspringing: 2)
}

/**
 * Reads a backup. Also accepts the bare state, so an export from the old app or
 * a half-copied file still goes in.
 *
 * Every field of the result is filled in: what the file lacks gets the value an
 * empty app starts with.
 */
public func readBackup(_ tekst: String) throws -> Overzetbaar {
	let d = try JSONValue.parse(tekst)
	/* A backup sits inside a wrapper with a date around it, so unpack first and
	   convert after — otherwise the conversion does not recognise the old format. */
	let t = migreerToestand(d["toestand"].flatMap { $0.isNull ? nil : $0 } ?? d)
	guard let o = t.objectValue, let players = o.arr("players"), !players.isEmpty else {
		throw BlaadjeFout.geenSelectie
	}
	let leeg = emptyState()

	func getal(_ v: JSONValue?) -> Double {
		switch v {
		case .number(let n): return n
		case .string(let s):
			let kaal = s.jsTrim()
			return kaal.isEmpty ? 0 : Double(kaal) ?? .nan
		case .bool(let b): return b ? 1 : 0
		case .null: return 0
		default: return .nan
		}
	}
	let minuten = getal(o["minutesPerPart"])

	return Overzetbaar(
		teamName: o.str("teamName").flatMap { $0.jsTrim().isEmpty ? nil : $0 } ?? leeg.teamName,
		players: try players.map(Player.init(json:)),
		formation: o.str("formation") ?? leeg.formation,
		minutesPerPart: minuten.isNaN || minuten == 0 ? leeg.minutesPerPart : minuten,
		parts: o.num("parts") == 4 ? 4 : leeg.parts,
		defaultLineup: .some(try o.obj("defaultLineup").map(DefaultLineup.init(json:))),
		archive: try (o.arr("archive") ?? []).map(ArchivedMatch.init(json:)),
		trainings: try (o.arr("trainings") ?? []).map(Training.init(json:)),
		reportSubs: o["reportSubs"]?.truthy ?? false
	)
}

public func backupName(_ gemaakt: String) -> String {
	"blaadje-" + String(gemaakt.prefix(10)) + ".json"
}
