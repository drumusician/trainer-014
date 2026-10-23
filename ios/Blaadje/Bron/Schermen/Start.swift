import BlaadjeKern
import SwiftUI

/// Het beginscherm: de wedstrijd van vandaag, of een nieuwe beginnen.
struct Start: View {
    @Environment(AppModel.self) private var app
    @State private var nieuw = false
    @State private var stroom: WedstrijdStroom.Stap?
    @State private var opzetten = false
    @State private var linkPlakken = false
    @State private var volgTonen = false
    @Environment(Volgen.self) private var volgen
    /// De wedstrijd pas openen als het blad van 'nieuwe wedstrijd' echt weg is;
    /// twee dingen tegelijk tonen kan iOS niet, en dan gebeurt er niets.
    @State private var naNieuw = false

    private var titel: String { app.toestand.teamName.isEmpty ? "Blaadje" : app.toestand.teamName }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    // Zelf, en niet als grote titel van de balk: die kapt een lange teamnaam af.
                    Text(titel)
                        .font(.largeTitle.bold())
                        .lineLimit(2)
                        .minimumScaleFactor(0.6)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.top, 8)
                        .accessibilityAddTraits(.isHeader)
                    if app.spelers.isEmpty {
                        leegTeam
                        if volgen.kinderen.isEmpty { ouder }
                    } else if let w = app.match {
                        lopend(w)
                    } else if let p = vanVandaag {
                        // De wedstrijd van vandaag staat in het programma: die is het.
                        Button {
                            if let id = p.id, app.openWedstrijd(id) { stroom = p.lineup.opHetVeld.isEmpty ? .aanwezig : .opstelling }
                        } label: {
                            Label((p.home ? "Thuis" : "Uit") + " tegen \(p.opponent)", systemImage: "sportscourt")
                        }
                        .buttonStyle(HoofdKnop())
                        Button("Een andere wedstrijd") { nieuw = true }.font(.subheadline)
                    } else {
                        Button { nieuw = true } label: { Label("Nieuwe wedstrijd", systemImage: "plus") }
                            .buttonStyle(HoofdKnop())
                    }
                    if !app.spelers.isEmpty { ProgrammaBlok() }
                    if !app.toestand.archive.isEmpty { seizoen }
                    if !app.spelers.isEmpty, !volgen.kinderen.isEmpty {
                        Button { volgTonen = true } label: {
                            Label("Je volgt \(volgen.kinderen.compactMap { $0.pagina?.naam }.joined(separator: " en "))", systemImage: "bell")
                        }
                        .buttonStyle(TweedeKnop())
                    }
                }
                .padding(16)
            }
            .navigationTitle(titel)
            .toolbar(.hidden, for: .navigationBar)
            .background(Color(.systemGroupedBackground))
            .navigationDestination(for: String.self) { id in
                ProgrammaWedstrijd(id: id) { stroom = $0 }
            }
            .navigationDestination(for: WieDeedWat.self) { _ in WieDeedWatScherm() }
        }
        .sheet(isPresented: $nieuw, onDismiss: {
            if naNieuw { naNieuw = false; stroom = .aanwezig }
        }) {
            NieuweWedstrijd { naNieuw = true }
        }
        .sheet(isPresented: $opzetten) { Opzetten() }
        .sheet(isPresented: $linkPlakken) { LinkPlakken() }
        .sheet(isPresented: $volgTonen) { VolgScherm() }
        // Dicht en nog niet afgetrapt: een wedstrijd uit het programma gaat daar terug.
        .fullScreenCover(item: $stroom, onDismiss: { app.terugAlsNietBegonnen() }) { begin in
            WedstrijdStroom(begin: begin)
        }
    }

    /// Een wedstrijd uit het programma van vandaag, of van eerder die nog niet gespeeld is.
    private var vanVandaag: Match? {
        app.toestand.program.first { $0.date <= app.vandaag }
    }

    private var leegTeam: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Begin met je team").font(.title3.bold())
            Text("Voeg je spelers toe. Daarna kun je meteen een wedstrijd beginnen.")
                .foregroundStyle(.secondary)
            Button("Aan de slag") { opzetten = true }.buttonStyle(HoofdKnop())
        }
        .padding(16)
        .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 16))
    }

    /// Niet iedereen die de app opent is trainer.
    private var ouder: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Ben je ouder?").font(.title3.bold())
            Text("Tik op de link van de trainer, of plak hem hier.")
                .foregroundStyle(.secondary)
            Button("Ik heb een link") { linkPlakken = true }.buttonStyle(TweedeKnop())
        }
        .padding(16)
        .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 16))
    }

    private func lopend(_ w: Match) -> some View {
        let uitslag = homeFirst(app.stand, w.home)
        let ons = app.toestand.teamName
        return VStack(alignment: .leading, spacing: 12) {
            Text(w.finished ? "Afgelopen" : app.afgetrapt ? "Bezig" : "Klaar voor de aftrap")
                .font(.caption.bold()).kerning(1).textCase(.uppercase).foregroundStyle(Kleur.accent)
            Text(w.home ? "\(ons) – \(w.opponent)" : "\(w.opponent) – \(ons)").font(.title3.bold())
            if w.date > app.vandaag {
                Text(dateText(w.date) + (w.time.map { ", \($0)" } ?? "")).font(.subheadline).foregroundStyle(.secondary)
            }
            if app.afgetrapt {
                HStack(spacing: 14) {
                    Text("\(uitslag.voor) – \(uitslag.tegen)").font(.title.bold()).monospacedDigit()
                    if !w.finished {
                        Text("\(mmss(app.verstreken)) · \(w.inBreak ? breakName(w.part, w.parts) : partName(w.part, w.parts))")
                            .monospacedDigit().foregroundStyle(.secondary)
                    }
                }
            }
            Button(w.finished ? "Bekijk en bewaar" : app.afgetrapt ? "Verder met de wedstrijd" : "Verder") {
                stroom = WedstrijdStroom.stap(voor: w)
            }
            .buttonStyle(HoofdKnop())
            if !app.afgetrapt {
                Button(w.fromProgram == true ? "Terug naar het programma" : "Gooi weg", role: w.fromProgram == true ? nil : .destructive) {
                    app.gooiWedstrijdWeg()
                }
                    .font(.subheadline)
                    .frame(maxWidth: .infinity)
            }
        }
        .padding(16)
        .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 16))
    }

    private var seizoen: some View {
        let st = seizoenStand(app.toestand.archive)
        return VStack(alignment: .leading, spacing: 10) {
            Text("Dit seizoen").font(.headline)
            HStack {
                getal("\(st.wedstrijden)", "gespeeld")
                getal("\(st.gewonnen)", "winst")
                getal("\(st.gelijk)", "gelijk")
                getal("\(st.verloren)", "verlies")
                getal("\(st.voor)–\(st.tegen)", "doelpunten")
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 16))
    }

    private func getal(_ waarde: String, _ wat: String) -> some View {
        VStack(spacing: 2) {
            Text(waarde).font(.title3.bold()).monospacedDigit()
            Text(wat).font(.caption2).foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
    }
}

