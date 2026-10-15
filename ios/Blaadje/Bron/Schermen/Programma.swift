import BlaadjeKern
import SwiftUI

/// De wedstrijden die komen, op het beginscherm. Een tik opent er een, met wie wat regelt.
struct ProgrammaBlok: View {
    @Environment(AppModel.self) private var app
    @State private var erbij = false

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("Programma").font(.headline)
                Spacer()
                Button { erbij = true } label: { Label("Wedstrijd in het programma", systemImage: "plus") }
                    .labelStyle(.iconOnly)
            }
            if app.toestand.program.isEmpty {
                Text("Zet de wedstrijden die komen erin, met wie de limonade doet en wie er rijdt. Ouders zien het in de app.")
                    .font(.subheadline).foregroundStyle(.secondary)
            }
            ForEach(app.toestand.program) { p in
                NavigationLink(value: p.id) {
                    HStack(alignment: .firstTextBaseline) {
                        Text(shortDate(p.date)).font(.subheadline.bold()).monospacedDigit().frame(minWidth: 52, alignment: .leading)
                        VStack(alignment: .leading, spacing: 2) {
                            Text((p.home ? "Thuis" : "Uit") + " tegen \(p.opponent)" + (p.time.map { ", \($0)" } ?? ""))
                            let tekst = TakenTekst.samenvatting(app.toestand, p.id, naam: { app.speler($0)?.name })
                            if !tekst.isEmpty {
                                Text(tekst).font(.caption).foregroundStyle(.secondary).lineLimit(2)
                            }
                        }
                        Spacer(minLength: 4)
                        Image(systemName: "chevron.right").font(.caption.bold()).foregroundStyle(.tertiary)
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("programma")
            }
            if !app.toestand.tasks.isEmpty {
                NavigationLink(value: WieDeedWat()) {
                    Label("Wie deed wat", systemImage: "list.bullet.clipboard").font(.subheadline)
                }
                .padding(.top, 2)
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 16))
        .sheet(isPresented: $erbij) { ProgrammaErbij() }
    }
}

enum TakenTekst {
    /// "Limonade Noah · Rijden Sem, nog 1 open · Bram kan niet"
    static func samenvatting(_ t: AppState, _ wedstrijd: String, naam: (String) -> String?) -> String {
        let taken = ProgramActions.taken(t, wedstrijd: wedstrijd)
        var delen: [String] = []
        for soort in TaskKind.allCases {
            let hier = taken.filter { $0.kind == soort }
            guard !hier.isEmpty else { continue }
            let wie = hier.compactMap { $0.club ? "vereniging" : $0.player.flatMap(naam) }
            let open = hier.filter(\.open).count
            var regel = ProgramActions.woord(soort)
            if !wie.isEmpty { regel += " " + wie.joined(separator: ", ") }
            if open > 0 { regel += wie.isEmpty ? " open" : ", nog \(open) open" }
            delen.append(regel)
        }
        let kanNiet = taken.compactMap { $0.open ? $0.declinedBy.flatMap(naam) : nil }
        if !kanNiet.isEmpty { delen.append(kanNiet.joined(separator: ", ") + " kan niet") }
        return delen.joined(separator: " · ")
    }
}

/// Een wedstrijd in het programma zetten: wanneer en tegen wie.
struct ProgrammaErbij: View {
    @Environment(AppModel.self) private var app
    @Environment(\.dismiss) private var dismiss
    @State private var datum = Date()
    @State private var metTijd = true
    @State private var tijd = Calendar.current.date(bySettingHour: 10, minute: 0, second: 0, of: Date()) ?? Date()
    @State private var tegenstander = ""
    @State private var thuis = true
    @FocusState private var typt: Bool

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Tegenstander", text: $tegenstander).focused($typt)
                    Picker("Waar", selection: $thuis) {
                        Text("Thuis").tag(true)
                        Text("Uit").tag(false)
                    }
                    .pickerStyle(.segmented)
                }
                Section {
                    DatePicker("Datum", selection: $datum, displayedComponents: .date)
                    Toggle("Aanvang bekend", isOn: $metTijd)
                    if metTijd {
                        DatePicker("Aanvang", selection: $tijd, displayedComponents: .hourAndMinute)
                    }
                }
            }
            .navigationTitle("Wedstrijd erbij")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Annuleer") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Zet erin") {
                        app.programmaErbij(datum: datum, tijd: metTijd ? tijd : nil, tegenstander: tegenstander, thuis: thuis)
                        dismiss()
                    }
                    .bold()
                }
            }
            .onAppear { typt = true }
        }
        .presentationDetents([.medium, .large])
    }
}

/// Eén wedstrijd uit het programma: bijwerken, wie wat regelt, en op de dag zelf beginnen.
struct ProgrammaWedstrijd: View {
    @Environment(AppModel.self) private var app
    @Environment(\.dismiss) private var dismiss
    let id: String
    /// Na "Begin deze wedstrijd": het beginscherm opent de wedstrijd.
    var begin: () -> Void = {}

