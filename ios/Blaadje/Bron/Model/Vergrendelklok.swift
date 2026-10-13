import ActivityKit
import BlaadjeKern
import Foundation

/// De klok en de stand op het vergrendelscherm, zolang er een wedstrijd loopt.
/// Langs de lijn zit je telefoon in je zak; dan wil je niet eerst ontgrendelen
/// om te zien hoe lang er nog is.
@MainActor
enum Vergrendelklok {
    /// Uit in tests en voorbeelden: die horen niets op het vergrendelscherm te zetten.
    static var aan = false
    private static var laatste: KlokGegevens.ContentState?

    /// Wat er nu hoort te staan; `nil` als er niets te tonen valt.
    static func stand(_ t: AppState, nu: Double) -> KlokGegevens.ContentState? {
        guard let w = t.match, !w.finished, ClockActions.kickedOff(w) else { return nil }
        let ons = t.teamName.isEmpty ? "Wij" : t.teamName
        let zij = w.opponent.isEmpty ? "Tegenstander" : w.opponent
        let uitslag = homeFirst(score(w), w.home)
        let verstreken = elapsed(w, nu: nu)
        return KlokGegevens.ContentState(
            links: w.home ? ons : zij,
            rechts: w.home ? zij : ons,
            standLinks: uitslag.voor,
            standRechts: uitslag.tegen,
            deel: w.inBreak ? breakName(w.part, w.parts) : partName(w.part, w.parts),
            loopt: w.running,
            begin: w.running ? Date(timeIntervalSince1970: nu / 1000 - verstreken) : Date(timeIntervalSince1970: 0),
            verstreken: w.running ? 0 : verstreken
        )
    }

    /// Het begin schuift per keer een paar milliseconden; dat is geen nieuws.
    static func zelfde(_ a: KlokGegevens.ContentState, _ b: KlokGegevens.ContentState) -> Bool {
        var c = b
        c.begin = a.begin
        return a == c && abs(a.begin.timeIntervalSince(b.begin)) < 1
    }

    static func werkBij(_ t: AppState, nu: Double) {
        guard aan else { return }
        guard let nieuw = stand(t, nu: nu) else {
            laatste = nil
            for bezig in Activity<KlokGegevens>.activities {
                Task { await bezig.end(nil, dismissalPolicy: .immediate) }
            }
            return
        }
        if let laatste, zelfde(laatste, nieuw) { return }
        laatste = nieuw
        let inhoud = ActivityContent(state: nieuw, staleDate: nil)
        if let bezig = Activity<KlokGegevens>.activities.first {
            Task { await bezig.update(inhoud) }
        } else if ActivityAuthorizationInfo().areActivitiesEnabled {
            // Mag het niet van de trainer, dan is er gewoon geen klok op het
            // vergrendelscherm; de wedstrijd gaat door.
            _ = try? Activity.request(attributes: KlokGegevens(), content: inhoud)
        }
    }
}
