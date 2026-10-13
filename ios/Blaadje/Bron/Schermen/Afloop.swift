import BlaadjeKern
import SwiftUI

/// Na het laatste fluitsignaal: wie speelde hoe lang, en bewaren.
struct Afloop: View {
    @Environment(AppModel.self) private var app
    var klaar: () -> Void

    @State private var notitie = ""
    @State private var weggooienVragen = false

    var body: some View {
        if let w = app.match {
            let uitslag = homeFirst(app.stand, w.home)
            let tijden = app.speeltijden
            let keepers = app.keepertijden
            let afwezig = Set(w.absent ?? [])
            let rijen = app.spelers.filter { !afwezig.contains($0.id) }
                .sorted { tijden[$0.id, default: 0] > tijden[$1.id, default: 0] }
            List {
                Section {
                    VStack(spacing: 4) {
                        Text(w.home ? "\(app.toestand.teamName) – \(w.opponent)" : "\(w.opponent) – \(app.toestand.teamName)")
                            .font(.subheadline).foregroundStyle(.secondary)
                        Text("\(uitslag.voor) – \(uitslag.tegen)").font(.system(size: 52, weight: .bold)).monospacedDigit()
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 6)
                }
                Section("Speeltijd") {
                    ForEach(rijen) { p in
                        let k = Int((keepers[p.id, default: 0] / 60).rounded())
                        HStack {
                            Text(p.name)
                            if k > 0 { Text("waarvan \(k)′ keeper").font(.footnote).foregroundStyle(.secondary) }
                            Spacer()
                            Text("\(Int((tijden[p.id, default: 0] / 60).rounded()))′").bold().monospacedDigit()
                        }
                    }
                }
                if !afwezig.isEmpty {
                    Section("Er niet bij") {
                        Text(app.spelers.filter { afwezig.contains($0.id) }.map(\.name).joined(separator: ", "))
                            .foregroundStyle(.secondary)
                    }
                }
                Section("Hoe ging het?") {
                    TextField("Voor jezelf, in je eigen woorden", text: $notitie, axis: .vertical)
                        .lineLimit(3...8)
                        .onChange(of: notitie) { _, nieuw in app.zetNotitie(nieuw) }
                }
                Section {
                    ShareLink(item: reportText(bronVanWedstrijd(w, app.toestand.teamName), app.spelers, app.toestand.reportSubs)) {
                        Label("Deel het verslag", systemImage: "square.and.arrow.up")
                    }
                    Button(role: .destructive) { weggooienVragen = true } label: {
                        Label("Niet bewaren", systemImage: "trash")
                    }
                }
            }
            .toetsenbordWeg()
            .safeAreaInset(edge: .bottom) {
                Button("Bewaar in het archief") {
                    if app.bewaarInArchief() { Tik.gelukt() }
                    klaar()
                }
                .buttonStyle(HoofdKnop())
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .background(.bar)
            }
            .onAppear { notitie = w.note ?? "" }
            .confirmationDialog("Deze wedstrijd weggooien?", isPresented: $weggooienVragen, titleVisibility: .visible) {
                Button("Weggooien", role: .destructive) {
                    app.gooiWedstrijdWeg()
                    klaar()
                }
                Button("Terug", role: .cancel) {}
            } message: {
                Text("De speeltijd van vandaag telt dan niet mee in het seizoen.")
            }
        }
    }
}
