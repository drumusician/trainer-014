// De proef met PowerSync: doet het wat Blaadje nodig heeft?
//
// Elk "toestel" is een eigen SQLite-bestand met de PowerSync-SDK erboven,
// dezelfde SDK die de iOS-app gaat gebruiken. Offline is hier: niet verbonden.
// Het programma loopt de scenario's langs en zegt per stuk of het klopt.

import CryptoKit
import Foundation
import PowerSync

setvbuf(stdout, nil, _IOLBF, 0)

let rest = "http://localhost:3055"
let dienst = "http://localhost:8089"
let geheim = "blaadje-proef-geheim-van-minstens-32-tekens"
let anna = "44444444-4444-4444-4444-444444444444"
let bas = "55555555-5555-5555-5555-555555555555"

// ---------- het model, zoals het toestel het kent ----------
// De kolom `id` maakt PowerSync zelf. Ja/nee is 0 of 1, een datum is tekst, en
// wat in Postgres JSON is, is hier ook tekst.
let schema = Schema(
    // Zonder `eigenaar`: het toestel weet zonder account niet van wie het team is.
    // De database vult het in bij het opsturen.
    Table(name: "teams", columns: [.text("naam"), .text("gemaakt")]),
    Table(name: "team_instellingen", columns: [
        .text("formatie"), .integer("delen"), .integer("minuten_per_deel"),
        .integer("verslag_met_wissels"), .text("standaardopstelling"), .text("bijgewerkt"),
    ]),
    Table(name: "spelers", columns: [
        .text("team_id"), .text("naam"), .text("linie"), .integer("keept"), .text("weg"),
    ], indexes: [Index(name: "team", columns: [IndexedColumn.ascending("team_id")])]),
    Table(name: "wedstrijden", columns: [
        .text("team_id"), .text("datum"), .text("tegenstander"), .integer("thuis"), .text("status"),
        .text("formatie"), .integer("delen"), .integer("minuten_per_deel"),
        .integer("doelpunten_voor"), .integer("doelpunten_tegen"), .integer("duur"),
        .text("teamnaam"), .text("notitie"), .text("bijgehouden_door"),
        .text("klok"), .text("opstelling"), .text("bank"), .text("wisselplan"),
    ], indexes: [Index(name: "team", columns: [IndexedColumn.ascending("team_id")])]),
    Table(name: "wedstrijd_spelers", columns: [
        .text("team_id"), .text("wedstrijd_id"), .text("speler_id"), .text("naam"),
        .integer("aanwezig"), .integer("seconden"), .integer("keeper_seconden"), .text("posities"),
    ]),
    Table(name: "gebeurtenissen", columns: [
        .text("team_id"), .text("wedstrijd_id"), .text("soort"), .integer("t"), .integer("deel"),
        .text("speler"), .text("assist"), .text("erin"), .text("eruit"),
        .text("positie"), .text("positie_b"), .text("speler_b"),
    ], indexes: [Index(name: "wedstrijd", columns: [IndexedColumn.ascending("wedstrijd_id")])]),
    Table(name: "trainingen", columns: [.text("team_id"), .text("datum")]),
    Table(name: "training_spelers", columns: [
        .text("team_id"), .text("training_id"), .text("speler_id"), .text("status"),
    ])
)

/// Kolommen die in Postgres JSON zijn. Op het toestel is dat tekst, en stuur je
/// die tekst zo door, dan staat er in de database een tekst tussen aanhalingstekens
/// in plaats van een object. Dus onderweg uitpakken.
let jsonKolommen: Set<String> = ["standaardopstelling", "klok", "opstelling", "bank", "wisselplan", "posities"]

// ---------- inloggen ----------
func b64(_ d: Data) -> String {
    d.base64EncodedString().replacingOccurrences(of: "+", with: "-")
        .replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "=", with: "")
}

/// Een toegangsbewijs zoals Supabase het uitgeeft: wie je bent, en dat je bent ingelogd.
func token(voor gebruiker: String) -> String {
    let kop = b64(try! JSONSerialization.data(withJSONObject: ["alg": "HS256", "typ": "JWT", "kid": "proef"]))
    let nu = Int(Date().timeIntervalSince1970)
    let inhoud = b64(try! JSONSerialization.data(withJSONObject: [
        "sub": gebruiker, "role": "authenticated", "aud": "powersync", "iat": nu, "exp": nu + 3600,
    ] as [String: Any]))
    let handtekening = HMAC<SHA256>.authenticationCode(
        for: Data("\(kop).\(inhoud)".utf8), using: SymmetricKey(data: Data(geheim.utf8)))
    return "\(kop).\(inhoud).\(b64(Data(handtekening)))"
}

