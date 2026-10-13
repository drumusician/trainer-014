import BlaadjeKern
import SwiftUI

/// De selectie: wie er zijn, in welke linie, en wie kan keepen.
struct Team: View {
    @Environment(AppModel.self) private var app
    @Environment(Account.self) private var account
    @State private var link: Ouderlink?
    @State private var linkMelding: String?
    @State private var toevoegen = false
    @State private var namen = ""
    @State private var hernoemen: Player?
    @State private var nieuweNaam = ""

    var body: some View {
        NavigationStack {
            List {
                Section {
                    ForEach(app.spelers) { p in
                        VStack(alignment: .leading, spacing: 8) {
                            HStack {
                                Text(p.name).font(.body.weight(.semibold))
                                Spacer()
                                Button { app.wisselKeeper(p.id) } label: {
                                    Label("Keept", systemImage: p.keeper == true ? "hand.raised.fill" : "hand.raised")
                                        .labelStyle(.iconOnly)
                                        .foregroundStyle(p.keeper == true ? Kleur.accent : .secondary)
                                }
                                .buttonStyle(.borderless)
                                .accessibilityLabel("\(p.name) kan keepen")
                                .accessibilityAddTraits(p.keeper == true ? .isSelected : [])
                            }
                            Picker("Linie", selection: Binding(get: { p.line }, set: { app.zetLinie(p.id, $0) })) {
                                Text("Geen").tag(FieldLine.geen)
                                Text("Verdediging").tag(FieldLine.V)
                                Text("Midden").tag(FieldLine.M)
                                Text("Aanval").tag(FieldLine.A)
                            }
                            .pickerStyle(.segmented)
                        }
                        .padding(.vertical, 2)
                        .swipeActions(edge: .leading) {
                            Button { deel(p) } label: { Label("Link voor ouders", systemImage: "link") }.tint(Kleur.groen)
                        }
                        .swipeActions {
                            Button(role: .destructive) { app.verwijder(p) } label: { Label("Verwijder", systemImage: "trash") }
                            Button { nieuweNaam = p.name; hernoemen = p } label: { Label("Naam", systemImage: "pencil") }
                        }
                    }
                } header: {
                    Text("\(app.spelers.count) spelers")
                } footer: {
                    if !app.spelers.isEmpty {
                        Text("De linie bepaalt wie de app voorstelt bij een wissel. Het handje betekent: kan keepen. Veeg naar links om een naam te wijzigen of iemand te verwijderen, en naar rechts voor de link waarmee ouders kunnen volgen.")
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
                            ShareLink(item: l.url, message: Text("Volg \(l.naam) bij \(app.toestand.teamName) in de Blaadje-app.")) {
                                Label("Stuur de link", systemImage: "square.and.arrow.up")
                            }
                        } footer: {
                            Text("Stuur deze link alleen naar de ouders van \(l.naam). Wie hem heeft, volgt de wedstrijden en ziet de trainingen van \(l.naam), en van niemand anders. Speeltijd en wissels staan er niet op.")
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
            .alert("Naam wijzigen", isPresented: Binding(get: { hernoemen != nil }, set: { if !$0 { hernoemen = nil } })) {
                TextField("Naam", text: $nieuweNaam)
                Button("Bewaar") { if let p = hernoemen { app.hernoem(p.id, nieuweNaam) }; hernoemen = nil }
                Button("Annuleer", role: .cancel) { hernoemen = nil }
            }
        }
    }
}

private struct Ouderlink: Identifiable {
    let naam: String
    let url: URL
    var id: String { url.absoluteString }
}

extension Team {
    /// De link hangt aan je account: zonder inloggen is er niets om naar te verwijzen.
    fileprivate func deel(_ p: Player) {
        Task {
            do {
                link = Ouderlink(naam: p.name, url: try await account.ouderlink(speler: p.id))
            } catch Account.LinkFout.nietIngelogd {
                linkMelding = "Log eerst in bij Meer. De link verwijst naar je team in je account."
            } catch {
                linkMelding = "De link maken lukte niet. Heb je bereik?"
            }
        }
    }
}
