import BlaadjeKern
import SwiftUI

/// Het scherm langs de lijn. Eén tik op een speler, één op zijn vervanger.
struct Wedstrijd: View {
    @Environment(AppModel.self) private var app
    var naarAfloop: () -> Void
    var sluit: () -> Void
    var naarAanwezig: () -> Void

    /// Wie scoorde? Dan is het veld even een keuzelijst.
    @State private var doelpuntKiezen = false
    /// Na een doelpunt: wie gaf hem aan? Overslaan mag, het spel gaat door.
    @State private var assistVragen = false
    @State private var maker: String?
    @State private var klokBijstellen = false
    @State private var afsluitenVragen = false

    var body: some View {
        if let w = app.match {
            VStack(spacing: 0) {
                kop(w)
                klokbalk(w)
                VeldMetBank {
                    Veld(
                        formatie: w.formation, opstelling: w.lineup, gekozen: app.gekozenPlek,
                        tijden: app.speeltijden, naam: { app.speler($0)?.name }, opPlek: { tikPlek($0, w) }
                    )
                } bank: {
                    Bank(
                        bank: w.bench, formatie: w.formation, gekozen: app.gekozenPlek,
                        tijden: app.speeltijden, speler: { app.speler($0) }
                    ) { id in
                        guard app.gekozenPlek != nil else { return }
                        app.brengIn(id)
                        Tik.stevig()
                    }
                }
                .padding(.horizontal, 10)
                .padding(.top, 8)

                melding(w)
                knoppen
            }
            .background(Color(.systemBackground))
            .sheet(isPresented: $klokBijstellen) { KlokBijstellen().presentationDetents([.height(250)]) }
            .confirmationDialog("Wedstrijd afsluiten?", isPresented: $afsluitenVragen, titleVisibility: .visible) {
                Button("Afsluiten", role: .destructive) {
                    app.sluitAf()
                    naarAfloop()
                }
                Button("Nog niet", role: .cancel) {}
            } message: {
                Text("De klok stopt en je ziet wie hoe lang speelde.")
            }
            // Langs de lijn mag het scherm niet op zwart gaan.
            .onAppear { UIApplication.shared.isIdleTimerDisabled = true }
            .onDisappear { UIApplication.shared.isIdleTimerDisabled = false }
        }
    }

    // MARK: - bovenin

    private func kop(_ w: Match) -> some View {
        let ons = app.toestand.teamName
        let uitslag = homeFirst(app.stand, w.home)
        return HStack(spacing: 10) {
            Button(action: sluit) {
                Image(systemName: "chevron.down").font(.body.weight(.semibold)).frame(width: 36, height: 36)
            }
            .accessibilityLabel("Naar het beginscherm")
            Text(w.home ? "\(ons) – \(w.opponent)" : "\(w.opponent) – \(ons)")
                .font(.subheadline.weight(.semibold)).lineLimit(1).minimumScaleFactor(0.7)
            Spacer(minLength: 4)
            Text("\(uitslag.voor) – \(uitslag.tegen)").font(.title3.bold()).monospacedDigit()
                .accessibilityLabel("Stand \(uitslag.voor) \(uitslag.tegen)")
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 4)
    }

