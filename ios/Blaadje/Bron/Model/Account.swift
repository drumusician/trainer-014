import BlaadjeKern
import BlaadjeSync
import Foundation
import Observation

/// Waar de server staat. De sleutel is openbaar: hij geeft zelf nergens toegang
/// toe, dat doen de regels in de database (`supabase/schema.sql`).
enum Adressen {
    static let supabase = URL(string: "https://gdsqdsxflueawfipjqbw.supabase.co")!
    static let sleutel = "sb_publishable_Qrjs4tqjHTAGs-p7zsvNHw_CV5WHNtP"
    /// De PowerSync-dienst. Is dit leeg, dan is er geen account in de app.
    static let powersync = "https://6ace8adb3b1803753bd16951.powersync.journeyapps.com"

    static var sync: SyncAdres {
        SyncAdres(rest: supabase.appendingPathComponent("rest/v1"), powersync: powersync, sleutel: sleutel)
    }
}

/// Inloggen, en daarna alles gelijk houden met je account.
///
/// Zonder account werkt de app precies zoals altijd: alles staat op het toestel.
/// Met account staat het ook op de server, en op elk ander toestel waar je inlogt.
@MainActor
@Observable
final class Account {
    enum Fase: Equatable {
        case uit
        /// De mail is verstuurd; nu de code.
        case code(email: String)
        case verbinden
        /// Er staat iets op dit toestel én er staat een team in het account.
        case kiezen([Team])
        /// Ingelogd, maar de dienst die alles gelijk houdt antwoordt niet.
        case hapert(email: String)
        case aan(email: String)
    }

    struct Team: Equatable, Identifiable {
        let id: String
        let naam: String
        /// Staat wel in het account, maar er zit nog geen selectie in: zo is het
        /// met een team dat alleen in de webapp is gebruikt.
        let leeg: Bool
    }

    private(set) var fase: Fase = .uit
    private(set) var melding: String?
    private(set) var bezig = false
    /// Hoeveel wijzigingen nog naar de server moeten.
    private(set) var wachtend = 0
    /// Hoeveel wijzigingen de server niet wilde hebben, sinds het openen van de app.
    private(set) var geweigerd = 0

    static var beschikbaar: Bool { !Adressen.powersync.isEmpty }

    @ObservationIgnored private let model: AppModel
    @ObservationIgnored private let inlog: Inlog
    @ObservationIgnored private let map: URL
    @ObservationIgnored private var spiegel: Spiegel?
    @ObservationIgnored private var motor: Motor?
    @ObservationIgnored private var teller: Task<Void, Never>?

    init(model: AppModel, map: URL) {
        self.model = model
        self.map = map
        inlog = Inlog(basis: Adressen.supabase, sleutel: Adressen.sleutel, kluis: Sleutelhanger())
    }

    private var teamId: String? {
        get { UserDefaults.standard.string(forKey: "sync.team") }
        set { UserDefaults.standard.set(newValue, forKey: "sync.team") }
    }

    /// Van welk account wat op dit toestel staat. Blijft staan na uitloggen.
    private var eigenaar: String? {
        get { UserDefaults.standard.string(forKey: "sync.eigenaar") }
        set { UserDefaults.standard.set(newValue, forKey: "sync.eigenaar") }
    }

    /// De toestand waarvan we weten dat hij in de tabellen staat. Na een crash
    /// is het verschil met wat er nu staat precies wat nog weggeschreven moet.
    private var onthouden: URL { map.appendingPathComponent("blaadje-gespiegeld.json") }

    // MARK: - bij het openen

    func start() async {
        guard Self.beschikbaar, let sessie = await inlog.sessie else { return }
        fase = .verbinden
        await koppel(email: sessie.email, eersteKeer: false)
    }

    // MARK: - inloggen

    func stuurCode(_ email: String) async {
        let adres = email.trimmingCharacters(in: .whitespaces)
        guard adres.contains("@") else {
            melding = "Vul je e-mailadres in."
            return
        }
        await doe {
            try await self.inlog.stuurCode(email: adres)
            self.fase = .code(email: adres)
            self.melding = "De code staat in je mail. Niets gekregen? Kijk in je spam."
        }
    }

    func bevestig(_ code: String) async {
        guard case .code(let email) = fase else { return }
        await doe {
            let sessie = try await self.inlog.bevestig(email: email, code: code)
            self.fase = .verbinden
            self.melding = nil
            await self.koppel(email: sessie.email, eersteKeer: true)
        }
    }