struct Antwoord { let status: Int; let tekst: String }

func vraag(_ methode: String, _ pad: String, als gebruiker: String, body: Any? = nil, extra: [String: String] = [:]) async throws -> Antwoord {
    var r = URLRequest(url: URL(string: rest + pad)!)
    r.httpMethod = methode
    r.setValue("Bearer \(token(voor: gebruiker))", forHTTPHeaderField: "Authorization")
    r.setValue("application/json", forHTTPHeaderField: "Content-Type")
    for (k, v) in extra { r.setValue(v, forHTTPHeaderField: k) }
    if let body { r.httpBody = try JSONSerialization.data(withJSONObject: body) }
    let (data, resp) = try await URLSession.shared.data(for: r)
    return Antwoord(status: (resp as! HTTPURLResponse).statusCode, tekst: String(decoding: data, as: UTF8.self))
}

/// Rijen ophalen uit de echte database, langs dezelfde regels als de app.
func opServer(_ pad: String, als gebruiker: String) async throws -> [[String: Any]] {
    let a = try await vraag("GET", pad, als: gebruiker)
    guard a.status == 200 else { throw Fout("server zegt \(a.status): \(a.tekst)") }
    return try JSONSerialization.jsonObject(with: Data(a.tekst.utf8)) as! [[String: Any]]
}

struct Fout: Error, CustomStringConvertible {
    let description: String
    init(_ s: String) { description = s }
}

// ---------- de koppeling met de server ----------
/// Wat op het toestel is veranderd, stuk voor stuk naar de server brengen.
///
/// De keuze die ertoe doet staat onderaan: wat doe je als de server iets weigert.
/// Een storing (geen bereik, server plat) is opnieuw proberen. Een weigering (dit
/// mag jij niet, dit klopt niet) wordt nooit beter van opnieuw proberen, en
/// blijft hij staan, dan komt er nooit meer iets doorheen. Dus weggooien en
/// opschrijven; de server zet het toestel daarna vanzelf weer recht.
final class Koppeling: PowerSyncBackendConnectorProtocol, @unchecked Sendable {
    let gebruiker: String
    let slot = NSLock()
    private var _geweigerd: [String] = []
    var geweigerd: [String] { slot.withLock { _geweigerd } }

    init(gebruiker: String) { self.gebruiker = gebruiker }

    func fetchCredentials() async throws -> PowerSyncCredentials? {
        PowerSyncCredentials(endpoint: dienst, token: token(voor: gebruiker))
    }

    func uploadData(database: PowerSyncDatabaseProtocol) async throws {
        guard let transactie = try await database.getNextCrudTransaction() else { return }
        for stap in transactie.crud {
            var rij: [String: Any] = [:]
            for (kolom, waarde) in stap.opData ?? [:] {
                if let waarde, jsonKolommen.contains(kolom),
                   let uitgepakt = try? JSONSerialization.jsonObject(with: Data(waarde.utf8), options: [.fragmentsAllowed]) {
                    rij[kolom] = uitgepakt
                } else {
                    rij[kolom] = waarde ?? NSNull()
                }
            }
            let a: Antwoord
            switch stap.op {
            case .put:
                rij["id"] = stap.id
                // Bestaat hij al, dan is dit een herhaling van iets wat al aankwam.
                a = try await vraag("POST", "/\(stap.table)", als: gebruiker, body: rij,
                                    extra: ["Prefer": "resolution=ignore-duplicates"])
            case .patch:
                a = try await vraag("PATCH", "/\(stap.table)?id=eq.\(stap.id)", als: gebruiker, body: rij)
            case .delete:
                a = try await vraag("DELETE", "/\(stap.table)?id=eq.\(stap.id)", als: gebruiker)
            }
            if (200 ..< 300).contains(a.status) { continue }
            if (400 ..< 500).contains(a.status), a.status != 401, a.status != 408, a.status != 429 {
                slot.withLock { _geweigerd.append("\(stap.op.rawValue) \(stap.table): \(a.status) \(a.tekst.prefix(120))") }
                continue
            }
            throw Fout("server zegt \(a.status) bij \(stap.table)")
        }
        try await transactie.complete()
    }
}

// ---------- een toestel ----------
let map = FileManager.default.temporaryDirectory.appendingPathComponent("blaadje-proef-\(UUID().uuidString)")
try FileManager.default.createDirectory(at: map, withIntermediateDirectories: true)

