import BlaadjeKern
import Foundation
import PowerSync

/// Waar de server staat.
public struct SyncAdres: Sendable {
	/// De REST-laag: bij Supabase `https://<project>.supabase.co/rest/v1`.
	public var rest: URL
	/// De PowerSync-dienst.
	public var powersync: String
	/// De openbare sleutel van het Supabase-project; lokaal is er geen.
	public var sleutel: String?

	public init(rest: URL, powersync: String, sleutel: String? = nil) {
		self.rest = rest
		self.powersync = powersync
		self.sleutel = sleutel
	}
}

/// Wie er is ingelogd. Geeft een geldig toegangsbewijs, of gooit als dat er niet is.
public protocol Toegang: Sendable {
	func bewijs() async throws -> String
}

public struct SyncFout: Error, CustomStringConvertible {
	public let description: String
	public init(_ s: String) { description = s }
}

/// De tabellen zoals het toestel ze kent, op één plek: hieruit volgt het schema
/// voor PowerSync én hoe een rij gelezen wordt.
///
/// Ja/nee is 0 of 1, een datum is tekst, en wat op de server JSON is, is hier
/// ook tekst. `teams` heeft geen `eigenaar`: de database vult die in bij het
/// opsturen, het toestel kent hem niet.
enum Tabellen {
	enum Soort { case tekst, getal }

	static let alle: [(naam: String, kolommen: [(String, Soort)])] = [
		("teams", [("naam", .tekst), ("gemaakt", .tekst)]),
		("team_instellingen", [
			("formatie", .tekst), ("delen", .getal), ("minuten_per_deel", .getal),
			("verslag_met_wissels", .getal), ("standaardopstelling", .tekst),
		]),
		("spelers", [
			("team_id", .tekst), ("naam", .tekst), ("linie", .tekst), ("keept", .getal), ("weg", .tekst), ("gemaakt", .tekst),
		]),
		("wedstrijden", [
			("team_id", .tekst), ("datum", .tekst), ("tegenstander", .tekst), ("thuis", .getal), ("status", .tekst),
			("formatie", .tekst), ("delen", .getal), ("minuten_per_deel", .getal),
			("doelpunten_voor", .getal), ("doelpunten_tegen", .getal), ("duur", .getal),
			("teamnaam", .tekst), ("notitie", .tekst),
			("klok", .tekst), ("opstelling", .tekst), ("bank", .tekst), ("wisselplan", .tekst), ("gemaakt", .tekst),
		]),
		("trainingen", [("team_id", .tekst), ("datum", .tekst), ("gemaakt", .tekst)]),
		("wedstrijd_spelers", [
			("team_id", .tekst), ("wedstrijd_id", .tekst), ("speler_id", .tekst), ("naam", .tekst),
			("aanwezig", .getal), ("seconden", .getal), ("keeper_seconden", .getal), ("posities", .tekst),
		]),
		("gebeurtenissen", [
			("team_id", .tekst), ("wedstrijd_id", .tekst), ("soort", .tekst), ("t", .getal), ("deel", .getal),
			("speler", .tekst), ("assist", .tekst), ("erin", .tekst), ("eruit", .tekst),
			("positie", .tekst), ("positie_b", .tekst), ("speler_b", .tekst), ("gemaakt", .tekst),
		]),
		("training_spelers", [
			("team_id", .tekst), ("training_id", .tekst), ("speler_id", .tekst), ("status", .tekst),
		]),
	]

	/// Kolommen die op de server JSON zijn. Stuur je de tekst zo door, dan staat
	/// er in de database een tekst tussen aanhalingstekens in plaats van een
	/// lijst of object. Dus onderweg uitpakken.
	static let json: Set<String> = ["standaardopstelling", "klok", "opstelling", "bank", "wisselplan", "posities"]
	/// Ja/nee op de server, 0 of 1 op het toestel.
	static let jaNee: Set<String> = ["keept", "thuis", "aanwezig", "verslag_met_wissels"]

	static var schema: Schema {
		Schema(tables: alle.map { tabel in
			Table(
				name: tabel.naam,
				columns: tabel.kolommen.map { $0.1 == .tekst ? Column.text($0.0) : Column.integer($0.0) },
				indexes: tabel.kolommen.contains { $0.0 == "team_id" }
					? [Index(name: "team", columns: [IndexedColumn.ascending("team_id")])] : []
			)
		})
	}
}

/// Wat op het toestel is veranderd, stuk voor stuk naar de server brengen.
///
/// De keuze die ertoe doet: wat doe je als de server iets weigert. Een storing
/// (geen bereik, server plat) is opnieuw proberen. Een weigering (dit mag jij
/// niet, dit klopt niet) wordt nooit beter van opnieuw proberen, en blijft hij
/// staan, dan komt er nooit meer iets doorheen. Dus weggooien en opschrijven;
/// de server zet het toestel daarna vanzelf weer recht.
final class Koppeling: PowerSyncBackendConnectorProtocol, @unchecked Sendable {
	let adres: SyncAdres
	let toegang: Toegang
	private let slot = NSLock()
	private var _geweigerd: [String] = []
	var geweigerd: [String] { slot.withLock { _geweigerd } }

