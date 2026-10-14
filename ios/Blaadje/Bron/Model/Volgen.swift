import BlaadjeKern
import Foundation
import Observation
import UIKit
import UserNotifications

/// Een wedstrijd volgen als ouder: met de link van je kind, zonder account.
///
/// De link is de sleutel. De app bewaart alleen de code eruit, en geeft de
/// server het adres waarop deze telefoon meldingen ontvangt.
@MainActor
@Observable
final class Volgen {
    /// Wie wat regelt bij een wedstrijd. `wie` is de voornaam van het kind; leeg is open.
    struct Taak: Decodable, Equatable, Identifiable {
        let id: String
        let soort: String
        let wie: String?
        let vanMij: Bool

        enum CodingKeys: String, CodingKey { case id, soort, wie, vanMij = "van_mij" }

        init(id: String, soort: String, wie: String?, vanMij: Bool) {
            self.id = id
            self.soort = soort
            self.wie = wie
            self.vanMij = vanMij
        }

        init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            id = try c.decode(String.self, forKey: .id)
            soort = try c.decode(String.self, forKey: .soort)
            wie = try c.decodeIfPresent(String.self, forKey: .wie)
            vanMij = try c.decodeIfPresent(Bool.self, forKey: .vanMij) ?? false
        }

        var woord: String { TaskKind(rawValue: soort).map(ProgramActions.woord) ?? soort }
    }

    struct Wedstrijd: Decodable, Equatable, Identifiable {
        /// Leeg bij een server van vóór het programma.
        let kenmerk: String?
        let datum: String
        let aanvang: String?
        let tegenstander: String
        let thuis: Bool
        let status: String
        let voor: Int?
        let tegen: Int?
        let taken: [Taak]
        var id: String { kenmerk ?? datum + tegenstander + status }

        enum CodingKeys: String, CodingKey { case kenmerk = "id", datum, aanvang, tegenstander, thuis, status, voor, tegen, taken }

        init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            kenmerk = try c.decodeIfPresent(String.self, forKey: .kenmerk)
            datum = try c.decode(String.self, forKey: .datum)
            aanvang = try c.decodeIfPresent(String.self, forKey: .aanvang)
            tegenstander = try c.decode(String.self, forKey: .tegenstander)
            thuis = try c.decode(Bool.self, forKey: .thuis)
            status = try c.decode(String.self, forKey: .status)
            voor = try c.decodeIfPresent(Int.self, forKey: .voor)
            tegen = try c.decodeIfPresent(Int.self, forKey: .tegen)
            taken = try c.decodeIfPresent([Taak].self, forKey: .taken) ?? []
        }
    }

    struct Speler: Decodable, Equatable, Identifiable {
        let id: String
        let naam: String
    }

    struct Training: Decodable, Equatable, Identifiable {
        let datum: String
        let status: String?
        var id: String { datum + (status ?? "") }
    }

    struct Pagina: Decodable, Equatable {
        let team: String
        /// Leeg bij de link van het hele team: die gaat over geen enkel kind.
        let kind: String?
        /// Wie of wat je volgt, in woorden.
        var naam: String { kind ?? team }
        let wedstrijden: [Wedstrijd]
        let trainingen: [Training]
        /// Het kind dat bij deze telefoon hoort: dat van de link, of het gekozen kind.
        let mijnKind: Speler?
        /// Om je kind te kiezen; alleen bij de link van het team.
        let spelers: [Speler]

        /// Uit als het team geen abonnement heeft (na de gratis periode).
        let aan: Bool

        enum CodingKeys: String, CodingKey { case team, kind, wedstrijden, trainingen, mijnKind = "mijn_kind", spelers, aan }

        init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            team = try c.decode(String.self, forKey: .team)
            kind = try c.decodeIfPresent(String.self, forKey: .kind)
            wedstrijden = try c.decode([Wedstrijd].self, forKey: .wedstrijden)
            trainingen = try c.decode([Training].self, forKey: .trainingen)
            mijnKind = try c.decodeIfPresent(Speler.self, forKey: .mijnKind)
            spelers = try c.decodeIfPresent([Speler].self, forKey: .spelers) ?? []
            aan = try c.decodeIfPresent(Bool.self, forKey: .aan) ?? true
        }

        /// Moet de ouder nog zeggen welk kind van hem is?
        var kindKiezen: Bool { kind == nil && mijnKind == nil && !spelers.isEmpty }
    }

    struct Kind: Identifiable, Equatable {
        let code: String
        var pagina: Pagina?
        var id: String { code }
    }

    /// Een verzoek aan de server: de naam van de functie en wat erin gaat; terug komt wat de server antwoordt.
    typealias Verkeer = @Sendable (_ functie: String, _ inhoud: [String: String]) async throws -> Data

    private(set) var kinderen: [Kind]
    private(set) var melding: String?
    private(set) var bezig = false

    @ObservationIgnored private let verkeer: Verkeer
    @ObservationIgnored private let opslag: UserDefaults
    @ObservationIgnored private var token: String?
    /// Vraagt toestemming voor meldingen en meldt de telefoon aan bij Apple. In tests gebeurt er niets.
    @ObservationIgnored var vraagMeldingen: () async -> Void = {
        let mag = (try? await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound])) ?? false
        if mag { UIApplication.shared.registerForRemoteNotifications() }
    }

    init(verkeer: @escaping Verkeer = Volgen.server, opslag: UserDefaults = .standard) {
        self.verkeer = verkeer
        self.opslag = opslag
        kinderen = (opslag.stringArray(forKey: "volgen.codes") ?? []).map { Kind(code: $0) }
        token = opslag.string(forKey: "volgen.token")
    }

    /// De functies in `supabase/volgen.sql`, met de openbare sleutel.
    nonisolated static let server: Verkeer = { functie, inhoud in
        var verzoek = URLRequest(url: Adressen.supabase.appendingPathComponent("rest/v1/rpc/\(functie)"))
        verzoek.httpMethod = "POST"
        verzoek.setValue(Adressen.sleutel, forHTTPHeaderField: "apikey")
        verzoek.setValue("Bearer \(Adressen.sleutel)", forHTTPHeaderField: "Authorization")
        verzoek.setValue("application/json", forHTTPHeaderField: "Content-Type")
        verzoek.httpBody = try JSONSerialization.data(withJSONObject: inhoud)
        let (data, antwoord) = try await URLSession.shared.data(for: verzoek)
        guard let status = (antwoord as? HTTPURLResponse)?.statusCode, (200..<300).contains(status) else { throw URLError(.badServerResponse) }
        return data
    }

    /// De code uit wat iemand plakt of aantikt: de hele link, of alleen de code.
    nonisolated static func code(uit tekst: String) -> String? {
        let schoon = tekst.trimmingCharacters(in: .whitespacesAndNewlines)
        var kandidaat = schoon
        if let url = URLComponents(string: schoon), url.scheme != nil {
            // https://blaadje.app/volg/?c=CODE, blaadje://volg/CODE of blaadje://volg?c=CODE
            kandidaat = url.queryItems?.first { $0.name == "c" }?.value
                ?? url.path.split(separator: "/").last.map(String.init) ?? ""
        }
        let geldig = kandidaat.count >= 20 && kandidaat.count <= 80
            && kandidaat.allSatisfy { $0.isASCII && ($0.isLetter || $0.isNumber || $0 == "-") }
        return geldig ? kandidaat : nil
    }

    private func haalPagina(_ code: String) async throws -> Pagina? {
        var inhoud = ["p_code": code]
        if let token { inhoud["p_token"] = token }
        let data = try await verkeer("volgpagina", inhoud)
        // Een code die niet (meer) klopt geeft `null`.
        return try? JSONDecoder().decode(Pagina.self, from: data)
    }

    /// Een kind erbij. Geeft terug of het gelukt is; zo niet, dan staat in `melding` waarom.
    @discardableResult
    func voegToe(_ tekst: String) async -> Bool {
        guard let code = Volgen.code(uit: tekst) else {
            melding = "Dit is geen link van Blaadje. Plak de hele link die je van de trainer kreeg."
            return false
        }
        if kinderen.contains(where: { $0.code == code }) {
            melding = nil
            return true
        }
        bezig = true
        defer { bezig = false }
        do {
            guard let pagina = try await haalPagina(code) else {
                melding = "Deze link werkt niet meer. Vraag de trainer om een nieuwe."
                return false
            }
            kinderen.append(Kind(code: code, pagina: pagina))
            opslag.set(kinderen.map(\.code), forKey: "volgen.codes")
            melding = nil
            await vraagMeldingen()
            await meldAan()
            return true
        } catch {
            melding = "Dat lukte niet. Heb je bereik?"
            return false
        }
    }

    /// Haalt voor elk kind op hoe het ervoor staat.
    func ververs() async {
        for i in kinderen.indices {
            let code = kinderen[i].code
            guard let pagina = try? await haalPagina(code), i < kinderen.count, kinderen[i].code == code else { continue }
            kinderen[i].pagina = pagina
        }
    }

    func stop(_ kind: Kind) async {
        if let token { _ = try? await verkeer("ontvolg", ["p_code": kind.code, "p_token": token]) }
        kinderen.removeAll { $0.code == kind.code }
        opslag.set(kinderen.map(\.code), forKey: "volgen.codes")
    }

    /// Apple gaf deze telefoon een adres voor meldingen.
    func zetToken(_ data: Data) async {
        token = data.map { String(format: "%02x", $0) }.joined()
        opslag.set(token, forKey: "volgen.token")
        await meldAan()
    }

    /// Bij elke link het adres van deze telefoon neerleggen. Herhalen mag: de server kent hem dan al.
    func meldAan() async {
        guard let token else { return }
        #if DEBUG
        let omgeving = "proef"
        #else
        let omgeving = "echt"
        #endif
        for kind in kinderen {
            var inhoud = ["p_code": kind.code, "p_token": token, "p_omgeving": omgeving]
            if let speler = gekozen(kind.code) { inhoud["p_speler"] = speler }
            _ = try? await verkeer("volg", inhoud)
        }
    }

    // MARK: - je kind en de taken

    /// Het kind dat de ouder bij deze link koos. Ook hier bewaard: het adres voor
    /// meldingen kan pas later komen, en dan moet de keuze mee.
    func gekozen(_ code: String) -> String? { opslag.string(forKey: "volgen.kind.\(code)") }

    func kiesKind(_ code: String, _ speler: String) async {
        opslag.set(speler, forKey: "volgen.kind.\(code)")
        if let token {
            _ = try? await verkeer("kies_kind", ["p_code": code, "p_token": token, "p_speler": speler])
        } else {
            await vraagMeldingen()
        }
        await ververs()
    }

    /// Je eigen taak teruggeven. De rest van het team krijgt een melding dat hij open staat.
    func kanNiet(_ code: String, _ taak: String) async { await taakActie("taak_kan_niet", code, taak) }

    /// Een open taak overnemen.
    func doeIk(_ code: String, _ taak: String) async { await taakActie("taak_doe_ik", code, taak) }

    private func taakActie(_ functie: String, _ code: String, _ taak: String) async {
        guard let token else {
            melding = "Zet meldingen aan voor Blaadje; daaraan herkent de app dat jij het bent."
            return
        }
        do {
            let data = try await verkeer(functie, ["p_code": code, "p_token": token, "p_taak": taak])
            melding = String(decoding: data, as: UTF8.self).contains("true") ? nil : "Dat kon niet meer. Misschien was iemand je voor."
        } catch {
            melding = "Dat lukte niet. Heb je bereik?"
        }
        await ververs()
    }
}

/// Wat iOS alleen aan een 'app delegate' vertelt: het adres voor meldingen.
final class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    @MainActor static weak var volgen: Volgen?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        return true
    }

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        Task { @MainActor in await AppDelegate.volgen?.zetToken(deviceToken) }
    }

    /// Ook met de app open: een doelpunt wil je zien.
    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification) async -> UNNotificationPresentationOptions {
        Task { @MainActor in await AppDelegate.volgen?.ververs() }
        return [.banner, .sound, .list]
    }
}
