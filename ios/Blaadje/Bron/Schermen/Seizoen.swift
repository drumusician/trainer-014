import BlaadjeKern
import SwiftUI

/// Wat er gespeeld is, en wat dat over het seizoen optelt.
struct Seizoen: View {
    @Environment(AppModel.self) private var app
    /// Met veertien spelers staan de wedstrijden anders altijd buiten beeld.
    @State private var toon = Toon.wedstrijden

    enum Toon: String, CaseIterable { case wedstrijden = "Wedstrijden", spelers = "Spelers" }

    var body: some View {
        NavigationStack {
            List {
                if !app.toestand.archive.isEmpty {
                    Section {
                        Picker("Toon", selection: $toon) {
                            ForEach(Toon.allCases, id: \.self) { Text($0.rawValue).tag($0) }
                        }
                        .pickerStyle(.segmented)
                        .listRowBackground(Color.clear)
                        .listRowInsets(EdgeInsets())
                    }
                }
                if !app.toestand.archive.isEmpty, toon == .spelers {
                    Section("Speeltijd dit seizoen") {
                        ForEach(seasonTotals(app.toestand.archive, app.spelers), id: \.name) { r in
                            HStack {
                                VStack(alignment: .leading, spacing: 1) {
                                    Text(r.name)
                                    Text("\(r.wedstrijden) \(r.wedstrijden == 1 ? "wedstrijd" : "wedstrijden")"
                                        + (r.doelpunten > 0 ? " · \(r.doelpunten) \(r.doelpunten == 1 ? "doelpunt" : "doelpunten")" : "")
                                        + (r.keeper > 0 ? " · \(Int((r.keeper / 60).rounded()))′ keeper" : ""))
                                        .font(.caption).foregroundStyle(.secondary)
                                }
                                Spacer()
                                Text("\(Int((r.seconds / 60).rounded()))′").bold().monospacedDigit()
                            }
                        }
                    }
                }
                if !app.toestand.archive.isEmpty, toon == .wedstrijden {
                    Section {
                        ForEach(Array(app.toestand.archive.enumerated()), id: \.offset) { i, a in
                            let u = homeFirst(a.score, a.home)
                            let ons = a.teamName ?? app.toestand.teamName
                            NavigationLink {
                                Bewaard(index: i)
                            } label: {
                                HStack {
                                    VStack(alignment: .leading, spacing: 1) {
                                        Text(a.home ? "\(ons) – \(a.opponent)" : "\(a.opponent) – \(ons)").lineLimit(1)
                                        Text(dateText(a.date)).font(.caption).foregroundStyle(.secondary)
                                    }
                                    Spacer()
                                    Text("\(u.voor) – \(u.tegen)").bold().monospacedDigit()
                                }
                            }
                        }
                    }
                }
            }
            .navigationTitle("Seizoen")
            .overlay {
                if app.toestand.archive.isEmpty {
                    ContentUnavailableView(
                        "Nog niets gespeeld", systemImage: "calendar",
                        description: Text("Bewaarde wedstrijden komen hier te staan, met de speeltijd over het seizoen.")
                    )
                }
            }
        }
    }
}

/// Een bewaarde wedstrijd terugkijken en bijwerken.
private struct Bewaard: View {
    @Environment(AppModel.self) private var app
    @Environment(\.dismiss) private var dismiss
    let index: Int

    @State private var bijwerken = false
    @State private var moment = 0
    @State private var notitie = ""
    @State private var minuut = ""
    @State private var tegen = false
    @State private var maker = ""
    @State private var verwijderenVragen = false

    var body: some View {
        if app.toestand.archive.indices.contains(index) {
            inhoud(app.toestand.archive[index])
        } else {
            ContentUnavailableView("Deze wedstrijd staat er niet meer", systemImage: "calendar")
        }
    }

    /// De naam van nu, ook als iemand na de wedstrijd anders is gaan heten.
    private func naamNu(_ r: PlayingTimeRow) -> String { app.speler(r.id)?.name ?? r.name }

