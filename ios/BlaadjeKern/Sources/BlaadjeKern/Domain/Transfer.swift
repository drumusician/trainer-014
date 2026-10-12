import Foundation

/**
 * What travels to another device: everything the app remembers, except the match
 * currently running. That one belongs to the device you are playing it on.
 *
 * Exactly the same content as a backup and as what goes to the server, because
 * otherwise you have to remember which button takes what along. That is precisely
 * what went wrong before.
 *
 * Every field may be missing, and what is missing stays as it was on the device
 * that adopts it. For `defaultLineup` there are three answers: not in the
 * package (nil), in the package and empty (`.some(nil)`), or a lineup.
 */
public struct Overzetbaar: Equatable, Sendable {
	public var teamName: String?
	public var players: [Player]?
	public var formation: String?
	public var minutesPerPart: Double?
	public var parts: Int?
	public var defaultLineup: DefaultLineup??
	public var archive: [ArchivedMatch]?
	public var trainings: [Training]?
	public var reportSubs: Bool?

	public init(
		teamName: String? = nil,
		players: [Player]? = nil,
		formation: String? = nil,
		minutesPerPart: Double? = nil,
		parts: Int? = nil,
		defaultLineup: DefaultLineup?? = nil,
		archive: [ArchivedMatch]? = nil,
		trainings: [Training]? = nil,
		reportSubs: Bool? = nil
	) {
		self.teamName = teamName
		self.players = players
		self.formation = formation
		self.minutesPerPart = minutesPerPart
		self.parts = parts
		self.defaultLineup = defaultLineup
		self.archive = archive
		self.trainings = trainings
		self.reportSubs = reportSubs
	}

	/** Everything in the state except the running match. */
	public init(_ t: AppState) {
		self.init(
			teamName: t.teamName,
			players: t.players,
			formation: t.formation,
			minutesPerPart: t.minutesPerPart,
			parts: t.parts,
			defaultLineup: .some(t.defaultLineup),
			archive: t.archive,
			trainings: t.trainings,
			reportSubs: t.reportSubs
		)
	}

	/** Takes what is there and of the right kind; the rest counts as not in the package. */
	public init(json: JSONValue) throws {
		let o = try alsObject(json, "pakket")
		teamName = o.str("teamName")
		players = try o.arr("players")?.map(Player.init(json:))
		formation = o.str("formation")
		minutesPerPart = o.num("minutesPerPart")
		parts = o.int("parts")
		if o.contains("defaultLineup") {
			defaultLineup = .some(try o.obj("defaultLineup").map(DefaultLineup.init(json:)))
		} else {
			defaultLineup = nil
		}
		archive = try o.arr("archive")?.map(ArchivedMatch.init(json:))
		trainings = try o.arr("trainings")?.map(Training.init(json:))
		reportSubs = o.bool("reportSubs")
	}

	/** The fields that are there, in the order the state keeps them. */
	public var json: JSONValue {
		var o = OrderedDict<JSONValue>()
		o.zet("teamName", teamName)
		if let players { o["players"] = .array(players.map(\.json)) }
		o.zet("formation", formation)
		o.zet("minutesPerPart", minutesPerPart)
		o.zet("parts", parts)
		if let defaultLineup { o["defaultLineup"] = defaultLineup?.json ?? .null }
		if let archive { o["archive"] = .array(archive.map(\.json)) }
		if let trainings { o["trainings"] = .array(trainings.map(\.json)) }
		o.zet("reportSubs", reportSubs)
		return .object(o)
	}
}

@dynamicMemberLookup
public struct TransferPackage: Equatable, Sendable {
	/** 1 or 2; missing when a bare state was read instead of a code */
	public var v: Int?
	public var pakket: Overzetbaar

	public init(v: Int? = 2, pakket: Overzetbaar) {
		self.v = v
		self.pakket = pakket
	}

	public subscript<T>(dynamicMember pad: WritableKeyPath<Overzetbaar, T>) -> T {
		get { pakket[keyPath: pad] }
		set { pakket[keyPath: pad] = newValue }
	}
}

private func toBase64(_ tekst: String) -> String {
	Data(tekst.utf8).base64EncodedString()
}

/* As forgiving as the browser's atob: spaces and line breaks inside the code are
   skipped and the padding at the end may be missing. Anything else is not a code. */
private func fromBase64(_ code: String) throws -> String {
	var tekens = code.jsTrim().unicodeScalars.filter { !" \t\n\u{0C}\r".unicodeScalars.contains($0) }.map(Character.init)
	if tekens.count % 4 == 0 {
		if tekens.last == "=" { tekens.removeLast() }
		if tekens.last == "=" { tekens.removeLast() }
	}
	let alfabet = Set("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/")
	guard tekens.count % 4 != 1, tekens.allSatisfy(alfabet.contains) else { throw BlaadjeFout.ongeldigeCode }
	let aangevuld = String(tekens) + String(repeating: "=", count: (4 - tekens.count % 4) % 4)
	guard let bytes = Data(base64Encoded: aangevuld) else { throw BlaadjeFout.ongeldigeCode }
	return String(decoding: bytes, as: UTF8.self)
}

public func makeTransferCode(_ t: AppState) -> String {
	var pakket = OrderedDict<JSONValue>()
	pakket["v"] = .number(2)
	for (k, v) in Overzetbaar(t).json.objectValue!.entries { pakket[k] = v }
	return toBase64(JSONValue.object(pakket).tekst())
}

/**
 * Reads a code or a backup; either is fine. What is not in it stays as it was:
 * an old code without sessions therefore does not wipe your sessions.
 */
public func readTransferCode(_ tekst: String) throws -> TransferPackage {
	let ruw = tekst.jsTrim()
	let json = ruw.hasPrefix("{") ? ruw : try fromBase64(ruw)
	let d = try JSONValue.parse(json)
	/* A code from a device that has not been updated yet is still in Dutch. */
	let toestand = d["toestand"]
	let binnen = migreerToestand(toestand.flatMap { $0.isNull ? nil : $0 } ?? d)
	guard let velden = binnen.objectValue else { throw BlaadjeFout.geenSelectie }
	let v: Int? = toestand?.truthy == true ? 2 : velden.int("v")
	guard let players = velden.arr("players"), !players.isEmpty else { throw BlaadjeFout.geenSelectie }
	return TransferPackage(v: v, pakket: try Overzetbaar(json: binnen))
}

/**
 * What a package contains, in one sentence for the confirmation prompt.
 *
 * Takes only what it reads, so both a transfer code and a restored backup file
 * can go through it.
 */
public func describePackage(_ p: Overzetbaar) -> String {
	let aantal = p.players?.count ?? 0
	var stukjes = ["\(aantal)" + (aantal == 1 ? " speler" : " spelers")]
	if let archive = p.archive { stukjes.append("\(archive.count)" + (archive.count == 1 ? " wedstrijd" : " wedstrijden")) }
	if let trainings = p.trainings {
		stukjes.append("\(trainings.count)" + (trainings.count == 1 ? " training" : " trainingen"))
	}
	if case .some(.some(_)) = p.defaultLineup { stukjes.append("een standaardopstelling") }
	return stukjes.joined(separator: ", ")
}

public func describePackage(_ p: TransferPackage) -> String {
	describePackage(p.pakket)
}
