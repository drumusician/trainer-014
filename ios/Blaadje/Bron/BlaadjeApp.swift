import SwiftUI

@main
struct BlaadjeApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var delegate
    @State private var app: AppModel
    @State private var account: Account
    @State private var volgen: Volgen
    @State private var abonnement = TeamAbonnement()

    init() {
        let model = Proefstand.model()
        _app = State(initialValue: model)
        let map = AppModel.standaardBestand?.deletingLastPathComponent() ?? FileManager.default.temporaryDirectory
        _account = State(initialValue: Account(model: model, map: map))
        let volgen = Proefstand.volgen()
        _volgen = State(initialValue: volgen)
        AppDelegate.volgen = volgen
    }
    @Environment(\.scenePhase) private var fase

    var body: some Scene {
        WindowGroup {
            Hoofdscherm()
                .environment(app)
                .environment(account)
                .environment(volgen)
                .environment(abonnement)
                // Niet in de tests die de app bedienen: die horen niets naar een server te sturen.
                .task {
                    abonnement.haalStatus = { [account] in await account.teamStatus() }
                    if Proefstand.isProef {
                        abonnement.haalStatus = { Proefstand.abonnement }
                    } else {
                        abonnement.start()
                        await account.start()
                    }
                }
                .tint(Kleur.accent)
                .onChange(of: fase) { _, nieuw in
                    if nieuw == .active {
                        app.bijDeTijd()
                        Task { await volgen.ververs() }
                    }
                }
        }
    }
}

struct Hoofdscherm: View {
    @Environment(AppModel.self) private var app
    @Environment(Volgen.self) private var volgen
    @Environment(Account.self) private var account
    @Environment(TeamAbonnement.self) private var abonnement
    enum Tab { case volgen, wedstrijd, trainingen, team, seizoen, meer }
    @State private var tab: Tab?
    /// Voor een trainer die ook volgt: Volgen als blad over zijn eigen schermen.
    @State private var volgTonen = false

    var body: some View {
        // Wie alleen volgt en geen team heeft, is ouder: die krijgt Volgen vooraan
        // en geen tabs voor een team dat hij niet heeft. Een trainer die ook volgt
        // houdt zijn vijf tabs (een zesde verstopt iOS) en vindt Volgen op het beginscherm.
        let ouder = !volgen.kinderen.isEmpty && app.spelers.isEmpty
        let gekozen = tab.flatMap { $0 == .volgen && !ouder ? nil : $0 } ?? (ouder ? .volgen : .wedstrijd)
        TabView(selection: Binding(get: { gekozen }, set: { tab = $0 })) {
            if ouder {
                VolgScherm().tabItem { Label("Volgen", systemImage: "bell") }.tag(Tab.volgen)
                Start().tabItem { Label("Trainer", systemImage: "sportscourt") }.tag(Tab.wedstrijd)
            } else {
                Start().tabItem { Label("Wedstrijd", systemImage: "sportscourt") }.tag(Tab.wedstrijd)
                Trainingen().tabItem { Label("Trainingen", systemImage: "figure.run") }.tag(Tab.trainingen)
                Team().tabItem { Label("Team", systemImage: "person.3") }.tag(Tab.team)
                Seizoen().tabItem { Label("Seizoen", systemImage: "chart.bar") }.tag(Tab.seizoen)
            }
            Meer().tabItem { Label("Meer", systemImage: "ellipsis.circle") }.tag(Tab.meer)
        }
        .environment(\.naarTab) { tab = $0 }
        .environment(\.ouderZien, account.huidigTeam != nil && abonnement.status?.aan == true)
        // Weten of het team aanstaat, ook voordat iemand Meer of Team opent.
        .task(id: account.huidigTeam) { if account.huidigTeam != nil { await abonnement.ververs() } }
        .sheet(isPresented: $volgTonen) { VolgScherm() }
        // De link van de trainer, aangetikt in een bericht.
        .onOpenURL { url in
            Task {
                if await volgen.voegToe(url.absoluteString) {
                    tab = .volgen
                    volgTonen = !app.spelers.isEmpty
                }
            }
        }
    }
}