    private func inhoud(_ a: ArchivedMatch) -> some View {
        let u = homeFirst(a.score, a.home)
        let ons = a.teamName ?? app.toestand.teamName
        let momenten = momentenVan(a, app.spelers)
        let nu = min(moment, max(0, momenten.count - 1))
        let regels = timelineRows(a.events, app.spelers, a.names, a.parts ?? 2, a.formation)
        return List {
            Section {
                VStack(spacing: 4) {
                    Text(a.home ? "\(ons) – \(a.opponent)" : "\(a.opponent) – \(ons)")
                        .font(.subheadline).foregroundStyle(.secondary)
                    Text("\(u.voor) – \(u.tegen)").font(.system(size: 44, weight: .bold)).monospacedDigit()
                    Text("\(datumMetJaar(a.date)) · \(mmss(a.duration)) gespeeld · \(a.formation)")
                        .font(.caption).foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity)
            }

            if bijwerken {
                Section("Bijwerken") {
                    DatePicker(
                        "Datum",
                        selection: Binding(get: { AppModel.datum(a.date) ?? Date() }, set: { app.wijzigBewaard(index, datum: $0) }),
                        displayedComponents: .date
                    )
                    Picker("Waar", selection: Binding(get: { a.home }, set: { app.wijzigBewaard(index, thuis: $0) })) {
                        Text("Thuis").tag(true)
                        Text("Uit").tag(false)
                    }
                    .pickerStyle(.segmented)
                    // Bij elke letter bewaren: je tikt daarna meteen op Klaar.
                    TextField("Tegenstander", text: Binding(get: { a.opponent }, set: { app.wijzigBewaard(index, tegenstander: $0) }))
                }
            }

            // Wie er begon staat nergens opgeslagen, maar is terug te rekenen uit de wissels.
            if !momenten.isEmpty, !bijwerken {
                let m = momenten[nu]
                Section {
                    VeldMetBank {
                        Veld(
                            formatie: a.formation, opstelling: Lineup(m.lineup.entries.map { ($0.key, Optional($0.value)) }),
                            gemarkeerd: Set(m.veranderd), naam: { id in id.map { nameOf($0, app.spelers, a.names) } }
                        )
                    } bank: {
                        Bank(
                            bank: m.bench, formatie: a.formation,
                            speler: { id in id.flatMap { id in app.speler(id) ?? a.names?[id].map { Player(id: id, name: $0) } } },
                            leeg: "Niemand op de bank."
                        ) { _ in }
                    }
                    .frame(height: 330)
                    HStack {
                        Button("Terug") { moment = nu - 1 }.disabled(nu == 0)
                        Spacer()
                        Text("\(mmss(m.t)) · \(nu + 1) van \(momenten.count)").font(.caption).monospacedDigit().foregroundStyle(.secondary)
                        Spacer()
                        Button("Verder") { moment = nu + 1 }.disabled(nu >= momenten.count - 1)
                    }
                    .buttonStyle(.bordered)
                    Text(m.tekst).font(.subheadline)
                } header: {
                    Text("Opstelling")
                } footer: {
                    Text("Zo begon je. Tik door de wissels om te zien hoe het verder liep.")
                }
            }

            if !bijwerken {
                Section("Speeltijd") {
                    ForEach(Array(a.playingTime.sorted { $0.seconds > $1.seconds }.enumerated()), id: \.offset) { _, r in
                        HStack {
                            VStack(alignment: .leading, spacing: 1) {
                                Text(naamNu(r))
                                let plekken = positionText(r.positions, a.formation)
                                if !plekken.isEmpty {
                                    Text(plekken).font(.caption).foregroundStyle(.secondary)
                                } else if let k = r.keeper, k > 0 {
                                    Text("\(Int((k / 60).rounded())) min in het doel").font(.caption).foregroundStyle(.secondary)
                                }
                            }
                            Spacer()
                            Text("\(Int((r.seconds / 60).rounded()))′").bold().monospacedDigit()
                        }
                    }
                }
            }

            Section {
                ForEach(regels, id: \.index) { r in
                    HStack(alignment: .firstTextBaseline, spacing: 10) {
                        Text(mmss(r.t)).font(.subheadline).monospacedDigit().foregroundStyle(.secondary)
                            .frame(minWidth: 46, alignment: .leading)
                        Text(r.tekst)
                        Spacer(minLength: 4)
                        if bijwerken, r.type == .goal || r.type == .conceded {
                            Button { app.haalDoelpuntWeg(index, r.index) } label: { Image(systemName: "trash") }
                                .buttonStyle(.borderless)
                                .tint(.red)
                                .accessibilityLabel("Haal weg: \(r.tekst)")
                        }
                    }
                }
            } header: {
                Text("Verloop")
            } footer: {
                if bijwerken {
                    Text("Een doelpunt dat er niet was kun je weghalen; de stand telt vanzelf opnieuw. Wissels blijven staan, want daar hangt de speeltijd aan.")
                }
            }

            if bijwerken {
                Section("Doelpunt erbij") {
                    TextField("Minuut", text: $minuut).keyboardType(.numberPad)
                    Picker("Voor of tegen", selection: $tegen) {
                        Text("Voor \(ons)").tag(false)
                        Text("Tegen").tag(true)
                    }
                    .pickerStyle(.segmented)
                    if !tegen {
                        Picker("Wie scoorde", selection: $maker) {
                            Text("Weet ik niet").tag("")
                            ForEach(a.playingTime.filter { $0.seconds > 0 && $0.id != nil }, id: \.id) { r in
                                Text(naamNu(r)).tag(r.id ?? "")
                            }
                        }
                    }
                    Button("Voeg doelpunt toe") {
                        guard let m = Int(minuut) else { return }
                        app.doelpuntErbij(index, minuut: m, maker: maker.isEmpty ? nil : maker, tegen: tegen)
                        minuut = ""
                        maker = ""
                    }
                    .disabled(Int(minuut) == nil)
                }
            }

            Section("Hoe ging het") {
                TextField("Nog niets opgeschreven.", text: $notitie, axis: .vertical)
                    .lineLimit(2...8)
                    .onChange(of: notitie) { _, nieuw in
                        if nieuw != (a.note ?? "") { app.zetBewaardeNotitie(index, nieuw) }
                    }
            }

            Section {
                ShareLink(item: reportText(bronVanArchief(a), app.spelers, app.toestand.reportSubs)) {
                    Label("Deel het verslag", systemImage: "square.and.arrow.up")
                }
                if bijwerken {
                    Button(role: .destructive) { verwijderenVragen = true } label: {
                        Label("Verwijder deze wedstrijd", systemImage: "trash")
                    }
                }
            }
        }
        .toetsenbordWeg()
        .navigationTitle("\(shortDate(a.date)) · \(a.opponent)")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button(bijwerken ? "Klaar" : "Bijwerken") { withAnimation { bijwerken.toggle() } }
            }
        }
        .onAppear { notitie = a.note ?? "" }
        .confirmationDialog(
            "De wedstrijd tegen \(a.opponent) van \(shortDate(a.date)) verwijderen?", isPresented: $verwijderenVragen, titleVisibility: .visible
        ) {
            Button("Verwijderen", role: .destructive) {
                dismiss()
                app.verwijderBewaard(index)
            }
            Button("Terug", role: .cancel) {}
        } message: {
            Text("De speeltijd telt dan niet meer mee in het seizoen.")
        }
    }
}
