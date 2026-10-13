import BlaadjeKern
import SwiftUI

/// Wie staat waar. Voor de wedstrijd van vandaag, of de standaardopstelling.
struct Opstelling: View {
    @Environment(AppModel.self) private var app
    let bron: LineupActions.Bron
    var klaarTitel: String
    var klaar: () -> Void

    @State private var onvolledigVragen = false
    @State private var bankTonen = false
    @State private var planTonen = false

    var body: some View {
        if let doel = LineupActions.doelVan(app.toestand, bron) {
            let bezet = doel.lineup.opHetVeld.count
            let nodig = positionCount(doel.formation)
            VStack(spacing: 0) {
                VeldMetBank {
                    Veld(
                        formatie: doel.formation, opstelling: doel.lineup, gekozen: app.gekozenPlek,
                        naam: { app.speler($0)?.name }, opPlek: { tik($0) }
                    )
                } bank: {
                    Bank(
                        bank: doel.bench, formatie: doel.formation, gekozen: app.gekozenPlek,
                        speler: { app.speler($0) }, leeg: "Iedereen staat."
                    ) { id in
                        guard app.gekozenPlek != nil else { return }
                        app.zetOpPlekBijOpstellen(bron, id)
                        Tik.licht()
                    }
                }
                .padding(.horizontal, 10)
                .padding(.top, 8)

                VStack(spacing: 10) {
                    if let plek = app.gekozenPlek {
                        HStack {
                            Text(doel.lineup[plek].flatMap { app.speler($0)?.name }.map { "\($0) · kies wie hier komt, of een andere plek om te ruilen." }
                                ?? "Kies op de bank wie hier komt te staan.")
                                .font(.subheadline)
                            Spacer()
                            if doel.lineup[plek] != nil {
                                Button("Naar de bank") { app.haalVanVeld(bron, plek) }
                                    .font(.subheadline.weight(.semibold))
                            }
                        }
                    } else {
                        Text(bezet == 0 ? "Tik op een plek en dan op een naam." : "\(bezet) van de \(nodig) staan.")
                            .font(.subheadline).foregroundStyle(.secondary)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    HStack(spacing: 8) {
                        Button { bankTonen = true } label: { Label("Bank tot nu toe", systemImage: "chart.bar.xaxis") }
                        if bron == .wedstrijd {
                            let n = app.match?.plan?.count ?? 0
                            Button { planTonen = true } label: {
                                Label(n > 0 ? "Wisselplan (\(n))" : "Wisselplan", systemImage: "list.bullet.clipboard")
                            }
                        }
                    }
                    .buttonStyle(.bordered)
                    .font(.subheadline)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    Button(klaarTitel) {
                        if bron == .wedstrijd, bezet < nodig { onvolledigVragen = true } else { klaar() }
                    }
                    .buttonStyle(HoofdKnop())
                    .disabled(bron == .wedstrijd && bezet == 0)
                    .opacity(bron == .wedstrijd && bezet == 0 ? 0.4 : 1)
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
            }
            .confirmationDialog(
                "Er staan er \(bezet) op het veld in plaats van \(nodig).", isPresented: $onvolledigVragen, titleVisibility: .visible
            ) {
                Button("Toch doorgaan") { klaar() }
                Button("Terug", role: .cancel) {}
            }
            .sheet(isPresented: $bankTonen) {
                Bankoverzicht(
                    nuOpDeBank: Set(doel.bench),
                    afwezig: Set(bron == .wedstrijd ? app.match?.absent ?? [] : []))
            }
            .sheet(isPresented: $planTonen) { Wisselplan() }
            .onDisappear { app.gekozenPlek = nil }
        }
    }

    private func tik(_ plek: String) {
        guard let eerste = app.gekozenPlek else {
            app.gekozenPlek = plek
            return
        }
        if eerste == plek {
            app.gekozenPlek = nil
        } else {
            app.ruilBijOpstellen(bron, eerste, plek)
            Tik.licht()
        }
    }
}

/// Wie is er vandaag? Wie je wegtikt staat niet op de bank en telt niet mee.
struct Aanwezig: View {
    @Environment(AppModel.self) private var app
    var klaar: () -> Void

    var body: some View {
        let afwezig = Set(app.match?.absent ?? [])
        VStack(spacing: 0) {
            List {
                Section {
                    ForEach(app.spelers) { p in
                        let weg = afwezig.contains(p.id)
                        Button {
                            app.zetAfwezig(p.id, !weg)
                            Tik.licht()
                        } label: {
                            HStack {
                                Image(systemName: weg ? "circle" : "checkmark.circle.fill")
                                    .font(.title3)
                                    .foregroundStyle(weg ? Color.secondary : Kleur.accent)
                                Text(p.name).foregroundStyle(weg ? .secondary : .primary)
                                    .strikethrough(weg)
                                Spacer()
                            }
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("\(p.name), \(weg ? "afwezig" : "aanwezig")")
                    }
                } footer: {
                    Text("\(app.spelers.count - afwezig.count) van de \(app.spelers.count) zijn er.")
                }
            }
            Button("Naar de opstelling", action: klaar)
                .buttonStyle(HoofdKnop())
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
        }
    }
}
