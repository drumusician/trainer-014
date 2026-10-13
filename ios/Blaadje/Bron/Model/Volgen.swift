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
    struct Wedstrijd: Decodable, Equatable, Identifiable {
        let datum: String
        let tegenstander: String
        let thuis: Bool
        let status: String
        let voor: Int?
        let tegen: Int?
        var id: String { datum + tegenstander + status }
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
        let data = try await verkeer("volgpagina", ["p_code": code])
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
            _ = try? await verkeer("volg", ["p_code": kind.code, "p_token": token, "p_omgeving": omgeving])
        }
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
