import BlaadjeKern
import StoreKit
import SwiftUI
import UniformTypeIdentifiers

/// Teamnaam, en je gegevens erin of eruit.
struct Meer: View {
    @Environment(AppModel.self) private var app
    @Environment(Account.self) private var account
    @Environment(TeamAbonnement.self) private var abonnement
    @State private var abonnementBeheren = false
    @State private var email = ""
    @State private var inlogcode = ""
    @State private var uitloggenVragen = false
    @State private var linkPlakken = false
    @Environment(Volgen.self) private var volgen
    @State private var teamnaam = ""
    @State private var code = ""
    @State private var bestandKiezen = false
    @State private var uitkomst: String?
    @State private var fout: String?

    var body: some View {
        NavigationStack {
            Form {
                Section("Team") {
                    TextField("Teamnaam", text: $teamnaam)
                        .submitLabel(.done)
                        // Bij elke letter bewaren: je tikt daarna zo naar een ander scherm.
                        .onChange(of: teamnaam) { _, nieuw in
                            if nieuw != app.toestand.teamName { app.zetTeamnaam(nieuw) }
                        }
                }
                if Account.beschikbaar { accountDeel }
                if account.huidigTeam != nil || ProcessInfo.processInfo.arguments.contains("-proef-abonnement") { abonnementDeel }
                Section {
                    Button { linkPlakken = true } label: { Label("Een team volgen", systemImage: "bell") }
                } footer: {
                    Text(volgen.kinderen.isEmpty
                        ? "Heb je van een trainer een link gekregen? Daarmee volg je de wedstrijden van het team."
                        : "Je volgt \(volgen.kinderen.compactMap { $0.pagina?.naam }.joined(separator: " en ")). Je vindt het op het beginscherm.")
                }
                Section {
                    Button { bestandKiezen = true } label: { Label("Kies een back-up", systemImage: "doc") }
                    TextField("Of plak hier een overzetcode", text: $code, axis: .vertical)
                        .lineLimit(1...4)
                        .autocorrectionDisabled()
                        .textInputAutocapitalization(.never)
                    if !code.isEmpty {
                        Button("Lees de code in") {
                            Toetsenbord.weg()
                            leesIn(code)
                            code = ""
                        }
                    }
                } header: {
                    Text("Overzetten van blaadje.app")
                } footer: {
                    Text("Maak op blaadje.app bij Meer een back-up of een code. Selectie, trainingen en bewaarde wedstrijden komen mee; wat hier al stond wordt vervangen.")
                }
                Section {
                    ShareLink(item: app.maakBackup(), preview: SharePreview("Back-up van Blaadje")) {
                        Label("Maak een back-up", systemImage: "square.and.arrow.up")
                    }
                } footer: {
                    if case .aan = account.fase {
                        Text("Je seizoen staat ook in je account. Een back-up is een los bestand dat je zelf bewaart, bijvoorbeeld in Bestanden.")
                    } else {
                        Text("Alles staat alleen op dit toestel. Bewaar af en toe een back-up, bijvoorbeeld in Bestanden.")
                    }
                }
            }
            .toetsenbordWeg()
            .sheet(isPresented: $linkPlakken) { LinkPlakken() }
            .navigationTitle("Meer")
            .onAppear { teamnaam = app.toestand.teamName }
            .fileImporter(isPresented: $bestandKiezen, allowedContentTypes: [.json, .plainText]) { resultaat in
                guard case .success(let url) = resultaat else { return }
                let mag = url.startAccessingSecurityScopedResource()
                defer { if mag { url.stopAccessingSecurityScopedResource() } }
                guard let tekst = try? String(contentsOf: url, encoding: .utf8) else {
                    fout = "Dat bestand is niet te lezen."
                    return
                }
                leesIn(tekst)
            }
            .alert("Ingelezen", isPresented: Binding(get: { uitkomst != nil }, set: { if !$0 { uitkomst = nil } })) {
                Button("Oké") { uitkomst = nil }
            } message: { Text(uitkomst ?? "") }
            .alert("Dat lukte niet", isPresented: Binding(get: { fout != nil }, set: { if !$0 { fout = nil } })) {
                Button("Oké") { fout = nil }
            } message: { Text(fout ?? "") }
        }
    }

