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
                    Text(w.tegenstander).font(.headline).lineLimit(1)
                    Text(w.thuis ? "Thuis" : "Uit").font(.caption).foregroundStyle(.secondary)
                    Text(stand(w)).font(.system(size: 40, weight: .bold)).monospacedDigit()
                }
                .padding(.vertical, 4)
                .accessibilityElement(children: .combine)
            }
            ForEach(komt) { w in
                // Tik erop voor wie wat regelt; hier alleen wat jullie doen, en wat nog open is.
                NavigationLink { VolgWedstrijd(code: kind.code, id: w.id) } label: {
                    VStack(alignment: .leading, spacing: 4) {
                        regel(w, wanneer: shortDate(w.datum) + (w.aanvang.map { ", \($0)" } ?? "")) { EmptyView() }
                        let mijn = w.taken.filter(\.vanMij).map { $0.woord.lowercased() }
                        let open = w.taken.filter { $0.wie == nil }.count
                        if !mijn.isEmpty {
                            Text("Jullie: " + mijn.joined(separator: ", ")).font(.caption.bold()).foregroundStyle(Kleur.accent)
                        }
                        if open > 0 {
                            Text(open == 1 ? "1 taak open" : "\(open) taken open").font(.caption).foregroundStyle(Kleur.oranje)
                        }
                    }
                    .padding(.vertical, 2)
                }
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
                    regel(w, wanneer: shortDate(w.datum)) {
                        // De thuisploeg eerst, zoals op het scorebord en in de meldingen. Gewonnen is groen.
                        let voor = w.voor ?? 0, tegen = w.tegen ?? 0
                        Text(stand(w)).bold().monospacedDigit()
                            .foregroundStyle(voor > tegen ? Kleur.accent : voor < tegen ? .secondary : .primary)
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

    /// "3 – 1", de thuisploeg eerst.
    private func stand(_ w: Volgen.Wedstrijd) -> String {
        let voor = w.voor ?? 0, tegen = w.tegen ?? 0
        return w.thuis ? "\(voor) – \(tegen)" : "\(tegen) – \(voor)"
    }

    /// De tegenstander, met daaronder thuis of uit en wanneer; rechts wat erbij hoort.
    private func regel(_ w: Volgen.Wedstrijd, wanneer: String, @ViewBuilder rechts: () -> some View) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 1) {
                Text(w.tegenstander).lineLimit(1)
                Text((w.thuis ? "Thuis" : "Uit") + " · " + wanneer).font(.caption).foregroundStyle(.secondary)
            }
            Spacer(minLength: 8)
            rechts()
        }
        .accessibilityElement(children: .combine)
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

/// "Limonade · Noah", met de knoppen die erbij horen.
struct TaakRegel: View {
    @Environment(Volgen.self) private var volgen
    let taak: Volgen.Taak
    let code: String
    /// Een kind gekozen? Alleen dan kun je een taak overnemen.
    let metKind: Bool

    var body: some View {
        HStack(spacing: 8) {
            Text(taak.woord).foregroundStyle(.secondary).frame(minWidth: 88, alignment: .leading)
            if taak.vanMij {
                Text("Jullie").bold().foregroundStyle(Kleur.accent)
            } else {
                Text(taak.wie ?? "open").foregroundStyle(taak.wie == nil ? Kleur.oranje : .primary)
            }
            Spacer(minLength: 4)
            if taak.vanMij {
                Button("Kan niet") { Task { await volgen.kanNiet(code, taak.id) } }
                    .buttonStyle(.bordered).controlSize(.small)
            } else if taak.wie == nil, metKind {
                Button("Ik doe het") { Task { await volgen.doeIk(code, taak.id) } }
                    .buttonStyle(.borderedProminent).controlSize(.small).tint(Kleur.groen)
            }
        }
        .accessibilityElement(children: .contain)
    }
}

/// Eén wedstrijd die komt, voor een ouder: wanneer, en wie wat regelt.
struct VolgWedstrijd: View {
    @Environment(Volgen.self) private var volgen
    let code: String
    let id: String

    var body: some View {
        let p = volgen.kinderen.first { $0.code == code }?.pagina
        if let p, let w = p.wedstrijden.first(where: { $0.id == id }) {
            List {
                Section {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(w.tegenstander).font(.title3.bold())
                        Text((w.thuis ? "Thuis" : "Uit") + " · " + dateText(w.datum) + (w.aanvang.map { ", \($0)" } ?? ""))
                            .foregroundStyle(.secondary)
                    }
                    .padding(.vertical, 4)
                }
                Section {
                    if w.taken.isEmpty {
                        Text("De trainer heeft nog niets verdeeld.").foregroundStyle(.secondary)
                    }
                    ForEach(w.taken) { TaakRegel(taak: $0, code: code, metKind: p.mijnKind != nil || p.kind != nil) }
                } header: {
                    Text("Wie regelt wat")
                } footer: {
                    if let melding = volgen.melding {
                        Text(melding)
                    } else if w.taken.contains(where: \.vanMij) {
                        Text("Kun je niet? Tik op Kan niet, dan vraagt de app het aan de andere ouders.")
                    }
                }
            }
            .navigationTitle(shortDate(w.datum))
            .navigationBarTitleDisplayMode(.inline)
            .refreshable { await volgen.ververs() }
        } else {
            ContentUnavailableView("Deze wedstrijd staat er niet meer", systemImage: "calendar")
        }
    }
}

