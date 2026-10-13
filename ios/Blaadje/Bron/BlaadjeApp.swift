import SwiftUI

@main
struct BlaadjeApp: App {
    @State private var app = Proefstand.model()
    @Environment(\.scenePhase) private var fase

    var body: some Scene {
        WindowGroup {
            Hoofdscherm()
                .environment(app)
                .tint(Kleur.groen)
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
