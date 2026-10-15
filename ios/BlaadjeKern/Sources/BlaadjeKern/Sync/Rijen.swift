import CryptoKit
import Foundation

/**
 * De toestand van de app als rijen in tabellen, en terug.
 *
 * De app werkt met één geheel (`AppState`); de server met tabellen
 * (`supabase/model.sql`), omdat daar ook anderen dan de trainer in meelezen.
 * Hier staat de vertaling, in beide richtingen, zonder netwerk en zonder klok:
 * dezelfde toestand geeft altijd dezelfde rijen. Daardoor is "wat veranderde er"
 * gewoon het verschil tussen de rijen van vóór en van na een tik.
 *
 * Wat de heenweg niet letterlijk kan bewaren, wordt recht getrokken: seconden
 * worden hele seconden, een speler zonder kenmerk in een oude wedstrijd krijgt
 * er een. Na één keer heen en terug verandert er niets meer; dat bewaken de tests.
 */

/** Een waarde in een rij, zoals het toestel hem kent: tekst, een heel getal, of niets. */
public enum Cel: Equatable, Sendable {
	case tekst(String)
	case getal(Int)
	case leeg

	public var tekst: String? {
		if case .tekst(let s) = self { return s }
		return nil
	}

	public var getal: Int? {
		if case .getal(let n) = self { return n }
		return nil
	}
}

public struct Rij: Equatable, Sendable {
	public var tabel: String
	public var id: String
	public var kolommen: [String: Cel]

	public init(tabel: String, id: String, kolommen: [String: Cel]) {
		self.tabel = tabel
		self.id = id
		self.kolommen = kolommen
	}
}

public enum Wijziging: Equatable, Sendable {
	case erbij(Rij)
	/** Alleen de kolommen die veranderden: op de server wint per veld de laatste. */
	case bij(tabel: String, id: String, kolommen: [String: Cel])
	case weg(tabel: String, id: String)
}

public enum SyncModel {
	/**
	 * De tabellen, in de volgorde waarin rijen erbij moeten: eerst waar andere
	 * naar verwijzen. Weghalen gaat andersom.
	 */
	public static let tabellen = [
		"teams", "team_instellingen", "spelers", "wedstrijden", "trainingen",
		"wedstrijd_spelers", "gebeurtenissen", "training_spelers", "taken",
	]

	/** Tabellen waarvan de volgorde telt; die krijgen bij het wegschrijven een tijdstip. */
	public static let metVolgorde: Set<String> = ["spelers", "wedstrijden", "trainingen", "gebeurtenissen", "taken"]

	/** Staat voor 'nu' in `spelers.weg`: wie het wegschrijft vult het tijdstip in. */
	public static let nu = "NU"

	// MARK: - kenmerken

	/**
	 * De server wil een uuid. Wat er al een is blijft staan; de korte kenmerken
	 * van vroeger ('p1', 'tm2x9...') worden er altijd dezelfde, per team.
	 */
	public static func uuid(_ kenmerk: String, team: String) -> String {
		if kenmerk.count == 36, UUID(uuidString: kenmerk) != nil { return kenmerk.lowercased() }
		var b = Array(SHA256.hash(data: Data((team + "|" + kenmerk).utf8)).prefix(16))
		b[6] = (b[6] & 0x0f) | 0x50
		b[8] = (b[8] & 0x3f) | 0x80
		let hex = b.map { String(format: "%02x", $0) }.joined()
		let s = Array(hex)
		return [s[0..<8], s[8..<12], s[12..<16], s[16..<20], s[20..<32]].map { String($0) }.joined(separator: "-")
	}

	/** Een wedstrijd heeft een vast kenmerk nodig, ook als de opslag van vroeger is. */
	@discardableResult
	public static func vulKenmerkenAan(
		_ t: inout AppState,
		nieuwId: () -> String = { UUID().uuidString.lowercased() }
	) -> Bool {
		var veranderd = false
		if t.match != nil, t.match?.id.gevuld == nil {
			t.match?.id = nieuwId()
			veranderd = true
		}
		for i in t.archive.indices where t.archive[i].id.gevuld == nil {
			t.archive[i].id = nieuwId()
			veranderd = true
		}
		return veranderd
	}

	// MARK: - van toestand naar rijen