    var body: some View {
        if let p = app.toestand.program.first(where: { $0.id == id }) {
            Form {
                Section {
                    TextField(
                        "Tegenstander",
                        text: Binding(get: { p.opponent }, set: { app.wijzigProgramma(id, tegenstander: $0) }))
                    Picker("Waar", selection: Binding(get: { p.home }, set: { app.wijzigProgramma(id, thuis: $0) })) {
                        Text("Thuis").tag(true)
                        Text("Uit").tag(false)
                    }
                    .pickerStyle(.segmented)
                    DatePicker(
                        "Datum",
                        selection: Binding(get: { AppModel.datum(p.date) ?? Date() }, set: { app.wijzigProgramma(id, datum: $0) }),
                        displayedComponents: .date)
                    Toggle(
                        "Aanvang bekend",
                        isOn: Binding(
                            get: { p.time != nil },
                            set: { aan in
                                app.wijzigProgramma(id, tijd: .some(aan ? Calendar.current.date(bySettingHour: 10, minute: 0, second: 0, of: Date()) : nil))
                            }))
                    if let t = p.time {
                        DatePicker(
                            "Aanvang",
                            selection: Binding(get: { AppModel.tijd(t) ?? Date() }, set: { app.wijzigProgramma(id, tijd: .some($0)) }),
                            displayedComponents: .hourAndMinute)
                    }
                }

                Section {
                    ForEach(TaskKind.allCases.filter { $0 != .rijden }, id: \.self) { soort in
                        Picker(ProgramActions.woord(soort), selection: Binding(
                            get: {
                                let taak = ProgramActions.taken(app.toestand, wedstrijd: id).first { $0.kind == soort }
                                return taak?.club == true ? ProgramActions.vereniging : taak?.player ?? ""
                            },
                            set: { app.zetTaak(id, soort, speler: $0.isEmpty ? nil : $0) }
                        )) {
                            Text(open(soort) ? "Open" : "Niemand").tag("")
                            if soort == .fluiten { Text("Vereniging").tag(ProgramActions.vereniging) }
                            ForEach(app.spelers) { Text($0.name).tag($0.id) }
                        }
                    }
                    ForEach(ProgramActions.taken(app.toestand, wedstrijd: id).filter { $0.kind == .rijden }) { taak in
                        Picker("Rijden", selection: Binding(
                            get: { taak.player ?? "" },
                            set: { app.wijsTaak(taak.id, speler: $0.isEmpty ? nil : $0) }
                        )) {
                            Text("Open").tag("")
                            ForEach(app.spelers) { Text($0.name).tag($0.id) }
                        }
                        .swipeActions { Button("Haal weg", role: .destructive) { app.haalTaakWeg(taak.id) } }
                    }
                    Button { app.rijderErbij(id) } label: { Label("Rijder erbij", systemImage: "car") }
                } header: {
                    Text("Wie regelt wat")
                } footer: {
                    Text(voetnoot)
                }

                Section {
                    if p.date <= app.vandaag, app.match == nil {
                        Button {
                            if app.beginUitProgramma(id) {
                                dismiss()
                                begin()
                            }
                        } label: {
                            Label("Begin deze wedstrijd", systemImage: "sportscourt")
                        }
                    }
                    Button("Haal uit het programma", role: .destructive) {
                        app.haalUitProgramma(id)
                        dismiss()
                    }
                }
            }
            .navigationTitle(shortDate(p.date) + " · " + p.opponent)
            .navigationBarTitleDisplayMode(.inline)
        } else {
            ContentUnavailableView("Deze wedstrijd staat niet meer in het programma", systemImage: "calendar")
        }
    }

    /// Open: een familie kon niet, en er is nog niemand anders.
    private func open(_ soort: TaskKind) -> Bool {
        ProgramActions.taken(app.toestand, wedstrijd: id).contains { $0.kind == soort && $0.open }
    }

    private var voetnoot: String {
        let kanNiet = ProgramActions.taken(app.toestand, wedstrijd: id)
            .compactMap { t in t.open ? t.declinedBy.flatMap { app.speler($0)?.name }.map { "\($0) kan niet (\(ProgramActions.woord(t.kind).lowercased()))" } : nil }
        let basis = "Ouders zien dit in de app en krijgen de avond ervoor een herinnering. Wie de limonade doet, krijgt er vlak voor de rust nog een."
        return kanNiet.isEmpty ? basis : kanNiet.joined(separator: ", ") + ". " + basis
    }
}

/// Naar het overzicht van wie welke taak had.
struct WieDeedWat: Hashable {}

/// Per taak: wie hem had en wie hij nog heeft, en hoe vaak elke familie aan de
/// beurt was. Minst vaak bovenaan: die is de volgende.
struct WieDeedWatScherm: View {
    @Environment(AppModel.self) private var app
    @State private var soort: TaskKind = .fluiten

    var body: some View {
        let beurten = ProgramActions.beurten(app.toestand, soort)
        List {
            Section {
                Picker("Taak", selection: $soort) {
                    ForEach(TaskKind.allCases, id: \.self) { Text(ProgramActions.woord($0)).tag($0) }
                }
            }
            Section {
                ForEach(ProgramActions.telling(app.toestand, soort), id: \.speler.id) { regel in
                    LabeledContent(regel.speler.name) {
                        Text(regel.keer == 0 ? "nog niet" : "\(regel.keer)×").monospacedDigit()
                    }
                }
            } header: {
                Text("Hoe vaak")
            } footer: {
                Text("Wat al gespeeld is en wat nog in het programma staat, samen.")
            }
            if !beurten.isEmpty {
                Section("Wanneer") {
                    ForEach(Array(beurten.enumerated()), id: \.offset) { _, b in
                        HStack(alignment: .firstTextBaseline) {
                            Text(shortDate(b.datum)).monospacedDigit().frame(minWidth: 52, alignment: .leading)
                            Text(b.tegenstander).foregroundStyle(b.geweest ? .secondary : .primary)
                            Spacer()
                            Text(b.club ? "Vereniging" : b.speler.flatMap { app.speler($0)?.name } ?? "?")
                        }
                        .font(.subheadline)
                    }
                }
            }
        }
        .navigationTitle("Wie deed wat")
        .navigationBarTitleDisplayMode(.inline)
    }
}
