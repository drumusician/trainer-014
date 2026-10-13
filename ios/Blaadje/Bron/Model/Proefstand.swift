import BlaadjeKern
import Foundation

/// Voor de tests die de app echt bedienen: een vaste beginstand in het geheugen,
/// zodat een test nooit iemands echte seizoen raakt en altijd hetzelfde ziet.
enum Proefstand {
    static var isProef: Bool { ProcessInfo.processInfo.arguments.contains { $0.hasPrefix("-proef-") } }

    @MainActor
    static func model() -> AppModel {
        let args = ProcessInfo.processInfo.arguments
        if args.contains("-proef-klok") { Vergrendelklok.aan = true }
        if args.contains("-proef-leeg") { return AppModel(bestand: nil, toestand: emptyState()) }
        if args.contains("-proef-team") { return AppModel(bestand: nil, toestand: team()) }
        Vergrendelklok.aan = true
        return AppModel()
    }

    static func team() -> AppState {
        var t = emptyState()
        t.teamName = "JO14-1"
        t.formation = "4-3-3"
        t.parts = 2
        t.minutesPerPart = 35
        let namen: [(String, FieldLine, Bool)] = [
            ("Sem", .geen, true), ("Noah", .V, false), ("Luuk", .V, false), ("Finn", .V, false), ("Bram", .V, false),
            ("Daan", .M, false), ("Jesse", .M, false), ("Milan", .M, false),
            ("Ruben", .A, false), ("Thijs", .A, false), ("Lars", .A, false),
            ("Stijn", .A, false), ("Tim", .M, false), ("Joep", .V, true),
        ]
        t.players = namen.enumerated().map { i, n in Player(id: "p\(i + 1)", name: n.0, line: n.1, keeper: n.2 ? true : nil) }
        let plekken = ["K", "RV", "CVr", "CVl", "LV", "MR", "MC", "ML", "RB", "SP", "LB"]
        t.defaultLineup = DefaultLineup(
            formation: "4-3-3",
            lineup: Lineup(plekken.enumerated().map { i, plek in (plek, "p\(i + 1)") }),
            bench: ["p12", "p13", "p14"]
        )
        return t
    }
}