	public static func rijen(van t: AppState, team: String) -> [Rij] {
		func m(_ id: String) -> String { uuid(id, team: team) }
		func ref(_ id: String?) -> Cel { id.gevuld.map { .tekst(m($0)) } ?? .leeg }
		func tekst(_ s: String?) -> Cel { s.map { .tekst($0) } ?? .leeg }
		func ja(_ b: Bool) -> Cel { .getal(b ? 1 : 0) }
		func json(_ v: JSONValue?) -> Cel { v.map { .tekst($0.tekst()) } ?? .leeg }
		func opstelling(_ l: Lineup) -> JSONValue {
			.array(l.entries.map { .array([.string($0.position), $0.player.gevuld.map { .string(m($0)) } ?? .null]) })
		}
		func lijst(_ ids: [String]) -> JSONValue { .array(ids.map { .string(m($0)) }) }

		var perTabel: [String: [Rij]] = [:]
		func zet(_ tabel: String, _ id: String, _ kolommen: [String: Cel]) {
			perTabel[tabel, default: []].append(Rij(tabel: tabel, id: id, kolommen: kolommen))
		}

		zet("teams", team, ["naam": .tekst(knip(t.teamName, 60, anders: "Mijn team"))])
		zet("team_instellingen", team, [
			"formatie": .tekst(knip(t.formation, 20)),
			"delen": .getal(t.parts == 4 ? 4 : 2),
			"minuten_per_deel": .getal(minuten(t.minutesPerPart)),
			"verslag_met_wissels": ja(t.reportSubs),
			"standaardopstelling": json(t.defaultLineup.map { d in
				var o = OrderedDict<JSONValue>()
				o["formation"] = .string(d.formation)
				o["lineup"] = opstelling(d.lineup)
				o["bench"] = lijst(d.bench)
				return .object(o)
			}),
		])

		/* Spelers: wie er nu is, en daarna wie alleen nog in oude wedstrijden of
		   trainingen voorkomt. Die laatsten bestaan op de server wél, met `weg`
		   gezet: anders wijst een wedstrijd naar een speler die er niet is. */
		var bekend = Set<String>()
		for p in t.players {
			let id = m(p.id)
			guard bekend.insert(id).inserted else { continue }
			zet("spelers", id, [
				"team_id": .tekst(team), "naam": .tekst(knip(p.name, 60, anders: "?")),
				"linie": .tekst(p.line.rawValue), "keept": ja(p.keeper == true), "weg": .leeg,
			])
		}
		var vroeger = OrderedDict<String>()
		func noem(_ id: String?, _ naam: String?) {
			guard let id = id.gevuld else { return }
			let u = m(id)
			if bekend.contains(u) { return }
			if let naam = naam.gevuld { vroeger[u] = naam } else if vroeger[u] == nil { vroeger[u] = "Oud-speler" }
		}
		for a in t.archive {
			for r in a.playingTime { noem(r.id.gevuld ?? "naam:" + r.name, r.name) }
			for id in a.absent ?? [] { noem(id, a.names?[id]) }
			for g in a.events {
				for id in [g.player, g.assist, g.on, g.off, g.playerA, g.playerB] { noem(id, id.flatMap { a.names?[$0] }) }
			}
		}
		for tr in t.trainings { for id in tr.status.keys { noem(id, nil) } }
		for taak in t.tasks { noem(taak.player, nil); noem(taak.declinedBy, nil) }
		if let w = t.match, w.archived != true {
			for g in w.events {
				for id in [g.player, g.assist, g.on, g.off, g.playerA, g.playerB] { noem(id, nil) }
			}
		}
		for (id, naam) in vroeger.entries {
			zet("spelers", id, [
				"team_id": .tekst(team), "naam": .tekst(knip(naam, 60, anders: "Oud-speler")),
				"linie": .tekst(""), "keept": ja(false), "weg": .tekst(nu),
			])
		}

		func gebeurtenissen(_ events: [MatchEvent], _ wid: String) {
			var gezien: [String: Int] = [:]
			for g in events {
				let ruil = g.type == .swap
				let kolommen: [String: Cel] = [
					"team_id": .tekst(team), "wedstrijd_id": .tekst(wid),
					"soort": .tekst(soort(g.type)),
					"t": .getal(max(0, Int(g.t.rounded()))),
					"deel": g.part.flatMap { (1...4).contains($0) ? .getal($0) : nil } ?? .leeg,
					"speler": ref(ruil ? g.playerA : g.player),
					"assist": ref(g.assist),
					"erin": ref(g.on),
					"eruit": ref(g.off),
					"positie": tekst((ruil ? g.positionA : g.position).map { knip($0, 10) }),
					"positie_b": tekst(g.positionB.map { knip($0, 10) }),
					"speler_b": ref(g.playerB),
				]
				/* Het kenmerk volgt uit de inhoud. Een gebeurtenis kun je op de
				   server niet wijzigen, alleen erbij zetten en weghalen; verandert
				   er iets (een assist erbij), dan is het een andere rij. */
				let inhoud = kolommen.keys.sorted().map { "\($0)=\(kolommen[$0]!)" }.joined(separator: ";")
				let keer = gezien[inhoud, default: 0]
				gezien[inhoud] = keer + 1
				zet("gebeurtenissen", uuid("gebeurtenis|\(inhoud)|\(keer)", team: team), kolommen)
			}
		}

		if let w = t.match, w.archived != true {
			let wid = m(w.id.gevuld ?? "wedstrijd-van-nu")
			let stand = score(w)
			var klok = OrderedDict<JSONValue>()
			klok["elapsed"] = .number(w.elapsed)
			klok["since"] = w.since.map(JSONValue.number) ?? .null
			klok["running"] = .bool(w.running)
			klok["part"] = .number(Double(w.part))
			klok["inBreak"] = .bool(w.inBreak)
			klok["finished"] = .bool(w.finished)
			klok.zet("keptBy", w.keptBy)
			if w.fromProgram == true { klok["uitProgramma"] = .bool(true) }
			zet("wedstrijden", wid, [
				"team_id": .tekst(team), "datum": .tekst(datum(w.date)),
				"tegenstander": .tekst(knip(w.opponent, 80)), "thuis": ja(w.home),
				"status": .tekst(ClockActions.kickedOff(w) ? "bezig" : "gepland"),
				"formatie": .tekst(knip(w.formation, 20)), "delen": .getal(w.parts == 4 ? 4 : 2),
				"minuten_per_deel": .getal(minuten(t.minutesPerPart)),
				"doelpunten_voor": .getal(stand.voor), "doelpunten_tegen": .getal(stand.tegen),
				"duur": .getal(0), "teamnaam": .leeg, "notitie": tekst(w.note.map { knip($0, 4000) }),
				"klok": json(.object(klok)), "opstelling": json(opstelling(w.lineup)), "bank": json(lijst(w.bench)),
				"aanvang": tekst(ProgramActions.tijd(w.time)),
				"wisselplan": json(w.plan.map { plan in
					.array(plan.map { s in
						var kopie = s
						kopie.on = m(s.on)
						kopie.off = m(s.off)
						return kopie.json
					})
				}),
			])
			let afwezig = Set((w.absent ?? []).map(m))
			for p in t.players {
				let pid = m(p.id)
				zet("wedstrijd_spelers", uuid("ws|\(wid)|\(pid)", team: team), [
					"team_id": .tekst(team), "wedstrijd_id": .tekst(wid), "speler_id": .tekst(pid),
					"naam": .tekst(knip(p.name, 60, anders: "?")), "aanwezig": ja(!afwezig.contains(pid)),
					"seconden": .getal(0), "keeper_seconden": .getal(0), "posities": .leeg,
				])
			}
			gebeurtenissen(w.events, wid)
		}

		for (i, a) in t.archive.enumerated() {
			let wid = m(a.id.gevuld ?? "bewaard-\(i)-\(a.date)-\(a.opponent)")
			zet("wedstrijden", wid, [
				"team_id": .tekst(team), "datum": .tekst(datum(a.date)),
				"tegenstander": .tekst(knip(a.opponent, 80)), "thuis": ja(a.home),
				"status": .tekst("afgelopen"),
				"formatie": .tekst(knip(a.formation, 20)), "delen": .getal(a.parts == 4 ? 4 : 2),
				"minuten_per_deel": .getal(minuten(t.minutesPerPart)),
				"doelpunten_voor": .getal(max(0, a.score.voor)), "doelpunten_tegen": .getal(max(0, a.score.tegen)),
				"duur": .getal(max(0, Int(a.duration.rounded()))),
				"teamnaam": tekst(a.teamName.map { knip($0, 60) }), "notitie": tekst(a.note.map { knip($0, 4000) }),
				"klok": .leeg, "opstelling": json(a.lineup.map(opstelling)), "bank": json(a.bench.map(lijst)),
				"wisselplan": .leeg, "aanvang": .leeg,
			])
			let afwezig = Set((a.absent ?? []).map(m))
			var gehad = Set<String>()
			for r in a.playingTime {
				let pid = m(r.id.gevuld ?? "naam:" + r.name)
				guard gehad.insert(pid).inserted else { continue }
				zet("wedstrijd_spelers", uuid("ws|\(wid)|\(pid)", team: team), [
					"team_id": .tekst(team), "wedstrijd_id": .tekst(wid), "speler_id": .tekst(pid),
					"naam": .tekst(knip(r.name, 60, anders: "?")), "aanwezig": ja(!afwezig.contains(pid)),
					"seconden": .getal(max(0, Int(r.seconds.rounded()))),
					"keeper_seconden": .getal(max(0, Int((r.keeper ?? 0).rounded()))),
					"posities": json(r.positions.map { p in .array(p.entries.map { .array([.string($0.key), .number($0.value)]) }) }),
				])
			}
			for id in a.absent ?? [] {
				let pid = m(id)
				guard gehad.insert(pid).inserted else { continue }
				zet("wedstrijd_spelers", uuid("ws|\(wid)|\(pid)", team: team), [
					"team_id": .tekst(team), "wedstrijd_id": .tekst(wid), "speler_id": .tekst(pid),
					"naam": .tekst(knip(a.names?[id] ?? t.players.first { $0.id == id }?.name ?? "", 60, anders: "?")),
					"aanwezig": ja(false), "seconden": .getal(0), "keeper_seconden": .getal(0), "posities": .leeg,
				])
			}
			gebeurtenissen(a.events, wid)
		}

		/* Het programma: wat er nog komt. Geen klok, en daaraan is hij te herkennen. */
		var wedstrijdIds = Set((perTabel["wedstrijden"] ?? []).map(\.id))
		for p in t.program {
			let wid = m(p.id)
			guard wedstrijdIds.insert(wid).inserted else { continue }
			zet("wedstrijden", wid, [
				"team_id": .tekst(team), "datum": .tekst(datum(p.date)),
				"tegenstander": .tekst(knip(p.opponent, 80)), "thuis": ja(p.home),
				"status": .tekst("gepland"),
				"formatie": .tekst(knip(t.formation, 20)), "delen": .getal(t.parts == 4 ? 4 : 2),
				"minuten_per_deel": .getal(minuten(t.minutesPerPart)),
				"doelpunten_voor": .getal(0), "doelpunten_tegen": .getal(0), "duur": .getal(0),
				"teamnaam": .leeg, "notitie": .leeg, "klok": .leeg, "opstelling": .leeg, "bank": .leeg,
				"wisselplan": .leeg, "aanvang": tekst(ProgramActions.tijd(p.time)),
			])
		}

		var trainingGehad = Set<String>()
		for tr in t.trainings {
			let tid = m(tr.id)
			guard trainingGehad.insert(tid).inserted else { continue }
			zet("trainingen", tid, ["team_id": .tekst(team), "datum": .tekst(datum(tr.date))])
			for (id, st) in tr.status.entries {
				let pid = m(id)
				zet("training_spelers", uuid("ts|\(tid)|\(pid)", team: team), [
					"team_id": .tekst(team), "training_id": .tekst(tid), "speler_id": .tekst(pid),
					"status": .tekst(st == .present ? "aanwezig" : st == .excused ? "afgemeld" : "afwezig"),
				])
			}
		}

		/* Taken, alleen bij een wedstrijd die er is: anders weigert de server ze. */
		var taakGehad = Set<String>()
		for taak in t.tasks {
			let wid = m(taak.matchId)
			let id = m(taak.id)
			guard wedstrijdIds.contains(wid), taakGehad.insert(id).inserted else { continue }
			zet("taken", id, [
				"team_id": .tekst(team), "wedstrijd_id": .tekst(wid), "soort": .tekst(taak.kind.rawValue),
				"speler_id": ref(taak.player), "afgemeld_door": ref(taak.declinedBy), "vereniging": ja(taak.club),
			])
		}

		return tabellen.flatMap { perTabel[$0] ?? [] }
	}

