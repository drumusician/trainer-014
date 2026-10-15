import BlaadjeKern
import StoreKit
import SwiftUI
import UniformTypeIdentifiers

/// Je account, het teamseizoen, een team volgen, en je gegevens.
struct Meer: View {
    @Environment(AppModel.self) private var app
    @Environment(Account.self) private var account
    @Environment(TeamAbonnement.self) private var abonnement
    @Environment(Volgen.self) private var volgen
    @State private var linkPlakken = false

    var body: some View {
        NavigationStack {
            Form {
                if Account.beschikbaar { AccountKaart() }
                if account.huidigTeam != nil || ProcessInfo.processInfo.arguments.contains("-proef-abonnement") { abonnementDeel }
                Section {
                    Button { linkPlakken = true } label: { Label("Een team volgen", systemImage: "bell") }
                } footer: {
                    Text(volgen.kinderen.isEmpty
                        ? "Heb je een link van een trainer gekregen? Daarmee volg je de wedstrijden van het team."
                        : "Je volgt \(volgen.kinderen.compactMap { $0.pagina?.naam }.joined(separator: " en ")). Je ziet het op het beginscherm.")
                }
                Section {
                    ShareLink(item: app.maakBackup(), preview: SharePreview("Gegevens van Blaadje")) {
                        Label("Je gegevens downloaden", systemImage: "arrow.down.doc")
                    }
                    .font(.subheadline)
                }
            }
            .sheet(isPresented: $linkPlakken) { LinkPlakken() }
            .navigationTitle("Meer")
        }
    }

    /// Eén aankoop zet het team aan voor het seizoen, voor alle ouders.
    @ViewBuilder
    private var abonnementDeel: some View {
        Section {
            if let status = abonnement.status {
                Label(status.tekst(), systemImage: status.aan ? "checkmark.seal" : "exclamationmark.circle")
            }
            if abonnement.status?.kopen() ?? true {
                Button {
                    Task { await abonnement.koop(team: account.huidigTeam ?? "") }
                } label: {
                    Text((abonnement.status?.aan == true ? "Koop het volgende seizoen" : "Zet het team aan voor dit seizoen")
                        + (abonnement.prijs.map { " · \($0)" } ?? ""))
                }
                .disabled(abonnement.bezig || abonnement.prijs == nil)
            }
            Button("Herstel een aankoop") { Task { await abonnement.herstel() } }
                .disabled(abonnement.bezig)
            if let melding = abonnement.melding {
                Text(melding).font(.footnote).foregroundStyle(.secondary)
            } else if abonnement.prijs == nil, abonnement.status?.kopen() ?? true {
                Text("Kopen lukt nu niet. Probeer het later nog eens.")
                    .font(.footnote).foregroundStyle(.secondary)
            }
        } header: {
            Text("Teamseizoen")
        } footer: {
            Text(abonnement.status?.aan == true && abonnement.status?.kopen() == true
                ? "Het seizoen loopt tot en met 31 juli. Koop je nu, dan staat het team ook volgend seizoen aan."
                : "Eén aankoop voor het hele team, tot en met 31 juli.")
        }
        .task { await abonnement.ververs() }
    }
}