    func anderAdres() {
        fase = .uit
        melding = nil
    }

    private func doe(_ wat: @escaping () async throws -> Void) async {
        bezig = true
        defer { bezig = false }
        do {
            try await wat()
        } catch InlogFout.afgewezen {
            melding = "Deze code klopt niet. Vraag een nieuwe aan."
        } catch InlogFout.storing {
            melding = "Dat lukte niet. Heb je bereik?"
        } catch {
            melding = "Dat lukte niet: \(error)"
        }
    }

    // MARK: - verbinden

    private func koppel(email: String, eersteKeer: Bool) async {
        let spiegel = self.spiegel ?? Spiegel(bestand: map.appendingPathComponent("blaadje-sync.sqlite").path)
        self.spiegel = spiegel
        do {
            try await spiegel.verbind(adres: Adressen.sync, toegang: inlog)
            if let team = teamId {
                let gespiegeld = (try? String(contentsOf: onthouden, encoding: .utf8)).flatMap { try? Opslag.lees($0) }
                begin(spiegel, team: team, gespiegeld: gespiegeld, email: email)
                return
            }
            // Wat hier staat komt uit een ander account (uitgelogd, met een ander
            // adres ingelogd): dat hoort niet in dit account. Het gaat opzij.
            if let vorige = eigenaar, vorige != email.lowercased(), hierStaatIets {
                model.zetOpzij("blaadje-ander-account")
                model.neemOver(emptyState())
            }
            // De eerste keer op dit toestel: eerst weten wat er al in het account
            // staat. Dat vragen we de server zelf; de spiegel kan na het wissen bij
            // uitloggen "klaar" zeggen terwijl hij nog niets binnen heeft, en dan
            // lijkt een account met een team een nieuw account.
            let opServer = try await serverTeams()
            try await spiegel.wachtOpEersteKeer(hooguit: 25)
            try await wachtTotBinnen(spiegel, opServer)
            let namen = Dictionary(try await spiegel.teams().map { ($0.id, $0.naam) }, uniquingKeysWith: { a, _ in a })
            let teams = opServer.map { Team(id: $0.id, naam: namen[$0.id] ?? "", leeg: $0.spelers == 0) }
            if teams.isEmpty {
                // Een nieuw account: wat op dit toestel staat wordt je team.
                teamId = UUID().uuidString.lowercased()
                begin(spiegel, team: teamId!, gespiegeld: nil, email: email)
            } else if !hierStaatIets, teams.count == 1 {
                try await neemTeamOver(teams[0], email: email)
            } else if hierStaatIets, teams.count == 1, teams[0].leeg {
                // Je team bestaat al (van de webapp) maar is hier nog leeg: wat op
                // dit toestel staat komt erin. Geen tweede team met dezelfde naam.
                vul(teams[0], email: email)
            } else {
                fase = .kiezen(teams)
            }
        } catch {
            fase = .hapert(email: email)
            // De woorden van de dienst erbij: zonder die weet niemand wat er mis is.
            melding = "Je team ophalen lukte niet. Probeer het zo nog eens.\n\n\(String(describing: error).prefix(300))"
        }
    }

    /// De teams waar je lid van bent, en hoeveel spelers erin staan, rechtstreeks van de server.
    private func serverTeams() async throws -> [(id: String, spelers: Int)] {
        guard let gebruiker = await inlog.sessie?.gebruiker else { throw InlogFout.nietIngelogd }
        let bewijs = try await inlog.bewijs()
        func vraag(_ pad: String) async throws -> [[String: Any]] {
            var verzoek = URLRequest(url: URL(string: Adressen.supabase.absoluteString + "/rest/v1/" + pad)!)
            verzoek.setValue(Adressen.sleutel, forHTTPHeaderField: "apikey")
            verzoek.setValue("Bearer \(bewijs)", forHTTPHeaderField: "Authorization")
            let (data, antwoord) = try await URLSession.shared.data(for: verzoek)
            guard (antwoord as? HTTPURLResponse)?.statusCode == 200,
                  let rijen = try JSONSerialization.jsonObject(with: data) as? [[String: Any]] else { throw InlogFout.storing }
            return rijen
        }
        let leden = try await vraag("team_leden?select=team_id&gebruiker=eq.\(gebruiker)").compactMap { $0["team_id"] as? String }
        if leden.isEmpty { return [] }
        let spelers = try await vraag("spelers?select=team_id&weg=is.null&team_id=in.(\(leden.joined(separator: ",")))")
            .compactMap { $0["team_id"] as? String }
        return leden.map { id in (id: id, spelers: spelers.filter { $0 == id }.count) }
    }