extension WedstrijdStroom.Stap: Identifiable {
    var id: Self { self }
}

/// Tegen wie, en thuis of uit. Meer hoeft de app niet te weten om te beginnen.
struct NieuweWedstrijd: View {
    @Environment(AppModel.self) private var app
    @Environment(\.dismiss) private var dismiss
    var begin: () -> Void

    @State private var tegenstander = ""
    @State private var thuis = true
    @FocusState private var typt: Bool

    var body: some View {
        NavigationStack {
            Form {
                Section("Tegen wie?") {
                    TextField("Tegenstander", text: $tegenstander)
                        .focused($typt)
                        .submitLabel(.go)
                        .onSubmit(start)
                    Picker("Waar", selection: $thuis) {
                        Text("Thuis").tag(true)
                        Text("Uit").tag(false)
                    }
                    .pickerStyle(.segmented)
                }
                Section {
                    LabeledContent("Formatie", value: app.toestand.formation)
                    LabeledContent("Speeltijd", value: "\(app.toestand.parts) × \(Int(app.toestand.minutesPerPart)) minuten")
                } footer: {
                    Text("Dit stel je in bij Team.")
                }
            }
            .navigationTitle("Nieuwe wedstrijd")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Annuleer") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) { Button("Begin", action: start).bold() }
            }
            .onAppear { typt = true }
        }
        .presentationDetents([.medium, .large])
    }

    private func start() {
        app.nieuweWedstrijd(tegenstander: tegenstander, thuis: thuis)
        begin()
        dismiss()
    }
}

/// De eerste keer: teamnaam, speelvorm en de namen.
struct Opzetten: View {
    @Environment(AppModel.self) private var app
    @Environment(\.dismiss) private var dismiss

    @State private var teamnaam = ""
    @State private var formatie = "4-3-3"
    @State private var namen = ""

    private var aantal: Int {
        namen.split(separator: "\n").filter { !$0.trimmingCharacters(in: .whitespaces).isEmpty }.count
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Je team") {
                    TextField("Bijvoorbeeld JO14-1", text: $teamnaam)
                }
                Section {
                    FormatieKiezer(formatie: $formatie)
                } header: {
                    Text("Hoe spelen jullie?")
                }
                Section {
                    TextField("Eén naam per regel", text: $namen, axis: .vertical)
                        .lineLimit(6...16)
                        .autocorrectionDisabled()
                        .textInputAutocapitalization(.words)
                } header: {
                    Text("Spelers")
                } footer: {
                    Text(aantal == 0
                        ? "Plak de lijst uit je groepsapp, of typ ze onder elkaar. Voornamen zijn genoeg."
                        : "\(aantal) \(aantal == 1 ? "speler" : "spelers"). Linies en wie kan keepen stel je daarna in bij Team.")
                }
            }
            .navigationTitle("Aan de slag")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Annuleer") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Klaar") {
                        app.zetTeamnaam(teamnaam)
                        app.kiesFormatie(formatie)
                        let delen = formatOf(formatie) == "11 tegen 11" ? 2 : 4
                        app.zetDelen(delen, minuten: app.toestand.minutesPerPart)
                        app.voegSpelersToe(namen)
                        dismiss()
                    }
                    .bold()
                    .disabled(aantal == 0)
                }
            }
            .onAppear { formatie = app.toestand.formation }
        }
    }
}

struct FormatieKiezer: View {
    @Binding var formatie: String

    var body: some View {
        Picker("Formatie", selection: $formatie) {
            ForEach(FORMATS, id: \.name) { vorm in
                Section(vorm.name + (vorm.uitleg.map { " · \($0)" } ?? "")) {
                    ForEach(vorm.formaties, id: \.sleutel) { f in
                        Text(f.sleutel + (f.uitleg.map { " · \($0)" } ?? "")).tag(f.sleutel)
                    }
                }
            }
        }
    }
}
