import BlaadjeKern
import SwiftUI

/// Het team: de naam, ouders erbij, wie er zijn, en hoe jullie spelen.
struct Team: View {
    @Environment(AppModel.self) private var app
    @Environment(Account.self) private var account
    @State private var link: Ouderlink?
    @State private var linkMelding: String?
    @State private var toevoegen = false
    @State private var namen = ""
    @State private var teamnaam = ""
    @State private var bewerken: Player?

    var body: some View {
        NavigationStack {
            List {
                Section {
                    TextField("Teamnaam", text: $teamnaam)
                        .submitLabel(.done)
                        // Bij elke letter bewaren: je tikt daarna zo naar een ander scherm.
                        .onChange(of: teamnaam) { _, nieuw in
                            if nieuw != app.toestand.teamName { app.zetTeamnaam(nieuw) }
                        }
                }

                if !app.spelers.isEmpty, Account.beschikbaar { OudersErbij { deel(nil) } }
                if account.huidigTeam != nil { Trainers() }

                Section {
                    ForEach(app.spelers) { p in
                        Button { bewerken = p } label: {
                            HStack {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(p.name).foregroundStyle(.primary)
                                    Text(Self.over(p)).font(.footnote).foregroundStyle(.secondary)
                                }
                                Spacer()
                                Image(systemName: "chevron.right").font(.caption.bold()).foregroundStyle(.tertiary)
                            }
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        .swipeActions {
                            Button(role: .destructive) { app.verwijder(p) } label: { Label("Verwijder", systemImage: "trash") }
                        }
                    }
                } header: {
                    Text("\(app.spelers.count) spelers")
                } footer: {
                    if !app.spelers.isEmpty {
                        Text("Met de linie stelt de app bij een wissel iemand voor die past.")
                    }
                }

                Section("Zo spelen we") {
                    FormatieKiezer(formatie: Binding(get: { app.toestand.formation }, set: { app.kiesFormatie($0) }))
                    Picker("Delen", selection: Binding(get: { app.toestand.parts }, set: { app.zetDelen($0, minuten: app.toestand.minutesPerPart) })) {
                        Text("2 helften").tag(2)
                        Text("4 kwarten").tag(4)
                    }
                    Stepper(
                        "\(Int(app.toestand.minutesPerPart)) minuten per deel",
                        value: Binding(get: { app.toestand.minutesPerPart }, set: { app.zetDelen(app.toestand.parts, minuten: $0) }),
                        in: 5...60, step: 5
                    )
                    NavigationLink("Standaardopstelling") {
                        Opstelling(bron: .standaard, klaarTitel: "Klaar") {}
                            .navigationTitle("Standaardopstelling")
                            .navigationBarTitleDisplayMode(.inline)
                            .onAppear { app.maakStandaardopstelling() }
                    }
                }
            }
            .toetsenbordWeg()
            .navigationTitle("Team")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button { namen = ""; toevoegen = true } label: { Label("Spelers toevoegen", systemImage: "plus") }
                }
            }
            .overlay {
                if app.spelers.isEmpty {
                    ContentUnavailableView("Nog geen spelers", systemImage: "person.3", description: Text("Tik op + om namen toe te voegen."))
                }
            }
            .sheet(isPresented: $toevoegen) {
                NavigationStack {
                    Form {
                        Section {
                            TextField("Eén naam per regel", text: $namen, axis: .vertical)
                                .lineLimit(5...14)
                                .autocorrectionDisabled()
                                .textInputAutocapitalization(.words)
                        }
                    }
                    .navigationTitle("Spelers toevoegen")
                    .navigationBarTitleDisplayMode(.inline)
                    .toolbar {
                        ToolbarItem(placement: .cancellationAction) { Button("Annuleer") { toevoegen = false } }
                        ToolbarItem(placement: .confirmationAction) {
                            Button("Voeg toe") { app.voegSpelersToe(namen); toevoegen = false }.bold()
                        }
                    }
                }
                .presentationDetents([.medium, .large])
            }
            .sheet(item: $link) { l in
                NavigationStack {
                    Form {
                        Section {
                            ShareLink(item: l.url, message: Text(l.kind ? "Volg \(l.naam) bij \(app.toestand.teamName) in de Blaadje-app." : "Volg \(l.naam) in Blaadje.")) {
                                Label("Stuur de link", systemImage: "square.and.arrow.up")
                            }
                        } footer: {
                            Text(l.kind
                                ? "Alleen voor de ouders van \(l.naam): zij zien ook de trainingen."
                                : "Zet deze link in de groepsapp van het team.")
                        }
                    }
                    .navigationTitle("Link voor \(l.naam)")
                    .navigationBarTitleDisplayMode(.inline)
                    .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Klaar") { link = nil } } }
                }
                .presentationDetents([.medium])
            }
            .alert("Link voor ouders", isPresented: Binding(get: { linkMelding != nil }, set: { if !$0 { linkMelding = nil } })) {
                Button("Oké") { linkMelding = nil }
            } message: { Text(linkMelding ?? "") }
            .sheet(item: $bewerken) { p in SpelerBewerken(id: p.id) { deel(p) } }
            .onAppear { teamnaam = app.toestand.teamName }
        }
    }

    /// "Verdediging · keept"
    static func over(_ p: Player) -> String {
        let linie: String? = switch p.line {
        case .V: "Verdediging"
        case .M: "Midden"
        case .A: "Aanval"
        default: nil
        }
        let keept = p.keeper == true
        guard let linie else { return keept ? "Keept" : "Geen linie" }
        return keept ? linie + " · keept" : linie
    }
}