final class Toestel: @unchecked Sendable {
    let naam: String
    let pad: String
    var db: PowerSyncDatabaseProtocol
    var koppeling: Koppeling?

    init(_ naam: String) {
        self.naam = naam
        pad = map.appendingPathComponent("\(naam).sqlite").path
        db = PowerSyncDatabase(schema: schema, dbFilename: pad, logger: DefaultLogger(minSeverity: .error))
    }

    func logIn(als gebruiker: String) async throws {
        koppeling = Koppeling(gebruiker: gebruiker)
        try await db.connect(connector: koppeling!, crudThrottle: 0.2, retryDelay: 1)
    }

    /// Geen bereik: wat je doet blijft op het toestel staan.
    func offline() async throws { try await db.disconnect() }
    func online() async throws { try await db.connect(connector: koppeling!, crudThrottle: 0.2, retryDelay: 1) }

    /// De app afsluiten en weer openen.
    func herstart() async throws {
        try await db.close()
        db = PowerSyncDatabase(schema: schema, dbFilename: pad, logger: DefaultLogger(minSeverity: .error))
    }

    func tel(_ sql: String, _ p: [Sendable?] = []) async throws -> Int {
        try await db.get(sql: sql, parameters: p) { c in try c.getInt(index: 0) }
    }

    func tekst(_ sql: String, _ p: [Sendable?] = []) async throws -> String? {
        try await db.getOptional(sql: sql, parameters: p) { c in c.getStringOptional(index: 0) } ?? nil
    }

    func wachtrij() async throws -> Int { try await tel("select count(*) from ps_crud") }

    func voegToe(_ tabel: String, _ rij: [String: Sendable?]) async throws {
        let k = rij.keys.sorted()
        try await db.execute(
            sql: "insert into \(tabel) (\(k.joined(separator: ", "))) values (\(k.map { _ in "?" }.joined(separator: ", ")))",
            parameters: k.map { rij[$0]! })
    }
}

/// Wachten tot iets waar is. Synchroniseren is niet meteen; de vraag is of het komt.
func tot(_ wat: String, binnen seconden: Double = 20, _ klopt: () async throws -> Bool) async throws {
    let eind = Date().addingTimeInterval(seconden)
    while Date() < eind {
        if try await klopt() { return }
        try await Task.sleep(nanoseconds: 150_000_000)
    }
    throw Fout("na \(Int(seconden)) seconden nog steeds niet: \(wat)")
}

var geslaagd = 0
var mislukt: [String] = []
var bevindingen: [String] = []

func scenario(_ naam: String, _ doe: () async throws -> Void) async {
    do {
        let begin = Date()
        try await doe()
        geslaagd += 1
        print("✓ \(naam)  (\(String(format: "%.1f", Date().timeIntervalSince(begin))) s)")
    } catch {
        mislukt.append(naam)
        print("✗ \(naam)\n    \(error)")
    }
}

func id() -> String { UUID().uuidString.lowercased() }

// ==========================================================================

let team = id(), wedstrijd = id()
let bram = id(), finn = id(), gijs = id()
let telefoon = Toestel("telefoon-anna")
let tablet = Toestel("tablet-anna")
let vanBas = Toestel("telefoon-bas")

print("PowerSync \(try await telefoon.db.getPowerSyncVersion()), bestanden in \(map.path)\n")

await scenario("1. Zonder account: een team, spelers en een wedstrijd maken, en ze staan er na afsluiten nog") {
    try await telefoon.voegToe("teams", ["id": team, "naam": "JO14-2"])
    try await telefoon.voegToe("team_instellingen", ["id": team, "formatie": "4-3-3", "delen": 2, "minuten_per_deel": 35])
    for (i, n) in [(bram, "Bram"), (finn, "Finn"), (gijs, "Gijs")] {
        try await telefoon.voegToe("spelers", ["id": i, "team_id": team, "naam": n, "linie": "M", "keept": n == "Bram" ? 1 : 0])
    }
    try await telefoon.voegToe("wedstrijden", [
        "id": wedstrijd, "team_id": team, "datum": "2026-10-10", "tegenstander": "VV Overkant", "thuis": 1,
        "status": "bezig", "opstelling": "{\"K\":\"\(bram)\",\"SP\":\"\(finn)\"}", "bank": "[\"\(gijs)\"]",
    ])
    try await telefoon.voegToe("gebeurtenissen", ["id": id(), "team_id": team, "wedstrijd_id": wedstrijd, "soort": "aftrap", "t": 0])
    try await telefoon.voegToe("gebeurtenissen", ["id": id(), "team_id": team, "wedstrijd_id": wedstrijd, "soort": "doelpunt", "t": 600, "speler": finn])

    try await telefoon.herstart()
    guard try await telefoon.tel("select count(*) from spelers") == 3 else { throw Fout("de spelers zijn weg na herstarten") }
    guard try await telefoon.tel("select count(*) from gebeurtenissen") == 2 else { throw Fout("de gebeurtenissen zijn weg na herstarten") }
    let klaar = try await telefoon.wachtrij()
    guard klaar == 8 else { throw Fout("er staan \(klaar) wijzigingen klaar, verwacht 8") }
    bevindingen.append("Zonder account werkt alles lokaal, en elke wijziging blijft klaarstaan (\(klaar) stuks) tot er wordt ingelogd.")
}

