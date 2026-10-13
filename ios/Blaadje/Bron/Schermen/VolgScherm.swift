import BlaadjeKern
import SwiftUI

/// Voor wie een kind volgt: de wedstrijd van nu, wat er komt, en de trainingen.
struct VolgScherm: View {
    @Environment(Volgen.self) private var volgen
    @State private var toevoegen = false

    var body: some View {
        NavigationStack {
            List {
                ForEach(volgen.kinderen) { kind in
                    if let p = kind.pagina {
                        deel(kind, p)
                    } else {
                        Section { ProgressView() }
                    }
                }
            }
            .navigationTitle("Volgen")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button { toevoegen = true } label: { Label("Nog een kind volgen", systemImage: "plus") }
                }
            }
            .refreshable { await volgen.ververs() }
            .task { await volgen.ververs() }
            .sheet(isPresented: $toevoegen) { LinkPlakken() }
        }
    }

    @ViewBuilder
    private func deel(_ kind: Volgen.Kind, _ p: Volgen.Pagina) -> some View {
        let nu = p.wedstrijden.filter { $0.status == "bezig" }
        let komt = p.wedstrijden.filter { $0.status == "gepland" }
        let gespeeld = p.wedstrijden.filter { $0.status == "afgelopen" }.reversed()
        let gemist = p.trainingen.filter { $0.status == "afgemeld" || $0.status == "afwezig" }
        Section {
            ForEach(nu) { w in
                VStack(alignment: .leading, spacing: 4) {
                    Text("NU BEZIG").font(.caption.bold()).kerning(1).foregroundStyle(Kleur.oranje)
                    Text(wie(w, p.team)).font(.headline)
                    Text("\(w.thuis ? w.voor ?? 0 : w.tegen ?? 0) – \(w.thuis ? w.tegen ?? 0 : w.voor ?? 0)")
                        .font(.system(size: 40, weight: .bold)).monospacedDigit()
                }
                .padding(.vertical, 4)
                .accessibilityElement(children: .combine)
            }
            ForEach(komt) { w in
                LabeledContent(wie(w, p.team), value: shortDate(w.datum))
            }
            if nu.isEmpty, komt.isEmpty {
                Text("Er staat nog geen wedstrijd klaar.").foregroundStyle(.secondary)
            }
        } header: {
            Text("\(p.kind) · \(p.team)")
        } footer: {
            Text("Je krijgt een melding bij de aftrap, een doelpunt, de rust en het eindsignaal.")
        }
        if !gespeeld.isEmpty {
            Section("Gespeeld") {
                ForEach(Array(gespeeld)) { w in
                    LabeledContent(wie(w, p.team)) {
                        Text("\(w.thuis ? w.voor ?? 0 : w.tegen ?? 0) – \(w.thuis ? w.tegen ?? 0 : w.voor ?? 0)").bold().monospacedDigit()
                    }
                }
            }
        }
        Section {
            if p.trainingen.isEmpty {
                Text("De trainer heeft nog geen trainingen bijgehouden.").foregroundStyle(.secondary)
            } else if gemist.isEmpty {
                Text("\(p.kind) was er elke keer.")
            }
            ForEach(gemist.reversed()) { t in
                LabeledContent(dateText(t.datum), value: t.status == "afgemeld" ? "afgemeld" : "niet gekomen")
            }
            Button("Stop met volgen van \(p.kind)", role: .destructive) { Task { await volgen.stop(kind) } }
        } header: {
            Text("Trainingen: \(p.trainingen.count - gemist.count) van de \(p.trainingen.count) geweest")
        }
    }

    private func wie(_ w: Volgen.Wedstrijd, _ team: String) -> String {
        w.thuis ? "\(team) – \(w.tegenstander)" : "\(w.tegenstander) – \(team)"
    }
}

/// De link van de trainer plakken. Wie hem aantikt in een bericht komt hier niet eens.
struct LinkPlakken: View {
    @Environment(Volgen.self) private var volgen
    @Environment(\.dismiss) private var dismiss
    @State private var link = ""

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Plak hier de link", text: $link, axis: .vertical)
                        .lineLimit(1...4)
                        .autocorrectionDisabled()
                        .textInputAutocapitalization(.never)
                    PasteButton(payloadType: String.self) { tekst in
                        Task { @MainActor in link = tekst.first ?? "" }
                    }
                } footer: {
                    Text(volgen.melding ?? "De trainer stuurt je een eigen link voor je kind. Daarmee volg je de wedstrijden; een account heb je niet nodig.")
                }
            }
            .navigationTitle("Een kind volgen")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Annuleer") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Volg") {
                        Task { if await volgen.voegToe(link) { dismiss() } }
                    }
                    .bold()
                    .disabled(link.isEmpty || volgen.bezig)
                }
            }
        }
        .presentationDetents([.medium])
    }
}