    /// Eén aankoop zet het team aan, voor alle ouders.
    @ViewBuilder
    private var abonnementDeel: some View {
        Section {
            if let status = abonnement.status {
                Label(status.tekst(), systemImage: status.aan ? "checkmark.seal" : "exclamationmark.circle")
            }
            if abonnement.status?.abonnementTot.map({ $0 > Date() }) == true {
                Button("Beheer het abonnement") { abonnementBeheren = true }
            } else {
                Button {
                    Task { await abonnement.koop(team: account.huidigTeam ?? "") }
                } label: {
                    Text("Zet het team aan" + (abonnement.prijs.map { " · \($0) per jaar" } ?? ""))
                }
                .disabled(abonnement.bezig || abonnement.prijs == nil)
            }
            Button("Herstel een aankoop") { Task { await abonnement.herstel() } }
                .disabled(abonnement.bezig)
            if let melding = abonnement.melding {
                Text(melding).font(.footnote).foregroundStyle(.secondary)
            }
        } header: {
            Text("Teamabonnement")
        } footer: {
            Text("Eén abonnement voor het hele team: ouders zien het programma en de taken, en krijgen de meldingen. De wedstrijd bijhouden blijft altijd gratis.")
        }
        .task { await abonnement.ververs() }
        .manageSubscriptionsSheet(isPresented: $abonnementBeheren)
    }

    @ViewBuilder
    private var accountDeel: some View {
        Section {
            switch account.fase {
            case .uit:
                TextField("Je e-mailadres", text: $email)
                    .keyboardType(.emailAddress)
                    .textContentType(.emailAddress)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                Button("Stuur mij een code") {
                    Toetsenbord.weg()
                    Task { await account.stuurCode(email) }
                }
                .disabled(account.bezig || email.isEmpty)
            case .code:
                TextField("De code uit de mail", text: $inlogcode)
                    .keyboardType(.numberPad)
                    .textContentType(.oneTimeCode)
                Button("Log in") {
                    Toetsenbord.weg()
                    Task { await account.bevestig(inlogcode); inlogcode = "" }
                }
                .disabled(account.bezig || inlogcode.isEmpty)
                Button("Ander e-mailadres") { account.anderAdres() }
            case .verbinden:
                HStack {
                    ProgressView()
                    Text("Verbinden met je account").foregroundStyle(.secondary).padding(.leading, 6)
                }
            case .hapert(let adres):
                LabeledContent("Ingelogd", value: adres)
                Button("Probeer opnieuw") { Task { await account.probeerOpnieuw() } }
                Button("Log uit", role: .destructive) { uitloggenVragen = true }
            case .kiezen(let teams):
                Text("Er staat al een team in je account, en er staat ook iets op dit toestel. Waar ga je mee verder?")
                    .font(.subheadline)
                ForEach(teams) { team in
                    Button(team.leeg ? "Zet wat hier staat in \(team.naam)" : "Verder met \(team.naam) uit mijn account") {
                        Task { await account.kies(team) }
                    }
                }
                Button("Bewaar wat hier staat als nieuw team") { Task { await account.bewaarAlsNieuwTeam() } }
            case .aan(let adres):
                LabeledContent("Ingelogd", value: adres)
                Label(
                    account.wachtend == 0 ? "Alles staat in je account" : "\(account.wachtend) \(account.wachtend == 1 ? "wijziging wacht" : "wijzigingen wachten") op bereik",
                    systemImage: account.wachtend == 0 ? "checkmark.icloud" : "icloud.and.arrow.up"
                )
                .foregroundStyle(.secondary)
                if account.geweigerd > 0 {
                    // Niet verzwijgen: dan klopt 'alles staat in je account' niet.
                    Label(
                        "\(account.geweigerd) \(account.geweigerd == 1 ? "wijziging is" : "wijzigingen zijn") door de server geweigerd en staan niet in je account. Maak een back-up en meld het.",
                        systemImage: "exclamationmark.triangle"
                    )
                    .foregroundStyle(Kleur.oranje)
                }
                Button("Log uit", role: .destructive) { uitloggenVragen = true }
            }
        } header: {
            Text("Account")
        } footer: {
            if let melding = account.melding {
                Text(melding)
            } else if account.fase == .uit {
                Text("Met een account staat je seizoen ook op de server en op je andere toestellen. Zonder account werkt alles gewoon op dit toestel.")
            } else if case .kiezen = account.fase {
                Text("Kies je een team uit je account, dan wordt wat hier staat apart gezet en niet weggegooid.")
            }
        }
        .confirmationDialog("Uitloggen?", isPresented: $uitloggenVragen, titleVisibility: .visible) {
            Button("Log uit", role: .destructive) { Task { await account.logUit() } }
            Button("Terug", role: .cancel) {}
        } message: {
            Text("Wat op dit toestel staat blijft staan. Het gaat alleen niet meer naar je account.")
        }
    }

    private func leesIn(_ tekst: String) {
        do {
            uitkomst = try app.leesIn(tekst)
            teamnaam = app.toestand.teamName
        } catch {
            fout = "Dit is geen back-up of code van Blaadje."
        }
    }
}