await scenario("2. Inloggen: wat zonder account gemaakt is, komt op de server") {
    try await telefoon.logIn(als: anna)
    try await tot("de wachtrij is leeg") { try await telefoon.wachtrij() == 0 }
    if let g = telefoon.koppeling?.geweigerd, !g.isEmpty { throw Fout("de server weigerde: \(g)") }
    let spelers = try await opServer("/spelers?team_id=eq.\(team)&order=naam", als: anna)
    guard spelers.map({ $0["naam"] as? String }) == ["Bram", "Finn", "Gijs"] else { throw Fout("spelers op de server: \(spelers)") }
    guard spelers[0]["keept"] as? Bool == true else { throw Fout("ja/nee komt niet als ja/nee aan: \(spelers[0])") }
    let w = try await opServer("/wedstrijden?id=eq.\(wedstrijd)", als: anna)
    guard let opstelling = w.first?["opstelling"] as? [String: Any], opstelling["K"] as? String == bram else {
        throw Fout("de opstelling staat niet als object in de database: \(String(describing: w.first?["opstelling"]))")
    }
    guard (w.first?["bank"] as? [Any])?.count == 1 else { throw Fout("de bank staat niet als lijst in de database") }
    guard try await opServer("/gebeurtenissen?wedstrijd_id=eq.\(wedstrijd)", als: anna).count == 2 else { throw Fout("niet alle gebeurtenissen kwamen aan") }
    // Het team is offline aangemaakt; de database heeft Anna er zelf lid van gemaakt.
    let leden = try await opServer("/team_leden?team_id=eq.\(team)", als: anna)
    guard leden.count == 1, leden[0]["gebruiker"] as? String == anna, leden[0]["rol"] as? String == "eigenaar" else {
        throw Fout("wie inlogde is geen eigenaar geworden van het team dat hij zonder account maakte: \(leden)")
    }
}

await scenario("3. Na inloggen blijft staan wat er stond, ook als de server het teruggeeft") {
    try await tot("de eerste synchronisatie is klaar") { telefoon.db.currentStatus.hasSynced == true }
    try await Task.sleep(nanoseconds: 1_000_000_000)
    guard try await telefoon.tel("select count(*) from spelers") == 3 else { throw Fout("na de eerste synchronisatie zijn er geen 3 spelers meer") }
    guard try await telefoon.tel("select count(*) from gebeurtenissen") == 2 else { throw Fout("na de eerste synchronisatie kloppen de gebeurtenissen niet") }
    guard try await telefoon.tekst("select naam from teams where id = ?", [team]) == "JO14-2" else { throw Fout("het team is van het toestel verdwenen") }
}

await scenario("4. Een tweede toestel van dezelfde trainer krijgt alles binnen") {
    try await tablet.logIn(als: anna)
    try await tot("de tablet heeft de spelers") { try await tablet.tel("select count(*) from spelers") == 3 }
    try await tot("de tablet heeft de wedstrijd") { try await tablet.tel("select count(*) from gebeurtenissen where wedstrijd_id = ?", [wedstrijd]) == 2 }
    guard try await tablet.tekst("select opstelling from wedstrijden where id = ?", [wedstrijd])?.contains(bram) == true else {
        throw Fout("de opstelling kwam niet mee")
    }
    guard try await tablet.tel("select keept from spelers where id = ?", [bram]) == 1 else { throw Fout("keept kwam niet als 1 terug") }
}

