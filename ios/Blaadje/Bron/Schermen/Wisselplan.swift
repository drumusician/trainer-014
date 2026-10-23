import BlaadjeKern
import SwiftUI

/// Wat je vooraf al weet: wie rond welk moment erin komt, en voor wie. Een
/// spiekbriefje, geen wekker; het moment kies je langs de lijn zelf.
struct Wisselplan: View {
    @Environment(AppModel.self) private var app
    @Environment(\.dismiss) private var dismiss

    /// In de pauze na dit deel; 0 is op een eigen minuut.
    @State private var naDeel = 1
    @State private var minuut = 20
    @State private var ruil = false
    @State private var eruit = ""
    @State private var erin = ""
    /// In het rooster aangetikt: in welk blok, en wie.
    @State private var gekozen: (blok: Int, id: String)?

    var body: some View {
        NavigationStack {
            Group {
                if let w = app.match, !w.finished {
                    inhoud(w)
                } else {
                    ContentUnavailableView("Er is geen wedstrijd om een plan voor te maken", systemImage: "list.bullet.clipboard")
                }
            }
            .navigationTitle("Wisselplan")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) { Button("Klaar") { dismiss() }.bold() }
            }
        }
    }

    private func naam(_ id: String) -> String { app.speler(id)?.name ?? "?" }

    private func opMinuut(_ w: Match) -> Int {
        naDeel > 0 ? naDeel * Int(app.toestand.minutesPerPart) : minuut
    }

    /// Niet iedereen, maar wie er rond dat moment kan: met wat al gepland staat
    /// erbij, zodat na "Casper voor Maher" Maher in een volgende stap op de bank zit.
    private func inHetVeld(_ w: Match) -> [Stand.Plek] {
        standOp(w, opMinuut(w)).veld.sorted { naam($0.id).localizedCompare(naam($1.id)) == .orderedAscending }
    }

    /// Wie in dezelfde linie speelt als wie eruit gaat, bovenaan.
    private func opDeBank(_ w: Match) -> [String] {
        let linie = app.speler(eruit).map(groupOf)
        func zelfde(_ id: String) -> Bool { linie != nil && app.speler(id).map(groupOf) == linie }
        return standOp(w, opMinuut(w)).bank.sorted { a, b in
            if zelfde(a) != zelfde(b) { return zelfde(a) }
            return naam(a).localizedCompare(naam(b)) == .orderedAscending
        }
    }

    private func inhoud(_ w: Match) -> some View {
        let stappen = planStappen(w, nu: app.nu)
        let veld = inHetVeld(w)
        let bank = opDeBank(w)
        let kan = !eruit.isEmpty && !erin.isEmpty && eruit != erin
        return Form {
            Section {
                roosterView(w)
            } footer: {
                let r = rooster(w, app.spelers, minutesPerPart: app.toestand.minutesPerPart, nu: app.nu)
                Text("Tik in een kolom op wie eruit gaat en wie erin komt. Eerlijk verdeeld is ongeveer \(r.eerlijk)′ per speler.")
            }

            Section("De wissels") {
                if stappen.isEmpty {
                    Text("Nog niets gepland.").foregroundStyle(.secondary)
                }
                ForEach(stappen, id: \.stap.id) { s in
                    stapRegel(s, w)
                }
            }

            Section {
                Picker("Wanneer", selection: $naDeel) {
                    ForEach(1..<max(w.parts, 2), id: \.self) { Text(momentName($0, w.parts)).tag($0) }
                    Text("Op een minuut").tag(0)
                }
                if naDeel == 0 {
                    Stepper("Rond minuut \(minuut)", value: $minuut, in: 5...max(5, w.parts * Int(app.toestand.minutesPerPart)), step: 5)
                }
                Picker("Wat", selection: $ruil) {
                    Text("Wissel").tag(false)
                    Text("Van plek ruilen").tag(true)
                }
                .pickerStyle(.segmented)
                Picker(ruil ? "Ruilt" : "Eruit", selection: $eruit) {
                    Text("Kies").tag("")
                    ForEach(veld, id: \.id) { r in Text("\(naam(r.id)) (\(positionLabel(r.plek, w.formation)))").tag(r.id) }
                }
                Picker(ruil ? "Met" : "Erin", selection: $erin) {
                    Text("Kies").tag("")
                    if ruil {
                        ForEach(veld.filter { $0.id != eruit }, id: \.id) { r in
                            Text("\(naam(r.id)) (\(positionLabel(r.plek, w.formation)))").tag(r.id)
                        }
                    } else {
                        ForEach(bank, id: \.self) { Text(naam($0)).tag($0) }
                    }
                }
                Button("Zet in het plan") {
                    app.planVoegToe(minuut: opMinuut(w), erin: erin, eruit: eruit, naDeel: naDeel > 0 ? naDeel : nil, ruil: ruil)
                    eruit = ""
                    erin = ""
                    Tik.licht()
                }
                .disabled(!kan)
            } header: {
                Text("Op een eigen minuut, of van plek ruilen")
            } footer: {
                Text("De volgende wissel staat tijdens de wedstrijd onder het veld.")
            }
        }
        // Ander moment, andere stand: een keuze die dan niet meer kan, valt weg.
        .onChange(of: [String(naDeel), String(minuut), String(ruil), eruit]) { _, _ in
            let veld = inHetVeld(w)
            if !eruit.isEmpty, !veld.contains(where: { $0.id == eruit }) { eruit = "" }
            let keuzes = ruil ? veld.map(\.id).filter { $0 != eruit } : opDeBank(w)
            if !erin.isEmpty, !keuzes.contains(erin) { erin = "" }
        }
    }

    /// Per speler een regel, per blok een kolom: wie wanneer speelt, en hoeveel.
    private func roosterView(_ w: Match) -> some View {
        let r = rooster(w, app.spelers, minutesPerPart: app.toestand.minutesPerPart, nu: app.nu)
        return Grid(horizontalSpacing: 4, verticalSpacing: 4) {
            GridRow {
                Text("")
                ForEach(r.blokken.indices, id: \.self) { i in
                    Text(kop(r.blokken[i], w)).font(.caption2.bold()).foregroundStyle(.secondary).lineLimit(1)
                }
                Text("min").font(.caption2.bold()).foregroundStyle(.secondary)
            }
            ForEach(r.regels) { regel in
                GridRow {
                    Text(naam(regel.id)).font(.subheadline).lineLimit(1).frame(maxWidth: .infinity, alignment: .leading)
                    ForEach(r.blokken.indices, id: \.self) { i in
                        vakje(regel, i, r.blokken[i], w)
                    }
                    Text("\(regel.minuten)′")
                        .font(.subheadline.weight(regel.weinig ? .bold : .regular)).monospacedDigit()
                        .foregroundStyle(regel.weinig ? Kleur.oranje : .primary)
                        .frame(minWidth: 34, alignment: .trailing)
                        .accessibilityLabel("\(naam(regel.id)) \(regel.minuten) minuten" + (regel.weinig ? ", weinig" : ""))
                }
            }
        }
        .padding(.vertical, 4)
    }

    private func kop(_ b: Blok, _ w: Match) -> String {
        if b.start == 0 { return "Begin" }
        if b.naDeel != nil, w.parts == 2 { return "Rust" }
        return "\(b.start)′"
    }

    private func vakje(_ regel: RoosterRegel, _ i: Int, _ blok: Blok, _ w: Match) -> some View {
        let plek = regel.plekken[i]
        let aan = gekozen?.blok == i && gekozen?.id == regel.id
        return Button {
            tikInRooster(i, blok, regel.id)
        } label: {
            Text(plek.map { positionLabel($0, w.formation) } ?? "")
                .font(.caption.bold())
                .foregroundStyle(.white)
                .frame(width: 40, height: 28)
                .background(plek == nil ? Color(.tertiarySystemFill) : Kleur.gras, in: RoundedRectangle(cornerRadius: 6))
                .overlay(RoundedRectangle(cornerRadius: 6).stroke(Kleur.accent, lineWidth: aan ? 3 : 0))
                // Het begin is de opstelling; vaag is alleen wat al gespeeld wordt.
                .opacity(blok.teVeranderen || !ClockActions.kickedOff(w) ? 1 : 0.6)
        }
        .buttonStyle(.plain)
        .disabled(!blok.teVeranderen)
        .accessibilityLabel("\(naam(regel.id)), \(kop(blok, w)): " + (plek == nil ? "bank" : "speelt"))
    }

    private func tikInRooster(_ i: Int, _ blok: Blok, _ id: String) {
        guard let eerst = gekozen, eerst.blok == i, eerst.id != id else {
            gekozen = gekozen?.blok == i && gekozen?.id == id ? nil : (i, id)
            return
        }
        if app.planRooster(blok, eerst.id, id) {
            gekozen = nil
            Tik.licht()
        } else {
            gekozen = (i, id)
        }
    }

    @ViewBuilder
    private func stapRegel(_ s: PlanStap, _ w: Match) -> some View {
        // Vervallen op zijn eigen moment, met de stappen ervoor meegerekend: niet
        // op hoe het nu staat, anders is de tweede helft van een keeperwissel
        // vooraf al 'vervallen'.
        let reden = s.status == .open ? kanNietOpMoment(w, s.stap) : nil
        let kaal = s.status != .open || reden != nil
        let stand = standOp(w, s.stap.minuut, voorStap: s.stap.id).veld
        let tekst = stapTekst(s.stap, naam: naam) { id in
            kaal ? nil : stand.first { $0.id == id }.map { positionLabel($0.plek, w.formation) }
        }
        HStack(alignment: .firstTextBaseline, spacing: 10) {
            Text(wanneer(s.stap, w.parts)).font(.subheadline.bold()).monospacedDigit().frame(minWidth: 44, alignment: .leading)
            VStack(alignment: .leading, spacing: 1) {
                Text(tekst)
                if s.status == .gedaan {
                    Text("gedaan").font(.caption).foregroundStyle(.secondary)
                } else if s.status == .overgeslagen {
                    Text("overgeslagen").font(.caption).foregroundStyle(.secondary)
                } else if let reden {
                    Text("vervallen: \(redenTekst(reden, s.stap, naam: naam))").font(.caption).foregroundStyle(.secondary)
                }
            }
            Spacer(minLength: 4)
            if s.status == .overgeslagen {
                Button("Toch doen") { app.planSlaOver(s.stap.id, false) }.buttonStyle(.borderless)
            } else if s.status == .open {
                Button { app.planHaalWeg(s.stap.id) } label: { Image(systemName: "trash") }
                    .buttonStyle(.borderless)
                    .accessibilityLabel("Haal weg: \(tekst)")
            }
        }
        .opacity(kaal ? 0.55 : 1)
    }
}

