import BlaadjeKern
import SwiftUI

/// Wie er op de training was. Iedereen staat op aanwezig; je tikt alleen wie er niet is.
struct Trainingen: View {
    @Environment(AppModel.self) private var app
    @State private var pad: [String] = []

    var body: some View {
        NavigationStack(path: $pad) {
            List {
                if !app.toestand.trainings.isEmpty {
                    Section {
                        ForEach(app.toestand.trainings) { t in
                            NavigationLink(value: t.id) {
                                VStack(alignment: .leading, spacing: 1) {
                                    Text(dateText(t.date))
                                    Text(Aanwezigheid.samenvatting(t, app.spelers))
                                        .font(.caption).foregroundStyle(.secondary)
                                }
                            }
                            .accessibilityIdentifier("training")
                        }
                        .onDelete { plekken in
                            plekken.map { app.toestand.trainings[$0].id }.forEach(app.verwijderTraining)
                        }
                    }
                }
                if !mageren.isEmpty {
                    Section {
                        ForEach(mageren, id: \.speler.id) { r in
                            LabeledContent(r.speler.name, value: "\(r.er) van de \(r.totaal)")
                        }
                    } header: {
                        Text("Vaak gemist")
                    } footer: {
                        Text("Over de laatste vier trainingen.")
                    }
                }
            }
            .navigationTitle("Trainingen")
            .navigationDestination(for: String.self) { EenTraining(id: $0) }
            .toolbar {
                if !app.spelers.isEmpty {
                    ToolbarItem(placement: .primaryAction) {
                        Button { pad = [app.nieuweTraining()] } label: { Label("Nieuwe training", systemImage: "plus") }
                    }
                }
            }
            .overlay {
                if app.spelers.isEmpty {
                    ContentUnavailableView(
                        "Nog geen spelers", systemImage: "person.3",
                        description: Text("Zet eerst je spelers erin, bij Team."))
                } else if app.toestand.trainings.isEmpty {
                    ContentUnavailableView {
                        Label("Nog geen trainingen", systemImage: "figure.run")
                    } description: {
                        Text("Iedereen staat op aanwezig. Je tikt alleen wie er niet is.")
                    } actions: {
                        Button("Training van vandaag") { pad = [app.nieuweTraining()] }
                            .buttonStyle(.borderedProminent)
                    }
                }
            }
        }
    }

    /// Onder de helft van de laatste vier: dat is een gesprekje waard.
    private var mageren: [(speler: Player, er: Int, totaal: Int)] {
        app.spelers.compactMap { p in
            let r = attendanceOf(app.toestand.trainings, p.id, 4)
            return thinAttendance(r) ? (p, r.er, r.totaal) : nil
        }
    }
}

enum Aanwezigheid {
    static func telling(_ t: Training, _ spelers: [Player]) -> (er: Int, afgemeld: Int, weg: Int) {
        var er = 0, afgemeld = 0, weg = 0
        for p in spelers {
            switch t.status[p.id] {
            case .present: er += 1
            case .excused: afgemeld += 1
            case .absent: weg += 1
            case nil: break
            }
        }
        return (er, afgemeld, weg)
    }

    /// Alleen noemen wat er is: nul afgemeld hoeft niet in de regel te staan.
    static func samenvatting(_ t: Training, _ spelers: [Player]) -> String {
        let w = telling(t, spelers)
        return "\(w.er) aanwezig" + (w.afgemeld > 0 ? ", \(w.afgemeld) afgemeld" : "") + (w.weg > 0 ? ", \(w.weg) niet gekomen" : "")
    }

    static func woord(_ st: Attendance) -> String {
        switch st {
        case .present: "aanwezig"
        case .excused: "afgemeld"
        case .absent: "niet gekomen"
        }
    }
}

/// Eén avond. Een tik op een naam zet hem op afgemeld, nog een op niet gekomen.
private struct EenTraining: View {
    @Environment(AppModel.self) private var app
    @Environment(\.dismiss) private var dismiss
    let id: String

    var body: some View {
        if let t = app.training(id) {
            List {
                Section {
                    DatePicker(
                        "Datum",
                        selection: Binding(
                            get: { AppModel.datum(t.date) ?? Date() },
                            set: { app.zetTrainingDatum(id, $0) }),
                        displayedComponents: .date
                    )
                }
                Section {
                    ForEach(app.spelers) { p in
                        let st = t.status[p.id] ?? .present
                        Button {
                            app.tikAanwezigheid(id, p.id)
                            Tik.licht()
                        } label: {
                            HStack {
                                Image(systemName: beeld(st)).font(.title3).foregroundStyle(kleur(st))
                                Text(p.name).foregroundStyle(st == .present ? .primary : .secondary)
                                Spacer()
                                if st != .present {
                                    Text(Aanwezigheid.woord(st)).font(.subheadline.weight(.semibold)).foregroundStyle(kleur(st))
                                }
                            }
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("\(p.name), \(Aanwezigheid.woord(st))")
                    }
                } header: {
                    Text(Aanwezigheid.samenvatting(t, app.spelers))
                } footer: {
                    Text("Tik op een naam om te wisselen tussen aanwezig, afgemeld en niet gekomen.")
                }
                Section {
                    Button("Verwijder deze training", role: .destructive) {
                        app.verwijderTraining(id)
                        dismiss()
                    }
                }
            }
            .navigationTitle("Training \(shortDate(t.date))")
            .navigationBarTitleDisplayMode(.inline)
        } else {
            ContentUnavailableView("Deze training staat er niet meer", systemImage: "figure.run")
        }
    }

    private func beeld(_ st: Attendance) -> String {
        switch st {
        case .present: "checkmark.circle.fill"
        case .excused: "minus.circle.fill"
        case .absent: "xmark.circle.fill"
        }
    }

    private func kleur(_ st: Attendance) -> Color {
        switch st {
        case .present: Kleur.accent
        case .excused: Kleur.oranje
        case .absent: .red
        }
    }
}