    private func klokbalk(_ w: Match) -> some View {
        HStack(spacing: 8) {
            Button { klokBijstellen = true } label: {
                VStack(alignment: .leading, spacing: 0) {
                    Text(mmss(app.verstreken)).font(.system(size: 34, weight: .bold)).monospacedDigit()
                    Text(w.inBreak ? breakName(w.part, w.parts) : partName(w.part, w.parts))
                        .font(.caption).opacity(0.85)
                }
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Klok \(mmss(app.verstreken)), tik om bij te stellen")
            Spacer()
            // Per moment alleen wat dan zin heeft.
            if !app.afgetrapt {
                klokknop("Aftrap", vol: true) { app.startOfPauzeer(); Tik.gelukt() }
            } else if w.inBreak {
                klokknop("Start \(partName(w.part + 1, w.parts))", vol: true) { app.volgendDeelOfRust(); Tik.gelukt() }
            } else {
                klokknop(w.running ? "Pauze" : "Verder") { app.startOfPauzeer(); Tik.licht() }
                if app.kanVolgendDeel {
                    klokknop("Einde \(partName(w.part, w.parts))") { app.volgendDeelOfRust(); Tik.gelukt() }
                }
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 8)
        .foregroundStyle(.white)
        .background(Kleur.groen)
    }

    private func klokknop(_ titel: String, vol: Bool = false, _ doe: @escaping () -> Void) -> some View {
        Button(action: doe) {
            Text(titel).font(.subheadline.weight(.semibold))
                .padding(.horizontal, 14).frame(minHeight: 44)
                .foregroundStyle(vol ? Kleur.groen : .white)
                .background(vol ? .white : .white.opacity(0.16), in: RoundedRectangle(cornerRadius: 11))
                .overlay(RoundedRectangle(cornerRadius: 11).stroke(.white.opacity(vol ? 0 : 0.35)))
        }
        .buttonStyle(.plain)
    }

    // MARK: - tikken op het veld

    private func tikPlek(_ plek: String, _ w: Match) {
        if doelpuntKiezen {
            guard let id = w.lineup[plek] else { return }
            app.doelpunt(id)
            maker = id
            doelpuntKiezen = false
            assistVragen = true
            Tik.gelukt()
            return
        }
        if assistVragen {
            guard let id = w.lineup[plek], id != maker else { return }
            app.assist(id)
            assistVragen = false
            Tik.licht()
            return
        }
        guard let eerste = app.gekozenPlek else {
            app.gekozenPlek = plek
            Tik.licht()
            return
        }
        if eerste == plek {
            app.gekozenPlek = nil
            return
        }
        // Twee plekken na elkaar: die ruilen. Dat is geen wissel, er komt niemand
        // van de bank; denk aan de keeper die na de rust het veld in gaat.
        app.ruil(eerste, plek)
        Tik.stevig()
    }

    // MARK: - wat je nu aan het doen bent

    @ViewBuilder
    private func melding(_ w: Match) -> some View {
        if doelpuntKiezen {
            balk("Doelpunt. Tik op wie hem maakte.") {
                kleineKnop("Weet ik niet") { app.doelpunt(nil); doelpuntKiezen = false; Tik.gelukt() }
                kleineKnop("Annuleer") { doelpuntKiezen = false }
            }
        } else if assistVragen {
            balk("\(app.speler(maker)?.name ?? "Doelpunt"). Wie gaf de assist?") {
                kleineKnop("Geen assist") { assistVragen = false }
            }
        } else if let plek = app.gekozenPlek {
            let uit = app.speler(w.lineup[plek])
            let linie = positionLine(plek, w.formation)
            let keepte = Int(((uit.flatMap { app.keepertijden[$0.id] } ?? 0) / 60).rounded())
            balk(
                "\(uit?.name ?? "Lege plek") · tik op de bank voor een wissel, of op een andere plek om te ruilen."
                    + (keepte > 0 && linie != .K ? " Keepte al \(keepte)′." : "")
            ) {
                if let uit {
                    kleineKnop("\(uit.name) scoorde") {
                        app.gekozenPlek = nil
                        app.doelpunt(uit.id)
                        maker = uit.id
                        assistVragen = true
                        Tik.gelukt()
                    }
                }
                kleineKnop("Annuleer") { app.gekozenPlek = nil }
            }
        }
    }

    private func balk(_ tekst: String, @ViewBuilder knoppen: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(tekst).font(.subheadline).fixedSize(horizontal: false, vertical: true)
            HStack(spacing: 8) { knoppen() }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .foregroundStyle(Color(red: 0.09, green: 0.13, blue: 0.11))
        .background(Kleur.oranjeLicht)
        .overlay(alignment: .top) { Rectangle().fill(Kleur.oranje).frame(height: 2) }
    }

    private func kleineKnop(_ titel: String, _ doe: @escaping () -> Void) -> some View {
        Button(action: doe) {
            Text(titel).font(.subheadline.weight(.semibold))
                .padding(.horizontal, 12).frame(minHeight: 40)
                .background(.white, in: RoundedRectangle(cornerRadius: 9))
                .overlay(RoundedRectangle(cornerRadius: 9).stroke(Kleur.oranje.opacity(0.4)))
        }
        .buttonStyle(.plain)
    }

    // MARK: - onderin

    private var knoppen: some View {
        HStack(spacing: 8) {
            Button {
                assistVragen = false
                app.gekozenPlek = nil
                doelpuntKiezen.toggle()
            } label: { Label("Doelpunt", systemImage: "soccerball") }
                .buttonStyle(HoofdKnop())

            Button {
                assistVragen = false
                doelpuntKiezen = false
                app.tegendoelpunt()
                Tik.let_op()
            } label: { Text("Tegen") }
                .buttonStyle(TweedeKnop())
                .frame(maxWidth: 96)

            if let wat = app.terugTeDraaien {
                Button {
                    app.draaiTerug()
                    assistVragen = false
                    Tik.licht()
                } label: { Image(systemName: "arrow.uturn.backward") }
                    .buttonStyle(TweedeKnop())
                    .frame(width: 52)
                    .accessibilityLabel("\(wat) terugdraaien")
            }

            Menu {
                // Alleen zolang de klok nog niet liep. Daarna is dit een misser
                // tijdens het coachen.
                if !app.afgetrapt {
                    Button { naarAanwezig() } label: { Label("Wie is er?", systemImage: "person.2") }
                }
                Button(role: .destructive) { afsluitenVragen = true } label: {
                    Label("Wedstrijd afsluiten", systemImage: "flag.checkered")
                }
            } label: {
                Image(systemName: "ellipsis").font(.headline)
                    .frame(width: 52, height: 52)
                    .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 14))
            }
            .accessibilityLabel("Meer opties")
        }
        .padding(.horizontal, 10)
        .padding(.top, 8)
        .padding(.bottom, 6)
    }
}

/// De scheidsrechter is leidend, niet je telefoon.
private struct KlokBijstellen: View {
    @Environment(AppModel.self) private var app
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(spacing: 18) {
            Text("Klok bijstellen").font(.headline)
            Text(mmss(app.verstreken)).font(.system(size: 44, weight: .bold)).monospacedDigit()
            HStack(spacing: 12) {
                Button("− 1 minuut") { app.verschuifKlok(-60) }.buttonStyle(TweedeKnop())
                Button("+ 1 minuut") { app.verschuifKlok(60) }.buttonStyle(TweedeKnop())
            }
            Button("Klaar") { dismiss() }.buttonStyle(HoofdKnop())
        }
        .padding(20)
    }
}
