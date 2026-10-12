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
                        ForEach(Array(app.toestand.archive.enumerated()), id: \.offset) { _, a in
                            let u = homeFirst(a.score, a.home)
                            let ons = a.teamName ?? app.toestand.teamName
                            NavigationLink {
                                Bewaard(wedstrijd: a)
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

private struct Bewaard: View {
    @Environment(AppModel.self) private var app
    let wedstrijd: ArchivedMatch

    var body: some View {
        let u = homeFirst(wedstrijd.score, wedstrijd.home)
        List {
            Section {
                VStack(spacing: 4) {
                    Text(dateText(wedstrijd.date)).font(.subheadline).foregroundStyle(.secondary)
                    Text("\(u.voor) – \(u.tegen)").font(.system(size: 44, weight: .bold)).monospacedDigit()
                }
                .frame(maxWidth: .infinity)
            }
            Section("Speeltijd") {
                ForEach(wedstrijd.playingTime.sorted { $0.seconds > $1.seconds }, id: \.name) { r in
                    HStack {
                        Text(r.name)
                        if let k = r.keeper, k > 0 {
                            Text("waarvan \(Int((k / 60).rounded()))′ keeper").font(.footnote).foregroundStyle(.secondary)
                        }
                        Spacer()
                        Text("\(Int((r.seconds / 60).rounded()))′").bold().monospacedDigit()
                    }
                }
            }
            if let n = wedstrijd.note, !n.isEmpty {
                Section("Notitie") { Text(n) }
            }
            Section {
                ShareLink(item: reportText(bronVanArchief(wedstrijd), app.spelers, app.toestand.reportSubs)) {
                    Label("Deel het verslag", systemImage: "square.and.arrow.up")
                }
            }
        }
        .navigationTitle(wedstrijd.opponent)
        .navigationBarTitleDisplayMode(.inline)
    }
}
