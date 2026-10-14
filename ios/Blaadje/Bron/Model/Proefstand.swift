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

    /// Met `-proef-volgt`: iemand die al een kind volgt, met een server die altijd hetzelfde antwoordt.
    @MainActor
    static func volgen() -> Volgen {
        guard isProef else { return Volgen() }
        let opslag = UserDefaults(suiteName: "proef-volgen-\(UUID().uuidString)")!
        if ProcessInfo.processInfo.arguments.contains("-proef-volgt") { opslag.set(["code-van-sem-0123456789"], forKey: "volgen.codes") }
        if ProcessInfo.processInfo.arguments.contains("-proef-teamlink") {
            opslag.set(["teamlink-jo14-0123456789"], forKey: "volgen.codes")
            opslag.set("proef-token-0123456789abcdef0123456789", forKey: "volgen.token")
        }
        let v = Volgen(verkeer: { functie, inhoud in
            if inhoud["p_code"]?.hasPrefix("teamlink-") == true {
                guard functie == "volgpagina" else { return Data("true".utf8) }
                return Data("""
                {"team":"JO14-1","kind":null,"mijn_kind":{"id":"p2","naam":"Noah"},"seizoen":"2026/27","trainingen":[],
                 "spelers":[{"id":"p1","naam":"Sem"},{"id":"p2","naam":"Noah"},{"id":"p3","naam":"Luuk"}],
                 "wedstrijden":[{"id":"w1","datum":"2026-10-25","aanvang":"10:30","tegenstander":"Ajax","thuis":true,"status":"gepland","voor":null,"tegen":null,
                   "taken":[{"id":"t1","soort":"limonade","wie":"Noah","van_mij":true},{"id":"t2","soort":"vlaggen","wie":"Sem","van_mij":false},
                            {"id":"t3","soort":"rijden","wie":null,"van_mij":false}]},
                  {"id":"w2","datum":"2026-11-01","aanvang":null,"tegenstander":"PSV","thuis":false,"status":"gepland","voor":null,"tegen":null,
                   "taken":[{"id":"t4","soort":"rijden","wie":"Luuk","van_mij":false}]}]}
                """.utf8)
            }
            guard functie == "volgpagina", inhoud["p_code"]?.hasPrefix("code-van-") == true else { return Data("null".utf8) }
            return Data("""
            {"team":"JO14-1","kind":"Sem","seizoen":"2026/27",
             "wedstrijden":[{"datum":"2026-09-05","tegenstander":"Excelsior","thuis":true,"status":"afgelopen","voor":3,"tegen":1},
                            {"datum":"2026-09-12","tegenstander":"Sparta","thuis":false,"status":"bezig","voor":1,"tegen":0},
                            {"datum":"2026-09-19","tegenstander":"Feyenoord","thuis":true,"status":"gepland","voor":null,"tegen":null}],
             "trainingen":[{"datum":"2026-09-01","status":"aanwezig"},{"datum":"2026-09-03","status":"afgemeld"}]}
            """.utf8)
        }, opslag: opslag)
        v.vraagMeldingen = {}
        return v
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