	init(adres: SyncAdres, toegang: Toegang) {
		self.adres = adres
		self.toegang = toegang
	}

	func fetchCredentials() async throws -> PowerSyncCredentials? {
		PowerSyncCredentials(endpoint: adres.powersync, token: try await toegang.bewijs())
	}

	private func vraag(_ methode: String, _ pad: String, body: Any? = nil, extra: [String: String] = [:]) async throws -> (status: Int, tekst: String) {
		guard let url = URL(string: adres.rest.absoluteString + pad) else { throw SyncFout("geen geldig adres: \(pad)") }
		var r = URLRequest(url: url)
		r.httpMethod = methode
		r.setValue("Bearer \(try await toegang.bewijs())", forHTTPHeaderField: "Authorization")
		if let sleutel = adres.sleutel { r.setValue(sleutel, forHTTPHeaderField: "apikey") }
		r.setValue("application/json", forHTTPHeaderField: "Content-Type")
		for (k, v) in extra { r.setValue(v, forHTTPHeaderField: k) }
		if let body { r.httpBody = try JSONSerialization.data(withJSONObject: body) }
		let (data, antwoord) = try await URLSession.shared.data(for: r)
		return ((antwoord as? HTTPURLResponse)?.statusCode ?? 0, String(decoding: data, as: UTF8.self))
	}

	func uploadData(database: PowerSyncDatabaseProtocol) async throws {
		guard let transactie = try await database.getNextCrudTransaction() else { return }
		for stap in transactie.crud {
			var rij: [String: Any] = [:]
			for (kolom, waarde) in stap.opData ?? [:] {
				guard let waarde else {
					rij[kolom] = NSNull()
					continue
				}
				if Tabellen.json.contains(kolom),
				   let uitgepakt = try? JSONSerialization.jsonObject(with: Data(waarde.utf8), options: [.fragmentsAllowed]) {
					rij[kolom] = uitgepakt
				} else if Tabellen.jaNee.contains(kolom) {
					rij[kolom] = waarde != "0"
				} else {
					rij[kolom] = waarde
				}
			}
			let a: (status: Int, tekst: String)
			switch stap.op {
			case .put:
				rij["id"] = stap.id
				// Bestaat hij al, dan is dit een herhaling van iets wat al aankwam.
				a = try await vraag("POST", "/\(stap.table)", body: rij, extra: ["Prefer": "resolution=ignore-duplicates"])
			case .patch:
				a = try await vraag("PATCH", "/\(stap.table)?id=eq.\(stap.id)", body: rij)
			case .delete:
				a = try await vraag("DELETE", "/\(stap.table)?id=eq.\(stap.id)")
			}
			if (200..<300).contains(a.status) { continue }
			if (400..<500).contains(a.status), a.status != 401, a.status != 408, a.status != 429 {
				slot.withLock { _geweigerd.append("\(stap.op.rawValue) \(stap.table): \(a.status) \(a.tekst.prefix(160))") }
				continue
			}
			throw SyncFout("server zegt \(a.status) bij \(stap.table)")
		}
		try await transactie.complete()
	}
}

/// De tabellen op het toestel. Wat je hier schrijft gaat naar de server zodra
/// er bereik is; wat de server stuurt komt hier binnen.
public final class Spiegel: @unchecked Sendable {
	private let db: PowerSyncDatabaseProtocol
	private var koppeling: Koppeling?

	/// - Parameter bestand: het pad van het SQLite-bestand.
	public init(bestand: String) {
		db = PowerSyncDatabase(schema: Tabellen.schema, dbFilename: bestand, logger: DefaultLogger(minSeverity: .error))
	}

	public func verbind(adres: SyncAdres, toegang: Toegang) async throws {
		let k = Koppeling(adres: adres, toegang: toegang)
		koppeling = k
		try await db.connect(connector: k, crudThrottle: 0.2, retryDelay: 2)
	}

	/// Wacht tot alles wat de server voor dit toestel heeft er ook staat.
	public func wachtOpEersteKeer() async throws { try await db.waitForFirstSync() }

	public func verbreek() async throws { try await db.disconnect() }

	/// Uitloggen: de verbinding weg, en het toestel leeg.
	public func wis() async throws { try await db.disconnectAndClear() }

	public func sluit() async throws { try await db.close() }

	/// Wat de server geweigerd heeft sinds het verbinden.
	public var geweigerd: [String] { koppeling?.geweigerd ?? [] }

