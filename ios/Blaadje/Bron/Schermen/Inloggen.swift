import SwiftUI

/// Inloggen met een code uit de mail, als eigen blad: van het adres tot het team
/// dat je kiest. Klaar zodra je ingelogd bent.
struct Inloggen: View {
    @Environment(Account.self) private var account
    @Environment(\.dismiss) private var dismiss
    @State private var email = ""
    @State private var code = ""
    @FocusState private var typt: Bool

    var body: some View {
        NavigationStack {
            Form {
                switch account.fase {
                case .uit:
                    Section {
                        TextField("Je e-mailadres", text: $email)
                            .keyboardType(.emailAddress)
                            .textContentType(.emailAddress)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                            .focused($typt)
                            .onSubmit(stuur)
                        Button("Stuur mij een code", action: stuur)
                            .disabled(account.bezig || email.isEmpty)
                    } footer: {
                        Text(account.melding ?? "Je krijgt een mail met een code. Nog geen account? Dan maken we er een.")
                    }
                case .code(let adres):
                    Section {
                        TextField("Code", text: $code)
                            .keyboardType(.numberPad)
                            .textContentType(.oneTimeCode)
                            .focused($typt)
                        Button("Log in") {
                            Toetsenbord.weg()
                            Task { await account.bevestig(code); code = "" }
                        }
                        .disabled(account.bezig || code.isEmpty)
                        Button("Ander e-mailadres") { account.anderAdres() }
                    } footer: {
                        Text(account.melding ?? "De code staat in de mail naar \(adres). Geen mail? Kijk in je spam.")
                    }
                case .verbinden:
                    HStack {
                        ProgressView()
                        Text("Je team ophalen").foregroundStyle(.secondary).padding(.leading, 6)
                    }
                case .kiezen(let teams):
                    Section {
                        ForEach(teams) { team in
                            Button(team.leeg ? "Zet wat hier staat in \(team.naam)" : "Verder met \(team.naam)") {
                                Task { await account.kies(team) }
                            }
                        }
                        Button("Wat hier staat als nieuw team") { Task { await account.bewaarAlsNieuwTeam() } }
                    } header: {
                        Text("Met welk team ga je verder?")
                    } footer: {
                        Text(account.melding ?? "Er staat al een team in je account, en ook een op deze telefoon. Wat je niet kiest, bewaart de app apart.")
                    }
                case .hapert:
                    Section {
                        Button("Probeer opnieuw") { Task { await account.probeerOpnieuw() } }
                    } footer: {
                        Text(account.melding ?? "Je team ophalen lukte niet.")
                    }
                case .aan:
                    Section { Label("Je bent ingelogd", systemImage: "checkmark.circle") }
                }
            }
            .navigationTitle("Inloggen")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Sluit") { dismiss() } } }
            .onAppear { typt = true }
            .onChange(of: account.fase) { _, fase in
                if case .aan = fase { dismiss() }
                if case .code = fase { typt = true }
            }
        }
        .presentationDetents([.medium, .large])
    }

    private func stuur() {
        Toetsenbord.weg()
        Task { await account.stuurCode(email) }
    }
}

/// Bij Meer: wie er ingelogd is, en of alles in het account staat.
struct AccountKaart: View {
    @Environment(Account.self) private var account
    @State private var inloggen = false
    @State private var uitloggenVragen = false