	// MARK: - wat veranderde er

	/**
	 * Wat er moet gebeuren om van de ene stand naar de andere te komen. Erbij en
	 * bijwerken in de volgorde van `tabellen`, weghalen andersom, zodat een rij er
	 * altijd is voordat iets ernaar wijst.
	 */
	public static func verschil(van oud: [Rij], naar nieuw: [Rij]) -> [Wijziging] {
		func sleutel(_ r: Rij) -> String { r.tabel + "/" + r.id }
		let was = Dictionary(oud.map { (sleutel($0), $0) }, uniquingKeysWith: { a, _ in a })
		let wordt = Set(nieuw.map(sleutel))
		var uit: [Wijziging] = []
		for r in nieuw {
			guard let vorige = was[sleutel(r)] else {
				uit.append(.erbij(r))
				continue
			}
			let anders = r.kolommen.filter { vorige.kolommen[$0.key] != $0.value }
			if !anders.isEmpty { uit.append(.bij(tabel: r.tabel, id: r.id, kolommen: anders)) }
		}
		for tabel in tabellen.reversed() {
			for r in oud where r.tabel == tabel && !wordt.contains(sleutel(r)) {
				uit.append(.weg(tabel: r.tabel, id: r.id))
			}
		}
		return uit
	}

	/**
	 * De rijen zoals ze in de tabellen op het toestel staan, voor wie zonder
	 * database heen en terug wil: elke rij krijgt zijn `id` als kolom, en een
	 * tijdstip in de volgorde waarin hij langskwam.
	 */
	public static func alsTabellen(_ rijen: [Rij]) -> [String: [[String: Cel]]] {
		var uit: [String: [[String: Cel]]] = [:]
		for (i, r) in rijen.enumerated() {
			var k = r.kolommen
			k["id"] = .tekst(r.id)
			if metVolgorde.contains(r.tabel) { k["gemaakt"] = .tekst(tijdstip(basis: 946_684_800, volgnummer: i)) }
			if k["weg"] == .tekst(nu) { k["weg"] = .tekst(tijdstip(basis: 946_684_800, volgnummer: 0)) }
			uit[r.tabel, default: []].append(k)
		}
		return uit
	}