await scenario("5. Een wissel op de telefoon staat binnen een paar seconden op de tablet") {
    let begin = Date()
    try await telefoon.voegToe("gebeurtenissen", ["id": id(), "team_id": team, "wedstrijd_id": wedstrijd, "soort": "wissel", "t": 900, "erin": gijs, "eruit": finn, "positie": "SP"])
    try await tot("de wissel is op de tablet") { try await tablet.tel("select count(*) from gebeurtenissen where soort = 'wissel'") == 1 }
    bevindingen.append("Van tik op het ene toestel tot zichtbaar op het andere: \(String(format: "%.1f", Date().timeIntervalSince(begin))) seconden (alles op één machine, dus zonder echt netwerk).")
}

await scenario("6. Twee toestellen houden zonder bereik dezelfde wedstrijd bij: de wissels van allebei komen aan") {
    try await telefoon.offline()
    try await tablet.offline()
    try await telefoon.voegToe("gebeurtenissen", ["id": id(), "team_id": team, "wedstrijd_id": wedstrijd, "soort": "wissel", "t": 1200, "erin": finn, "eruit": gijs, "positie": "SP"])
    try await telefoon.voegToe("gebeurtenissen", ["id": id(), "team_id": team, "wedstrijd_id": wedstrijd, "soort": "doelpunt", "t": 1300, "speler": finn])
    try await tablet.voegToe("gebeurtenissen", ["id": id(), "team_id": team, "wedstrijd_id": wedstrijd, "soort": "tegendoelpunt", "t": 1250])
    try await tablet.voegToe("gebeurtenissen", ["id": id(), "team_id": team, "wedstrijd_id": wedstrijd, "soort": "wissel", "t": 1400, "erin": gijs, "eruit": bram, "positie": "K"])
    guard try await telefoon.tel("select count(*) from gebeurtenissen") == 5, try await tablet.tel("select count(*) from gebeurtenissen") == 5 else {
        throw Fout("offline hoort elk toestel alleen zijn eigen twee erbij te hebben")
    }
    try await telefoon.online()
    try await tablet.online()
    try await tot("allebei hebben alle zeven") {
        let a = try await telefoon.tel("select count(*) from gebeurtenissen")
        let b = try await tablet.tel("select count(*) from gebeurtenissen")
        return a == 7 && b == 7
    }
    guard try await opServer("/gebeurtenissen?wedstrijd_id=eq.\(wedstrijd)", als: anna).count == 7 else { throw Fout("op de server staan er geen zeven") }
}

await scenario("7. Twee toestellen wijzigen zonder bereik dezelfde rij: ze komen op hetzelfde uit") {
    try await telefoon.offline()
    try await tablet.offline()
    try await telefoon.db.execute(sql: "update wedstrijden set tegenstander = 'van de telefoon', doelpunten_voor = 2 where id = ?", parameters: [wedstrijd])
    try await tablet.db.execute(sql: "update wedstrijden set tegenstander = 'van de tablet', notitie = 'alleen de tablet schreef dit' where id = ?", parameters: [wedstrijd])
    try await telefoon.online()
    try await tot("de telefoon heeft opgestuurd") { try await telefoon.wachtrij() == 0 }
    try await tablet.online()
    try await tot("de tablet heeft opgestuurd") { try await tablet.wachtrij() == 0 }
    try await tot("ze zijn het eens") {
        let a = try await telefoon.tekst("select tegenstander || '|' || doelpunten_voor || '|' || coalesce(notitie, '') from wedstrijden where id = ?", [wedstrijd])
        let b = try await tablet.tekst("select tegenstander || '|' || doelpunten_voor || '|' || coalesce(notitie, '') from wedstrijden where id = ?", [wedstrijd])
        return a == b && a == "van de tablet|2|alleen de tablet schreef dit"
    }
    bevindingen.append("Botst dezelfde rij, dan wint per veld wie het laatst opstuurt: de tegenstander kwam van de tablet, de stand van de telefoon bleef staan, en geen van beide ging verloren. Er komt geen botsingsmelding; dat is anders dan nu.")
}

await scenario("8. Een gebeurtenis weghalen op het ene toestel haalt hem weg op het andere") {
    try await telefoon.db.execute(sql: "delete from gebeurtenissen where soort = 'tegendoelpunt'", parameters: [])
    try await tot("hij is weg op de tablet") { try await tablet.tel("select count(*) from gebeurtenissen where soort = 'tegendoelpunt'") == 0 }
    guard try await tablet.tel("select count(*) from gebeurtenissen") == 6 else { throw Fout("er is meer weg dan die ene") }
}