    /// Wacht tot de spiegel de teams heeft die de server noemt, met hun spelers.
    private func wachtTotBinnen(_ spiegel: Spiegel, _ teams: [(id: String, spelers: Int)]) async throws {
        for _ in 0..<50 {
            let tabellen = try await spiegel.lees()
            let hier = Set((tabellen["teams"] ?? []).compactMap { $0["id"]?.tekst })
            let spelers = (tabellen["spelers"] ?? []).compactMap { $0["team_id"]?.tekst }
            if teams.allSatisfy({ t in hier.contains(t.id) && spelers.filter { $0 == t.id }.count >= t.spelers }) { return }
            try await Task.sleep(nanoseconds: 500_000_000)
        }
        throw SyncFout("je team kwam niet binnen")
    }

    func probeerOpnieuw() async {
        guard case .hapert(let email) = fase else { return }
        fase = .verbinden
        melding = nil
        await koppel(email: email, eersteKeer: false)
    }

    private var hierStaatIets: Bool { !model.toestand.players.isEmpty || !model.toestand.archive.isEmpty }

    /// Dit toestel gaat verder met een team dat al in het account staat.
    func kies(_ team: Team) async {
        guard let email = await inlog.sessie?.email else { return }
        if team.leeg, hierStaatIets {
            vul(team, email: email)
            return
        }
        do { try await neemTeamOver(team, email: email) } catch { melding = "Dat lukte niet. Heb je bereik?" }
    }

    /// Wat op dit toestel staat komt in een team dat al bestaat maar nog leeg is.
    private func vul(_ team: Team, email: String) {
        guard let spiegel else { return }
        teamId = team.id
        // Er staat daar alleen de naam; de rest moet er dus nog bij.
        begin(spiegel, team: team.id, gespiegeld: nil, rijen: [Rij(tabel: "teams", id: team.id, kolommen: ["naam": .tekst(team.naam)])], email: email)
    }

    /// Wat op dit toestel staat komt als nieuw team in het account.
    func bewaarAlsNieuwTeam() async {
        guard let spiegel, let email = await inlog.sessie?.email else { return }
        teamId = UUID().uuidString.lowercased()
        begin(spiegel, team: teamId!, gespiegeld: nil, email: email)
    }

    private func neemTeamOver(_ team: Team, email: String) async throws {
        guard let spiegel else { return }
        guard let vanServer = SyncModel.toestand(uit: try await spiegel.lees(), team: team.id) else {
            melding = "Je team is er nog niet helemaal. Probeer het zo nog eens."
            return
        }
        // Wat hier stond is niet weg: het staat apart, voor als dit een vergissing was.
        if !model.toestand.players.isEmpty || !model.toestand.archive.isEmpty { model.zetOpzij("blaadje-voor-account") }
        model.neemOver(vanServer)
        teamId = team.id
        begin(spiegel, team: team.id, gespiegeld: vanServer, email: email)
    }

    private func begin(_ spiegel: Spiegel, team: String, gespiegeld: AppState?, rijen: [Rij]? = nil, email: String) {
        let onthouden = self.onthouden
        let motor = Motor(
            spiegel: spiegel, team: team, gespiegeld: gespiegeld, rijen: rijen,
            toestand: { [model] in model.toestand },
            neemOver: { [model] in model.neemOver($0) },
            onthoud: { try? Opslag.schrijf($0).write(to: onthouden, atomically: true, encoding: .utf8) }
        )
        self.motor = motor
        eigenaar = email.lowercased()
        model.naBewaren = { [weak motor] in motor?.lokaalGewijzigd() }
        motor.start()
        fase = .aan(email: email)
        melding = nil
        teller?.cancel()
        teller = Task { [weak self] in
            while !Task.isCancelled {
                if let n = try? await spiegel.wachtrij() { self?.wachtend = n }
                self?.geweigerd = spiegel.geweigerd.count
                try? await Task.sleep(nanoseconds: 2_000_000_000)
            }
        }
    }

    // MARK: - de link voor een ouder

    enum LinkFout: Error { case nietIngelogd, mislukt }