	/// Hoeveel wijzigingen er nog naar de server moeten.
	public func wachtrij() async throws -> Int {
		try await db.get(sql: "select count(*) from ps_crud", parameters: []) { c in try c.getInt(index: 0) }
	}

	/// De teams die op dit toestel staan: na het inloggen zijn dat de teams waar je bij kunt.
	public func teams() async throws -> [(id: String, naam: String)] {
		try await db.getAll(sql: "select id, naam from teams order by gemaakt, naam", parameters: []) { c in
			(id: try c.getString(index: 0), naam: c.getStringOptional(index: 1) ?? "")
		}
	}

	/// De wijzigingen wegschrijven, als één geheel.
	///
	/// - Parameter nu: seconden sinds 1970; nieuwe rijen krijgen dit als tijdstip,
	///   elk een milliseconde later dan de vorige, zodat de volgorde bewaard blijft.
	public func schrijf(_ wijzigingen: [Wijziging], nu: Double = Date().timeIntervalSince1970) async throws {
		if wijzigingen.isEmpty { return }
		try await db.writeTransaction { tx in
			for (i, w) in wijzigingen.enumerated() {
				switch w {
				case .erbij(let r):
					var k = r.kolommen
					if SyncModel.metVolgorde.contains(r.tabel) { k["gemaakt"] = .tekst(SyncModel.tijdstip(basis: nu, volgnummer: i)) }
					if k["weg"] == .tekst(SyncModel.nu) { k["weg"] = .tekst(SyncModel.tijdstip(basis: nu, volgnummer: 0)) }
					let namen = k.keys.sorted()
					// Staat hij er al (de server stuurde hem net), dan is het bijwerken.
					let erIs = try tx.getOptional(sql: "select 1 from \(r.tabel) where id = ?", parameters: [r.id]) { c in try c.getInt(index: 0) } != nil
					if erIs {
						let rest = namen.filter { $0 != "gemaakt" }
						try tx.execute(
							sql: "update \(r.tabel) set \(rest.map { "\($0) = ?" }.joined(separator: ", ")) where id = ?",
							parameters: rest.map { Self.waarde(k[$0]!) } + [r.id])
					} else {
						try tx.execute(
							sql: "insert into \(r.tabel) (id, \(namen.joined(separator: ", "))) values (?, \(namen.map { _ in "?" }.joined(separator: ", ")))",
							parameters: [r.id] + namen.map { Self.waarde(k[$0]!) })
					}
				case .bij(let tabel, let id, let kolommen):
					var k = kolommen
					if k["weg"] == .tekst(SyncModel.nu) { k["weg"] = .tekst(SyncModel.tijdstip(basis: nu, volgnummer: 0)) }
					let namen = k.keys.sorted()
					try tx.execute(
						sql: "update \(tabel) set \(namen.map { "\($0) = ?" }.joined(separator: ", ")) where id = ?",
						parameters: namen.map { Self.waarde(k[$0]!) } + [id])
				case .weg(let tabel, let id):
					try tx.execute(sql: "delete from \(tabel) where id = ?", parameters: [id])
				}
			}
		}
	}

	private static func waarde(_ c: Cel) -> Sendable? {
		switch c {
		case .tekst(let s): return s
		case .getal(let n): return n
		case .leeg: return nil
		}
	}

	/// Alles wat er op het toestel staat, per tabel.
	public func lees() async throws -> [String: [[String: Cel]]] {
		var uit: [String: [[String: Cel]]] = [:]
		for tabel in Tabellen.alle {
			let namen = tabel.kolommen
			uit[tabel.naam] = try await db.getAll(
				sql: "select id, \(namen.map(\.0).joined(separator: ", ")) from \(tabel.naam)", parameters: []
			) { c in
				var rij: [String: Cel] = ["id": .tekst(try c.getString(index: 0))]
				for (i, kolom) in namen.enumerated() {
					switch kolom.1 {
					case .tekst: rij[kolom.0] = c.getStringOptional(index: i + 1).map { .tekst($0) } ?? .leeg
					case .getal: rij[kolom.0] = c.getIntOptional(index: i + 1).map { .getal($0) } ?? .leeg
					}
				}
				return rij
			}
		}
		return uit
	}

	/// Geeft een seintje telkens als er iets in de tabellen verandert, van hier of van de server.
	public func veranderingen() -> AsyncStream<Void> {
		let som = Tabellen.alle.map { "(select count(*) from \($0.naam))" }.joined(separator: " + ")
		return AsyncStream { vervolg in
			let taak = Task {
				do {
					let stroom = try db.watch(options: WatchOptions(sql: "select \(som)", parameters: [], throttle: 0.1) { c in try c.getInt(index: 0) })
					for try await _ in stroom { vervolg.yield() }
				} catch {}
				vervolg.finish()
			}
			vervolg.onTermination = { _ in taak.cancel() }
		}
	}
}