	/** Een tijdstip als tekst, op de milliseconde, met het volgnummer erbij opgeteld. */
	public static func tijdstip(basis seconden: Double, volgnummer: Int) -> String {
		let ms = Int64((seconden * 1000).rounded()) + Int64(volgnummer)
		let dagen = Int(ms / 86_400_000), rest = Int(ms % 86_400_000)
		/* Van dagen sinds 1970 naar een datum, zonder kalender van het toestel. */
		let z = dagen + 719_468
		let era = z / 146_097
		let doe = z - era * 146_097
		let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365
		let doy = doe - (365 * yoe + yoe / 4 - yoe / 100)
		let mp = (5 * doy + 2) / 153
		let dag = doy - (153 * mp + 2) / 5 + 1
		let maand = mp < 10 ? mp + 3 : mp - 9
		let jaar = yoe + era * 400 + (maand <= 2 ? 1 : 0)
		return String(
			format: "%04d-%02d-%02dT%02d:%02d:%02d.%03dZ",
			jaar, maand, dag, rest / 3_600_000, rest / 60_000 % 60, rest / 1000 % 60, rest % 1000
		)
	}

	// MARK: - van rijen naar toestand

	/**
	 * De toestand zoals hij uit de tabellen volgt. `nil` als het team er niet in
	 * staat: dan valt er niets op te bouwen, en is niets doen beter dan leeg maken.
	 */
	public static func toestand(uit tabellen: [String: [[String: Cel]]], team: String) -> AppState? {
		func rijen(_ tabel: String) -> [[String: Cel]] {
			(tabellen[tabel] ?? []).filter { tabel == "teams" || tabel == "team_instellingen" ? $0["id"]?.tekst == team : $0["team_id"]?.tekst == team }
		}
		func s(_ r: [String: Cel], _ k: String) -> String? { r[k]?.tekst }
		func n(_ r: [String: Cel], _ k: String) -> Int { r[k]?.getal ?? 0 }
		func ja(_ r: [String: Cel], _ k: String) -> Bool { n(r, k) != 0 }
		func json(_ r: [String: Cel], _ k: String) -> JSONValue? {
			guard let tekst = s(r, k), let v = try? JSONValue.parse(tekst), !v.isNull else { return nil }
			return v
		}
		func opVolgorde(_ a: [String: Cel], _ b: [String: Cel]) -> Bool {
			let x = moment(s(a, "gemaakt")), y = moment(s(b, "gemaakt"))
			return x != y ? x < y : (s(a, "id") ?? "") < (s(b, "id") ?? "")
		}

		guard let teamRij = rijen("teams").first else { return nil }
		var t = emptyState()
		t.teamName = s(teamRij, "naam") ?? ""
		if let i = rijen("team_instellingen").first {
			t.formation = s(i, "formatie").gevuld ?? t.formation
			t.parts = n(i, "delen") == 4 ? 4 : 2
			t.minutesPerPart = Double(max(1, n(i, "minuten_per_deel")))
			t.reportSubs = ja(i, "verslag_met_wissels")
			if let d = json(i, "standaardopstelling")?.objectValue {
				t.defaultLineup = DefaultLineup(
					formation: d.str("formation") ?? "",
					lineup: opstelling(d["lineup"]) ?? Lineup(),
					bench: d.strings("bench") ?? []
				)
			}
		}

		let spelers = rijen("spelers").sorted(by: opVolgorde)
		t.players = spelers.filter { s($0, "weg").gevuld == nil }.map { r in
			Player(
				id: s(r, "id") ?? "", name: s(r, "naam") ?? "",
				line: FieldLine(rawValue: s(r, "linie") ?? "") ?? .geen, keeper: ja(r, "keept") ? true : nil
			)
		}
		var plekInSelectie: [String: Int] = [:]
		for (i, p) in t.players.enumerated() { plekInSelectie[p.id] = i }
		/* Op de volgorde van de selectie; wie daar niet meer in staat daarna, op naam. */
		func opSelectie(_ a: [String: Cel], _ b: [String: Cel]) -> Bool {
			let x = plekInSelectie[s(a, "speler_id") ?? ""], y = plekInSelectie[s(b, "speler_id") ?? ""]
			if let x, let y { return x < y }
			if (x == nil) != (y == nil) { return x != nil }
			let na = s(a, "naam") ?? "", nb = s(b, "naam") ?? ""
			return na != nb ? na < nb : (s(a, "speler_id") ?? "") < (s(b, "speler_id") ?? "")
		}

		let perWedstrijd = Dictionary(grouping: rijen("wedstrijd_spelers")) { s($0, "wedstrijd_id") ?? "" }
		let gebeurd = Dictionary(grouping: rijen("gebeurtenissen")) { s($0, "wedstrijd_id") ?? "" }
		func gebeurtenissen(_ wid: String) -> [MatchEvent] {
			(gebeurd[wid] ?? []).sorted(by: opVolgorde).compactMap { r in
				guard let type = soort(s(r, "soort") ?? "") else { return nil }
				let ruil = type == .swap
				return MatchEvent(
					type: type, t: Double(n(r, "t")),
					player: ruil ? nil : s(r, "speler"), assist: s(r, "assist"),
					off: s(r, "eruit"), on: s(r, "erin"),
					position: ruil ? nil : s(r, "positie"),
					positionA: ruil ? s(r, "positie") : nil, positionB: s(r, "positie_b"),
					playerA: ruil ? s(r, "speler") : nil, playerB: s(r, "speler_b"),
					part: r["deel"]?.getal
				)
			}
		}

		let wedstrijden = rijen("wedstrijden")
		/* De wedstrijd van nu: wat bezig is gaat voor, anders de eerste die klaarstaat.
		   Een wedstrijd zonder klok is er een uit het programma, nog niet opgezet. */
		let open = wedstrijden.filter { s($0, "status") != "afgelopen" && s($0, "klok").gevuld != nil }.sorted { a, b in
			let x = s(a, "status") == "bezig", y = s(b, "status") == "bezig"
			if x != y { return x }
			let da = s(a, "datum") ?? "", db = s(b, "datum") ?? ""
			return da != db ? da < db : opVolgorde(a, b)
		}
		if let r = open.first, let wid = s(r, "id") {
			let klok = json(r, "klok")?.objectValue ?? OrderedDict()
			let ws = (perWedstrijd[wid] ?? []).sorted(by: opSelectie)
			t.match = Match(
				date: s(r, "datum") ?? "", opponent: s(r, "tegenstander") ?? "", home: ja(r, "thuis"),
				formation: s(r, "formatie") ?? "",
				lineup: opstelling(json(r, "opstelling")) ?? Lineup(),
				bench: json(r, "bank")?.arrayValue?.compactMap(\.stringValue) ?? [],
				events: gebeurtenissen(wid),
				elapsed: klok.num("elapsed") ?? 0, since: klok.num("since"), running: klok.bool("running") ?? false,
				parts: n(r, "delen") == 4 ? 4 : 2, part: klok.int("part") ?? 1,
				inBreak: klok.bool("inBreak") ?? false, finished: klok.bool("finished") ?? false,
				note: s(r, "notitie"),
				absent: ws.filter { !ja($0, "aanwezig") }.compactMap { s($0, "speler_id") },
				keptBy: klok.str("keptBy"),
				plan: try? json(r, "wisselplan")?.arrayValue?.map(PlannedSub.init(json:)),
				id: wid,
				time: s(r, "aanvang"),
				fromProgram: klok.bool("uitProgramma") == true ? true : nil
			)
		}

		t.program = wedstrijden
			.filter { s($0, "status") == "gepland" && s($0, "klok").gevuld == nil }
			.sorted { a, b in
				let da = s(a, "datum") ?? "", db = s(b, "datum") ?? ""
				if da != db { return da < db }
				let ta = s(a, "aanvang") ?? "", tb = s(b, "aanvang") ?? ""
				return ta != tb ? ta < tb : opVolgorde(a, b)
			}
			.map { r in
				ScheduledMatch(
					id: s(r, "id") ?? "", date: s(r, "datum") ?? "", time: s(r, "aanvang"),
					opponent: s(r, "tegenstander") ?? "", home: ja(r, "thuis")
				)
			}

		t.archive = wedstrijden.filter { s($0, "status") == "afgelopen" }
			.sorted { a, b in
				let da = s(a, "datum") ?? "", db = s(b, "datum") ?? ""
				return da != db ? da > db : opVolgorde(b, a)
			}
			.map { r in
				let wid = s(r, "id") ?? ""
				let ws = (perWedstrijd[wid] ?? []).sorted(by: opSelectie)
				return ArchivedMatch(
					date: s(r, "datum") ?? "", opponent: s(r, "tegenstander") ?? "", home: ja(r, "thuis"),
					score: Score(n(r, "doelpunten_voor"), n(r, "doelpunten_tegen")),
					formation: s(r, "formatie") ?? "", duration: Double(n(r, "duur")),
					teamName: s(r, "teamnaam"), parts: n(r, "delen") == 4 ? 4 : 2, note: s(r, "notitie"),
					events: gebeurtenissen(wid),
					names: OrderedDict(ws.compactMap { x in s(x, "speler_id").map { ($0, s(x, "naam") ?? "") } }),
					absent: ws.filter { !ja($0, "aanwezig") }.compactMap { s($0, "speler_id") },
					playingTime: ws.map { x in
						PlayingTimeRow(
							id: s(x, "speler_id"), name: s(x, "naam") ?? "", seconds: Double(n(x, "seconden")),
							keeper: Double(n(x, "keeper_seconden")),
							positions: json(x, "posities").map(posities)
						)
					},
					lineup: opstelling(json(r, "opstelling")),
					bench: json(r, "bank")?.arrayValue?.compactMap(\.stringValue),
					id: wid
				)
			}

		let perTraining = Dictionary(grouping: rijen("training_spelers")) { s($0, "training_id") ?? "" }
		t.trainings = rijen("trainingen")
			.sorted { a, b in
				let da = s(a, "datum") ?? "", db = s(b, "datum") ?? ""
				return da != db ? da > db : opVolgorde(b, a)
			}
			.map { r in
				let tid = s(r, "id") ?? ""
				var status = OrderedDict<Attendance>()
				for x in (perTraining[tid] ?? []).sorted(by: opSelectie) {
					guard let pid = s(x, "speler_id") else { continue }
					switch s(x, "status") {
					case "afgemeld": status[pid] = .excused
					case "afwezig": status[pid] = .absent
					default: status[pid] = .present
					}
				}
				return Training(id: tid, date: s(r, "datum") ?? "", status: status)
			}

		t.tasks = rijen("taken").sorted(by: opVolgorde).compactMap { r in
			guard let id = s(r, "id"), let wid = s(r, "wedstrijd_id"), let soort = TaskKind(rawValue: s(r, "soort") ?? "") else { return nil }
			return TeamTask(
				id: id, matchId: wid, kind: soort, player: s(r, "speler_id"), declinedBy: s(r, "afgemeld_door"), club: ja(r, "vereniging"))
		}
		return t
	}

