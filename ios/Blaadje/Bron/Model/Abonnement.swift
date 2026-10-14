import Foundation
import Observation
import StoreKit

/// Het teamseizoen: één aankoop via Apple zet het team aan tot 31 juli, voor
/// alle ouders. Het verlengt niet vanzelf; elk seizoen koopt iemand het opnieuw.
///
/// De app geeft bij het kopen het team mee (`appAccountToken`), zodat de server
/// weet welk team het is zonder te weten wie er betaalde. De server kijkt de
/// handtekening van Apple na en rekent uit tot wanneer het geldt
/// (supabase/functions/abonnement); een terugbetaling hoort hij van Apple zelf.
@MainActor
@Observable
final class TeamAbonnement {
    static let product = "app.blaadje.ios.seizoen"

    struct Status: Equatable {
        var aan: Bool
        var abonnementTot: Date?

        /// Wat `team_status` teruggeeft.
        static func lees(_ data: Data) -> Status? {
            guard let o = try? JSONSerialization.jsonObject(with: data) as? [String: Any], let aan = o["aan"] as? Bool else { return nil }
            func datum(_ k: String) -> Date? {
                guard let s = o[k] as? String else { return nil }
                let f = ISO8601DateFormatter()
                f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
                return f.date(from: s) ?? ISO8601DateFormatter().date(from: s)
            }
            return Status(aan: aan, abonnementTot: datum("abonnement_tot"))
        }

        /// In woorden, voor bij Meer.
        func tekst(nu: Date = Date()) -> String {
            let f = DateFormatter()
            f.locale = Locale(identifier: "nl_NL")
            f.dateFormat = "d MMMM yyyy"
            // Tot en met 31 juli: op de server is het 1 augustus, 0:00.
            if let tot = abonnementTot, tot > nu { return "Het team staat aan tot en met \(f.string(from: tot.addingTimeInterval(-1)))." }
            if aan { return "Het team staat aan." }
            return "Het team staat uit. Ouders zien het programma en de taken niet, en krijgen geen meldingen."
        }

        /// Kopen kan als het team uit staat, en vanaf mei voor het volgende seizoen.
        func kopen(nu: Date = Date()) -> Bool {
            guard let tot = abonnementTot, tot > nu else { return true }
            return tot.timeIntervalSince(nu) < 100 * 86400
        }
    }

    private(set) var status: Status?
    private(set) var prijs: String?
    private(set) var bezig = false
    private(set) var melding: String?

    @ObservationIgnored private var aanbod: Product?
    @ObservationIgnored private var luisteraar: Task<Void, Never>?
    /// De stand van het team ophalen, en een aankoop melden bij de server. In tests iets anders.
    @ObservationIgnored var haalStatus: () async -> Status? = { nil }
    @ObservationIgnored var meld: @Sendable (String) async -> Bool = { await Account.meldAankoop($0) }

    /// Bij het openen: luisteren naar wat Apple later nog stuurt, en wat er al
    /// gekocht is opnieuw aan de server geven (een verlenging die de server nog
    /// niet had, staat er dan alsnog).
    func start() {
        luisteraar?.cancel()
        luisteraar = Task { [meld] in
            for await uitkomst in Transaction.updates {
                guard case .verified(let t) = uitkomst, t.productID == Self.product else { continue }
                _ = await meld(uitkomst.jwsRepresentation)
                await t.finish()
            }
        }
        Task { [meld] in
            for await uitkomst in Transaction.currentEntitlements {
                guard case .verified(let t) = uitkomst, t.productID == Self.product else { continue }
                _ = await meld(uitkomst.jwsRepresentation)
            }
        }
    }

    func ververs() async {
        status = await haalStatus()
        if aanbod == nil {
            aanbod = try? await Product.products(for: [Self.product]).first
            prijs = aanbod?.displayPrice
        }
    }

    /// Kopen voor dit team.
    func koop(team: String) async {
        guard let aanbod, let teamUUID = UUID(uuidString: team) else {
            melding = "Het abonnement is nu niet te koop. Heb je bereik?"
            return
        }
        bezig = true
        defer { bezig = false }
        do {
            switch try await aanbod.purchase(options: [.appAccountToken(teamUUID)]) {
            case .success(let uitkomst):
                guard case .verified(let t) = uitkomst else {
                    melding = "Apple kon de aankoop niet bevestigen."
                    return
                }
                let gelukt = await meld(uitkomst.jwsRepresentation)
                await t.finish()
                melding = gelukt ? nil : "Gekocht. Het team gaat aan zodra er bereik is."
                await ververs()
            case .pending:
                melding = "De aankoop wacht op goedkeuring."
            case .userCancelled:
                melding = nil
            @unknown default:
                melding = nil
            }
        } catch {
            melding = "Kopen lukte niet. Probeer het nog eens."
        }
    }

    /// Wie al gekocht had (andere telefoon, opnieuw geïnstalleerd).
    func herstel() async {
        bezig = true
        defer { bezig = false }
        try? await AppStore.sync()
        for await uitkomst in Transaction.currentEntitlements {
            guard case .verified(let t) = uitkomst, t.productID == Self.product else { continue }
            _ = await meld(uitkomst.jwsRepresentation)
        }
        await ververs()
    }
}