/// Eén speler: naam, linie, keepen, de eigen link voor de ouders, of weg.
struct SpelerBewerken: View {
    @Environment(AppModel.self) private var app
    @Environment(\.dismiss) private var dismiss
    let id: String
    let deel: () -> Void
    @State private var naam = ""

    var body: some View {
        NavigationStack {
            if let p = app.spelers.first(where: { $0.id == id }) {
                Form {
                    Section {
                        TextField("Naam", text: $naam)
                            .onSubmit { app.hernoem(id, naam) }
                    }
                    Section {
                        Picker("Linie", selection: Binding(get: { p.line }, set: { app.zetLinie(id, $0) })) {
                            Text("Geen").tag(FieldLine.geen)
                            Text("Verdediging").tag(FieldLine.V)
                            Text("Midden").tag(FieldLine.M)
                            Text("Aanval").tag(FieldLine.A)
                        }
                        .pickerStyle(.segmented)
                        Toggle("Kan keepen", isOn: Binding(get: { p.keeper == true }, set: { _ in app.wisselKeeper(id) }))
                    } footer: {
                        Text("Met de linie stelt de app bij een wissel iemand voor die past.")
                    }
                    if Account.beschikbaar {
                        Section {
                            Button { deel() } label: { Label("Link voor de ouders van \(p.name)", systemImage: "link") }
                        } footer: {
                            Text("Met deze link zien ze ook de trainingen van \(p.name).")
                        }
                    }
                    Section {
                        Button("Verwijder \(p.name)", role: .destructive) {
                            app.verwijder(p)
                            dismiss()
                        }
                    }
                }
                .navigationTitle(p.name)
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Klaar") {
                            if naam != p.name { app.hernoem(id, naam) }
                            dismiss()
                        }
                        .bold()
                    }
                }
                .onAppear { naam = p.name }
            }
        }
        .presentationDetents([.medium, .large])
    }
}

private struct Ouderlink: Identifiable {
    let naam: String
    /// De eigen link van één kind, in plaats van die van het team.
    let kind: Bool
    let url: URL
    var id: String { url.absoluteString }
}

extension Team {
    /// De link hangt aan je account: zonder inloggen is er niets om naar te verwijzen.
    fileprivate func deel(_ p: Player?) {
        Task {
            do {
                link = Ouderlink(naam: p?.name ?? app.toestand.teamName, kind: p != nil, url: try await account.ouderlink(speler: p?.id))
            } catch Account.LinkFout.nietIngelogd {
                linkMelding = "Log eerst in, dan kun je de link delen."
            } catch {
                linkMelding = "De link maken lukte niet. Heb je bereik?"
            }
        }
    }
}