	// MARK: - klein gereedschap

	/** Een opstelling staat als lijst van paren, want een object bewaart op de server zijn volgorde niet. */
	private static func opstelling(_ v: JSONValue?) -> Lineup? {
		guard let v else { return nil }
		if let paren = v.arrayValue {
			return Lineup(paren.compactMap { p in
				guard let a = p.arrayValue, a.count == 2, let plek = a[0].stringValue else { return nil }
				return (plek, a[1].stringValue)
			})
		}
		if let o = v.objectValue { return Lineup(o.entries.map { ($0.key, $0.value.stringValue) }) }
		return nil
	}

	private static func posities(_ v: JSONValue) -> OrderedDict<Double> {
		var uit = OrderedDict<Double>()
		if let paren = v.arrayValue {
			for p in paren {
				if let a = p.arrayValue, a.count == 2, let plek = a[0].stringValue, let sec = a[1].numberValue { uit[plek] = sec }
			}
		} else if let o = v.objectValue {
			for (k, w) in o.entries { if let sec = w.numberValue { uit[k] = sec } }
		}
		return uit
	}

	private static func soort(_ type: MatchEventType) -> String {
		switch type {
		case .start: "aftrap"
		case .break: "pauze"
		case .end: "einde"
		case .goal: "doelpunt"
		case .conceded: "tegendoelpunt"
		case .substitution: "wissel"
		case .swap: "ruil"
		}
	}