/// Wie zat er al veel op de bank. Op gevoel doorwisselen gaat goed tot dezelfde
/// twee drie weken achter elkaar op de bank beginnen.
struct Bankoverzicht: View {
    @Environment(AppModel.self) private var app
    @Environment(\.dismiss) private var dismiss
    /// Wie er nu op de bank staat in de opstelling die je aan het maken bent.
    let nuOpDeBank: Set<String>
    /// Wie vandaag is afgemeld hoort er niet in: die kun je toch niet opstellen.
    let afwezig: Set<String>

    var body: some View {
        let rijen = benchOverview(app.spelers, app.toestand.archive, app.toestand.trainings).filter { !afwezig.contains($0.id) }
        let meeste = max(1, rijen.map(\.benchSeconds).max() ?? 1)
        NavigationStack {
            List {
                Section {
                    ForEach(rijen) { r in
                        let nu = nuOpDeBank.contains(r.id)
                        let weer = nu && r.startedOnBench > 0
                        VStack(alignment: .leading, spacing: 5) {
                            HStack(alignment: .firstTextBaseline) {
                                Text(r.name).font(.body.weight(.semibold))
                                if nu {
                                    Text(weer ? "nu wéér op de bank" : "nu op de bank")
                                        .font(.caption.bold()).foregroundStyle(weer ? Kleur.oranje : .secondary)
                                }
                                Spacer()
                                Text("\(Int((r.benchSeconds / 60).rounded()))′ bank").font(.subheadline.bold()).monospacedDigit()
                            }
                            GeometryReader { geo in
                                Capsule().fill(Color(.tertiarySystemFill))
                                Capsule().fill(Kleur.gras).frame(width: geo.size.width * r.benchSeconds / meeste)
                            }
                            .frame(height: 6)
                            Text(begon(r) + " · " + (r.attendance.totaal > 0 ? "training \(r.attendance.er)/\(r.attendance.totaal)" : "geen training"))
                                .font(.caption).foregroundStyle(.secondary)
                        }
                        .padding(.vertical, 2)
                    }
                } footer: {
                    let w = app.toestand.archive.count, t = app.toestand.trainings.count
                    Text(w == 0
                        ? "Dit zie je na de eerste wedstrijd."
                        : "Wie het langst op de bank zat, staat bovenaan. Over \(w) \(w == 1 ? "bewaarde wedstrijd" : "bewaarde wedstrijden") en \(t) \(t == 1 ? "training" : "trainingen").")
                }
            }
            .navigationTitle("Wie zat op de bank")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) { Button("Klaar") { dismiss() }.bold() }
            }
        }
    }

    private func begon(_ r: BenchRow) -> String {
        if r.matches == 0 { return "nog geen wedstrijd" }
        return r.startedOnBench > 0 ? "\(r.startedOnBench) van de \(r.startsKnown) keer begonnen op de bank" : "\(r.startsKnown)× in de basis"
    }
}
