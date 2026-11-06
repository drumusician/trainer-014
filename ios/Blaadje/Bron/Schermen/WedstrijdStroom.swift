import BlaadjeKern
import SwiftUI

/// Van 'wie is er' tot 'bewaren': één ding tegelijk, het hele scherm.
struct WedstrijdStroom: View {
    @Environment(AppModel.self) private var app
    @Environment(\.dismiss) private var dismiss

    enum Stap { case aanwezig, opstelling, wedstrijd, afloop }
    @State private var stap: Stap

    init(begin: Stap) { _stap = State(initialValue: begin) }

    /// Waar je verder gaat als je de wedstrijd weer opent.
    static func stap(voor w: Match?) -> Stap {
        guard let w else { return .aanwezig }
        if w.finished { return .afloop }
        if ClockActions.kickedOff(w) { return .wedstrijd }
        // Vóór de aftrap kun je de opstelling altijd nog veranderen.
        return w.lineup.opHetVeld.isEmpty ? .aanwezig : .opstelling
    }

    var body: some View {
        Group {
            switch stap {
            case .aanwezig:
                metKop("Wie is er?") { Aanwezig { stap = .opstelling } }
            case .opstelling:
                // Zich afgemeld nadat je de opstelling al maakte: Wie is er? blijft binnen bereik.
                metKop("Opstelling", erbij: ("Wie is er?", { stap = .aanwezig })) {
                    // Een wedstrijd van later: klaar is terug naar het programma.
                    let later = (app.match?.date ?? "") > app.vandaag
                    Opstelling(bron: .wedstrijd, klaarTitel: later ? "Klaar" : "Naar de wedstrijd", nuOfNooit: !later) {
                        if later { dismiss() } else { stap = .wedstrijd }
                    }
                }
            case .wedstrijd:
                Wedstrijd(
                    naarAfloop: { stap = .afloop },
                    sluit: { dismiss() },
                    naarAanwezig: { stap = .aanwezig }
                )
            case .afloop:
                metKop("Afgelopen") { Afloop { dismiss() } }
            }
        }
        .animation(.default, value: stap)
    }

    private func metKop(
        _ titel: String, erbij: (titel: String, doe: () -> Void)? = nil, @ViewBuilder inhoud: () -> some View
    ) -> some View {
        NavigationStack {
            inhoud()
                .navigationTitle(titel)
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .topBarLeading) {
                        Button("Sluit") { dismiss() }
                    }
                    if let erbij {
                        ToolbarItem(placement: .topBarTrailing) {
                            Button(erbij.titel, action: erbij.doe)
                        }
                    }
                }
        }
    }
}