	private static func soort(_ naam: String) -> MatchEventType? {
		switch naam {
		case "aftrap": .start
		case "pauze": .break
		case "einde": .end
		case "doelpunt": .goal
		case "tegendoelpunt": .conceded
		case "wissel": .substitution
		case "ruil": .swap
		default: nil
		}
	}

	/** Wat de server weigert, raakt het toestel daarna kwijt. Dus vooraf passend maken. */
	private static func knip(_ s: String, _ lengte: Int, anders: String = "") -> String {
		/* Niet bijknippen aan de randen: wie een notitie typt, raakt anders zijn
		   laatste spatie kwijt zodra de rij terugkomt. */
		s.jsTrim().isEmpty ? anders : String(s.prefix(lengte))
	}

	private static func minuten(_ m: Double) -> Int { min(60, max(1, Int(m.rounded()))) }

	private static func datum(_ d: String) -> String { lees(d) == nil ? "2000-01-01" : d }

	/**
	 * Een tijdstip van de server of van het toestel, vergelijkbaar gemaakt. De
	 * server schrijft '2026-10-13 21:00:00.123456+00', het toestel
	 * '2026-10-13T21:00:00.123Z'; allebei in dezelfde tijdzone.
	 */
	static func moment(_ tekst: String?) -> String {
		guard let tekst, tekst.count >= 19 else { return "" }
		let kop = String(tekst.prefix(19)).replacingOccurrences(of: " ", with: "T")
		var breuk = ""
		let rest = tekst.dropFirst(19)
		if rest.first == "." { breuk = String(rest.dropFirst().prefix { $0.isNumber }) }
		return kop + "." + breuk.padding(toLength: 6, withPad: "0", startingAt: 0)
	}
}
