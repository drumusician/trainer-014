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
                    Button { toevoegen = true } label: { Label("Nog een team volgen", systemImage: "plus") }
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
        if !p.aan {
            Section {
                Text("Zodra de trainer het team aanzet, zie je hier de wedstrijden en wie wat regelt.")
                    .foregroundStyle(.secondary)
            } header: {
                Text(p.team)
            }
        }
        if p.kindKiezen {
            Section {
                ForEach(p.spelers) { s in
                    Button(s.naam) { Task { await volgen.kiesKind(kind.code, s.id) } }
                }
            } header: {
                Text("Wie is je kind?")
            } footer: {
                Text("Dan zie je wat jullie regelen, en krijg je een herinnering.")
            }
        }
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
                VStack(alignment: .leading, spacing: 6) {
                    LabeledContent(wie(w, p.team), value: shortDate(w.datum) + (w.aanvang.map { ", \($0)" } ?? ""))
                    ForEach(w.taken) { taak in taakRegel(taak, kind: kind, p)
                    }
                }
                .padding(.vertical, 2)
            }
            if nu.isEmpty, komt.isEmpty {
                Text("Nog geen wedstrijden.").foregroundStyle(.secondary)
            }
        } header: {
            HStack {
                Text((p.kind ?? p.mijnKind?.naam).map { "\($0) · \(p.team)" } ?? p.team)
                Spacer()
                if p.kind == nil, p.mijnKind != nil, !p.spelers.isEmpty {
                    Menu("Ander kind") {
                        ForEach(p.spelers) { s in
                            Button(s.naam) { Task { await volgen.kiesKind(kind.code, s.id) } }
                        }
                    }
                    .font(.caption)
                    .textCase(nil)
                }
            }
        } footer: {
            Text(volgen.melding ?? "Je krijgt een melding bij de aftrap, elk doelpunt, de rust en het einde. En de avond ervoor als jullie iets regelen.")
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
            // De trainingen zijn per kind; met de link van het team staan ze er niet.
            if let kind = p.kind {
                if p.trainingen.isEmpty {
                    Text("Nog geen trainingen.").foregroundStyle(.secondary)
                } else if gemist.isEmpty {
                    Text("\(kind) was er elke keer.")
                }
                ForEach(gemist.reversed()) { t in
                    LabeledContent(dateText(t.datum), value: t.status == "afgemeld" ? "afgemeld" : "niet gekomen")
                }
            }
            Button("Stop met volgen van \(p.naam)", role: .destructive) { Task { await volgen.stop(kind) } }
        } header: {
            if p.kind != nil { Text("Trainingen: \(p.trainingen.count - gemist.count) van de \(p.trainingen.count) geweest") }
        }
    }

    /// "Limonade · Noah", met de knoppen die erbij horen.
    private func taakRegel(_ taak: Volgen.Taak, kind: Volgen.Kind, _ p: Volgen.Pagina) -> some View {
        HStack(spacing: 8) {
            Text(taak.woord).font(.subheadline).foregroundStyle(.secondary).frame(minWidth: 72, alignment: .leading)
            if taak.vanMij {
                Text("Jullie").font(.subheadline.bold()).foregroundStyle(Kleur.accent)
            } else {
                Text(taak.wie ?? "open").font(.subheadline).foregroundStyle(taak.wie == nil ? Kleur.oranje : .primary)
            }
            Spacer(minLength: 4)
            if taak.vanMij {
                Button("Kan niet") { Task { await volgen.kanNiet(kind.code, taak.id) } }
                    .buttonStyle(.bordered).controlSize(.small)
            } else if taak.wie == nil, p.mijnKind != nil {
                Button("Ik doe het") { Task { await volgen.doeIk(kind.code, taak.id) } }
                    .buttonStyle(.borderedProminent).controlSize(.small).tint(Kleur.groen)
            }
        }
        .accessibilityElement(children: .contain)
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
                    Text(volgen.melding ?? "Plak de link die je van de trainer kreeg.")
                }
            }
            .navigationTitle("Een team volgen")
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