    var body: some View {
        Section {
            if case .aan(let adres) = account.fase {
                LabeledContent("Ingelogd", value: adres)
                Label(
                    account.wachtend == 0 ? "Alles staat in je account" : "\(account.wachtend) \(account.wachtend == 1 ? "wijziging wacht" : "wijzigingen wachten") op bereik",
                    systemImage: account.wachtend == 0 ? "checkmark.icloud" : "icloud.and.arrow.up"
                )
                .foregroundStyle(.secondary)
                if account.geweigerd > 0 {
                    // Niet verzwijgen: dan klopt 'alles staat in je account' niet.
                    Label(
                        "\(account.geweigerd) \(account.geweigerd == 1 ? "wijziging kwam" : "wijzigingen kwamen") niet in je account. Download je gegevens onderaan deze pagina en meld het.",
                        systemImage: "exclamationmark.triangle"
                    )
                    .foregroundStyle(Kleur.oranje)
                }
                Button("Log uit", role: .destructive) { uitloggenVragen = true }
            } else if case .hapert(let adres) = account.fase {
                LabeledContent("Ingelogd", value: adres)
                Text(account.melding ?? "Je account is even niet bereikbaar.").font(.footnote).foregroundStyle(.secondary)
                Button("Probeer opnieuw") { Task { await account.probeerOpnieuw() } }
                Button("Log uit", role: .destructive) { uitloggenVragen = true }
            } else {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Zet je team online").font(.headline)
                    Text("Dan kunnen ouders meekijken, en staat je team ook op je andere telefoon en op blaadje.app.")
                        .font(.subheadline).foregroundStyle(.secondary)
                }
                .padding(.vertical, 2)
                Button(account.fase == .uit ? "Inloggen" : "Verder met inloggen") { inloggen = true }
            }
        } header: {
            Text("Account")
        }
        .sheet(isPresented: $inloggen) { Inloggen() }
        .confirmationDialog("Uitloggen?", isPresented: $uitloggenVragen, titleVisibility: .visible) {
            Button("Log uit", role: .destructive) { Task { await account.logUit() } }
            Button("Terug", role: .cancel) {}
        } message: {
            Text("Je team blijft op deze telefoon staan.")
        }
    }
}

/// Ouders erbij halen, in drie stappen: inloggen, het team aanzetten, de link
/// delen. Staat alles, dan alleen nog de link.
struct OudersErbij: View {
    @Environment(AppModel.self) private var app
    @Environment(Account.self) private var account
    @Environment(TeamAbonnement.self) private var abonnement
    @State private var inloggen = false
    let deel: () -> Void

    private var ingelogd: Bool { account.huidigTeam != nil || ProcessInfo.processInfo.arguments.contains("-proef-abonnement") }
    private var aan: Bool { abonnement.status?.aan == true }

    var body: some View {
        Section {
            if ingelogd, aan {
                Button(action: deel) { Label("Link voor ouders", systemImage: "square.and.arrow.up") }
            } else {
                stap(1, ingelogd ? "Ingelogd" : "Log in", klaar: ingelogd, uitleg: ingelogd ? nil : "Zo staat je team online.") {
                    Button("Inloggen") { inloggen = true }
                }
                stap(2, "Zet het team aan", klaar: aan, uitleg: aan ? nil : "Eén keer per seizoen, voor het hele team, tot en met 31 juli.") {
                    Button(abonnement.prijs ?? "Zet aan") {
                        Task { await abonnement.koop(team: account.huidigTeam ?? "") }
                    }
                    .disabled(!ingelogd || abonnement.bezig || abonnement.prijs == nil)
                }
                stap(3, "Deel de link in de groepsapp", klaar: false, uitleg: nil) {
                    Button("Deel", action: deel).disabled(!aan)
                }
                if let melding = abonnement.melding {
                    Text(melding).font(.footnote).foregroundStyle(.secondary)
                }
            }
        } header: {
            Text("Ouders erbij")
        } footer: {
            Text("Ouders volgen de wedstrijd live, zien het programma en wie wat regelt, en krijgen een herinnering voor hun taak.")
        }
        .sheet(isPresented: $inloggen) { Inloggen() }
        .task(id: account.huidigTeam) { await abonnement.ververs() }
    }

    private func stap(_ n: Int, _ titel: String, klaar: Bool, uitleg: String?, @ViewBuilder knop: () -> some View) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 12) {
            Image(systemName: klaar ? "checkmark.circle.fill" : "\(n).circle")
                .foregroundStyle(klaar ? Kleur.accent : .secondary)
                .font(.title3)
                .alignmentGuide(.firstTextBaseline) { $0[.bottom] - 4 }
            VStack(alignment: .leading, spacing: 2) {
                Text(titel).foregroundStyle(klaar ? .secondary : .primary)
                if let uitleg { Text(uitleg).font(.footnote).foregroundStyle(.secondary) }
            }
            Spacer(minLength: 8)
            if !klaar { knop().buttonStyle(.bordered).controlSize(.small) }
        }
    }
}

/// Naar een ander tabblad, bijvoorbeeld van het programma naar Team.
struct NaarTabKey: EnvironmentKey {
    static let defaultValue: (Hoofdscherm.Tab) -> Void = { _ in }
}

extension EnvironmentValues {
    var naarTab: (Hoofdscherm.Tab) -> Void {
        get { self[NaarTabKey.self] }
        set { self[NaarTabKey.self] = newValue }
    }
}
