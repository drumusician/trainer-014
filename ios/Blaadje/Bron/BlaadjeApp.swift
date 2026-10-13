import SwiftUI

@main
struct BlaadjeApp: App {
    @State private var app: AppModel
    @State private var account: Account

    init() {
        let model = Proefstand.model()
        _app = State(initialValue: model)
        let map = AppModel.standaardBestand?.deletingLastPathComponent() ?? FileManager.default.temporaryDirectory
        _account = State(initialValue: Account(model: model, map: map))
    }
    @Environment(\.scenePhase) private var fase

    var body: some Scene {
        WindowGroup {
            Hoofdscherm()
                .environment(app)
                .environment(account)
                // Niet in de tests die de app bedienen: die horen niets naar een server te sturen.
                .task { if !Proefstand.isProef { await account.start() } }
                .tint(Kleur.accent)
                .onChange(of: fase) { _, nieuw in
                    if nieuw == .active { app.bijDeTijd() }
                }
        }
    }
}

struct Hoofdscherm: View {
    var body: some View {
        TabView {
            Start().tabItem { Label("Wedstrijd", systemImage: "sportscourt") }
            Trainingen().tabItem { Label("Trainingen", systemImage: "figure.run") }
            Team().tabItem { Label("Team", systemImage: "person.3") }
            Seizoen().tabItem { Label("Seizoen", systemImage: "chart.bar") }
            Meer().tabItem { Label("Meer", systemImage: "ellipsis.circle") }
        }
    }
}