    /// De link waarmee anderen kunnen volgen: van het hele team, of (met `speler`)
    /// de eigen link van één kind, waar ook de trainingen van dat kind op staan.
    /// Bestaat hij al, dan dezelfde; anders een nieuwe.
    func ouderlink(speler: String? = nil) async throws -> URL {
        guard case .aan = fase, let team = teamId else { throw LinkFout.nietIngelogd }
        let bewijs = try await inlog.bewijs()
        func vraag(_ methode: String, _ pad: String, _ inhoud: [String: String]? = nil) async throws -> [[String: Any]] {
            var verzoek = URLRequest(url: URL(string: Adressen.supabase.absoluteString + "/rest/v1/" + pad)!)
            verzoek.httpMethod = methode
            verzoek.setValue(Adressen.sleutel, forHTTPHeaderField: "apikey")
            verzoek.setValue("Bearer \(bewijs)", forHTTPHeaderField: "Authorization")
            verzoek.setValue("application/json", forHTTPHeaderField: "Content-Type")
            verzoek.setValue("return=representation", forHTTPHeaderField: "Prefer")
            if let inhoud { verzoek.httpBody = try JSONSerialization.data(withJSONObject: inhoud) }
            let (data, antwoord) = try await URLSession.shared.data(for: verzoek)
            guard let status = (antwoord as? HTTPURLResponse)?.statusCode, (200..<300).contains(status) else { throw LinkFout.mislukt }
            return (try? JSONSerialization.jsonObject(with: data)) as? [[String: Any]] ?? []
        }
        let wie = speler.map { "speler_id=eq.\($0)" } ?? "speler_id=is.null"
        var rijen = try await vraag("GET", "deellinks?select=code&team_id=eq.\(team)&\(wie)&ingetrokken=is.null")
        if rijen.isEmpty {
            var nieuw = ["team_id": team]
            if let speler { nieuw["speler_id"] = speler }
            rijen = try await vraag("POST", "deellinks?select=code", nieuw)
        }
        guard let code = rijen.first?["code"] as? String, let url = URL(string: "https://blaadje.app/volg/?c=\(code)") else { throw LinkFout.mislukt }
        return url
    }

    // MARK: - het teamabonnement

    /// Het team van dit toestel, als je ingelogd bent.
    var huidigTeam: String? {
        if case .aan = fase { return teamId }
        return nil
    }

    /// Staat het team aan, en waardoor (`team_status` in supabase/abonnement.sql).
    func teamStatus() async -> TeamAbonnement.Status? {
        guard let team = huidigTeam, let bewijs = try? await inlog.bewijs() else { return nil }
        var verzoek = URLRequest(url: Adressen.supabase.appendingPathComponent("rest/v1/rpc/team_status"))
        verzoek.httpMethod = "POST"
        verzoek.setValue(Adressen.sleutel, forHTTPHeaderField: "apikey")
        verzoek.setValue("Bearer \(bewijs)", forHTTPHeaderField: "Authorization")
        verzoek.setValue("application/json", forHTTPHeaderField: "Content-Type")
        verzoek.httpBody = try? JSONSerialization.data(withJSONObject: ["p_team": team])
        guard let (data, antwoord) = try? await URLSession.shared.data(for: verzoek),
              (antwoord as? HTTPURLResponse)?.statusCode == 200 else { return nil }
        return TeamAbonnement.Status.lees(data)
    }

    /// Een aankoop van Apple naar de server, die hem nakijkt (supabase/functions/abonnement).
    nonisolated static func meldAankoop(_ jws: String) async -> Bool {
        var verzoek = URLRequest(url: Adressen.supabase.appendingPathComponent("functions/v1/abonnement"))
        verzoek.httpMethod = "POST"
        verzoek.setValue(Adressen.sleutel, forHTTPHeaderField: "apikey")
        verzoek.setValue("application/json", forHTTPHeaderField: "Content-Type")
        verzoek.httpBody = try? JSONSerialization.data(withJSONObject: ["transactie": jws])
        guard let (_, antwoord) = try? await URLSession.shared.data(for: verzoek) else { return false }
        return (antwoord as? HTTPURLResponse)?.statusCode == 200
    }

    // MARK: - uitloggen

    /// Wat op dit toestel staat blijft staan; het gaat alleen niet meer naar je account.
    /// Log je daarna met een ander adres in, dan gaat het opzij (zie `koppel`).
    func logUit() async {
        teller?.cancel()
        motor?.stop()
        motor = nil
        model.naBewaren = nil
        try? await spiegel?.wis()
        await inlog.logUit()
        teamId = nil
        try? FileManager.default.removeItem(at: onthouden)
        wachtend = 0
        fase = .uit
        melding = nil
    }
}