await scenario("9. Een andere trainer krijgt niets van dit team binnen") {
    try await vanBas.logIn(als: bas)
    try await tot("Bas is gesynchroniseerd") { vanBas.db.currentStatus.hasSynced == true }
    try await Task.sleep(nanoseconds: 1_500_000_000)
    for tabel in ["teams", "spelers", "wedstrijden", "gebeurtenissen", "team_instellingen"] {
        let n = try await vanBas.tel("select count(*) from \(tabel)")
        guard n == 0 else { throw Fout("op het toestel van Bas staan \(n) rij(en) in \(tabel)") }
    }
}

await scenario("10. Wie in andermans team schrijft wordt geweigerd, en zijn toestel wordt rechtgezet") {
    let indringer = id()
    try await vanBas.voegToe("spelers", ["id": indringer, "team_id": team, "naam": "Indringer", "linie": "", "keept": 0])
    guard try await vanBas.tel("select count(*) from spelers") == 1 else { throw Fout("lokaal hoort hij er eerst gewoon te staan") }
    try await tot("de server heeft geweigerd") { vanBas.koppeling?.geweigerd.isEmpty == false }
    guard try await opServer("/spelers?id=eq.\(indringer)", als: anna).isEmpty else { throw Fout("de indringer staat op de server") }
    try await tot("het toestel van Bas is rechtgezet", binnen: 30) { try await vanBas.tel("select count(*) from spelers") == 0 }
    guard try await telefoon.tel("select count(*) from spelers") == 3 else { throw Fout("het team van Anna is geraakt") }
    // En daarna moet hij gewoon verder kunnen: de wachtrij mag niet vastzitten.
    let eigen = id()
    try await vanBas.voegToe("teams", ["id": eigen, "naam": "JO11-4"])
    try await tot("het eigen team van Bas staat op de server") { try await opServer("/teams?id=eq.\(eigen)", als: bas).count == 1 }
    bevindingen.append("Een geweigerde wijziging (\(vanBas.koppeling!.geweigerd[0].prefix(60))…) houdt de rij niet tegen: de app gooit hem weg, en de server haalt de rij weer van het toestel.")
}

await scenario("11. Een trainer die wordt toegelaten krijgt het team binnen, zonder opnieuw in te loggen") {
    // Anna laat Bas toe. In het echt gaat dat via een uitnodiging; hier rechtstreeks.
    let a = try await vraag("POST", "/team_leden", als: anna, body: ["team_id": team, "gebruiker": bas, "rol": "trainer"])
    guard a.status == 201 else { throw Fout("toelaten lukte niet: \(a.status) \(a.tekst)") }
    try await tot("Bas ziet de spelers") { try await vanBas.tel("select count(*) from spelers where team_id = ?", [team]) == 3 }
    try await tot("Bas ziet de wedstrijd") { try await vanBas.tel("select count(*) from gebeurtenissen where wedstrijd_id = ?", [wedstrijd]) == 6 }
}

await scenario("12. En wie eruit wordt gezet raakt het team weer kwijt") {
    let a = try await vraag("DELETE", "/team_leden?team_id=eq.\(team)&gebruiker=eq.\(bas)", als: anna)
    guard (200 ..< 300).contains(a.status) else { throw Fout("eruit zetten lukte niet: \(a.status) \(a.tekst)") }
    try await tot("de spelers zijn van het toestel van Bas") { try await vanBas.tel("select count(*) from spelers where team_id = ?", [team]) == 0 }
    try await tot("de wedstrijd is van het toestel van Bas") { try await vanBas.tel("select count(*) from gebeurtenissen where wedstrijd_id = ?", [wedstrijd]) == 0 }
}

await scenario("13. Uitloggen wist het toestel, en opnieuw inloggen haalt alles terug") {
    try await tablet.db.disconnectAndClear()
    guard try await tablet.tel("select count(*) from spelers") == 0 else { throw Fout("na uitloggen staan er nog spelers op het toestel") }
    try await tablet.logIn(als: anna)
    try await tot("alles is terug") {
        let s = try await tablet.tel("select count(*) from spelers")
        let g = try await tablet.tel("select count(*) from gebeurtenissen")
        return s == 3 && g == 6
    }
}

for t in [telefoon, tablet, vanBas] { try? await t.db.close() }
try? FileManager.default.removeItem(at: map)

print("\n\(geslaagd) van de \(geslaagd + mislukt.count) geslaagd")
if !bevindingen.isEmpty {
    print("\nWat opviel:")
    for b in bevindingen { print("- \(b)") }
}
exit(mislukt.isEmpty ? 0 : 1)
