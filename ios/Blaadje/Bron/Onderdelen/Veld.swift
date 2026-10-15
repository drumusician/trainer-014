import BlaadjeKern
import SwiftUI

/// Het veld met de opstelling erop. Tik op een plek om hem te kiezen.
struct Veld: View {
    let formatie: String
    let opstelling: Lineup
    var gekozen: String?
    /// Plekken waar net iets veranderde, bij het terugkijken van een wedstrijd.
    var gemarkeerd: Set<String> = []
    /// Seconden gespeeld per speler; tijdens een wedstrijd staan de minuten onder de naam.
    var tijden: [String: Double]?
    let naam: (String?) -> String?
    var opPlek: (String) -> Void = { _ in }

    var body: some View {
        GeometryReader { geo in
            let b = geo.size.width, h = geo.size.height
            ZStack(alignment: .topLeading) {
                RoundedRectangle(cornerRadius: 12).fill(Kleur.gras)
                Lijnen().stroke(.white.opacity(0.35), lineWidth: 1.5)

                ForEach(positionsOf(formatie), id: \.id) { plek in
                    let id = opstelling[plek.id]
                    let wie = naam(id)
                    Button { opPlek(plek.id) } label: {
                        VStack(spacing: 2) {
                            Text(wie ?? "+")
                                .font(.system(size: min(max(b * 0.043, 11), 17), weight: wie == nil ? .medium : .bold))
                                .lineLimit(1)
                                .minimumScaleFactor(0.7)
                                .padding(.vertical, 5)
                                .padding(.horizontal, 3)
                                .frame(width: b * 0.215)
                                .foregroundStyle(gekozen == plek.id ? .white : (wie == nil ? .white.opacity(0.9) : Color(red: 0.09, green: 0.13, blue: 0.11)))
                                .background(
                                    gekozen == plek.id ? Kleur.oranje : (wie == nil ? .white.opacity(0.3) : .white.opacity(0.94)),
                                    in: RoundedRectangle(cornerRadius: 8)
                                )
                                .overlay(RoundedRectangle(cornerRadius: 8).stroke(.white, lineWidth: gekozen == plek.id ? 2 : 0))
                                .overlay(RoundedRectangle(cornerRadius: 8).stroke(Kleur.oranje, lineWidth: gemarkeerd.contains(plek.id) ? 3 : 0))
                            // Waar iemand staat zie je aan de plek; eronder alleen zijn speeltijd.
                            if let id, let tijden {
                                Text("\(Int((tijden[id, default: 0] / 60).rounded()))′")
                                    .monospacedDigit()
                                    .font(.system(size: min(max(b * 0.029, 9), 12), weight: .bold))
                                    .foregroundStyle(.white.opacity(0.9))
                            }
                        }
                        // Ruim om de naam heen raak te tikken, ook met koude vingers.
                        .padding(4)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .position(x: b * plek.x / 100, y: h * plek.y / 100)
                    .accessibilityLabel("\(Self.voluit(plek.label)): \(wie ?? "leeg")")
                    .accessibilityIdentifier("\(plek.label): \(wie ?? "leeg")")
                    .accessibilityAddTraits(gekozen == plek.id ? .isSelected : [])
                }
            }
        }
    }
}

extension Veld {
    /// De plek in woorden, voor VoiceOver.
    static func voluit(_ kort: String) -> String {
        [
            "K": "Keeper", "LV": "Linksachter", "CV": "Centrale verdediger", "RV": "Rechtsachter", "V": "Verdediger",
            "VM": "Verdedigende middenvelder", "LM": "Linkermiddenvelder", "M": "Middenvelder", "RM": "Rechtermiddenvelder",
            "LA": "Linksaanvaller", "RA": "Rechtsaanvaller", "LB": "Linksbuiten", "RB": "Rechtsbuiten", "SP": "Spits",
        ][kort] ?? kort
    }
}

private struct Lijnen: Shape {
    func path(in r: CGRect) -> Path {
        // Getekend op 300 bij 400, net als op het web, en dan geschaald.
        let sx = r.width / 300, sy = r.height / 400
        func vak(_ x: CGFloat, _ y: CGFloat, _ w: CGFloat, _ h: CGFloat) -> CGRect {
            CGRect(x: x * sx, y: y * sy, width: w * sx, height: h * sy)
        }
        var p = Path()
        p.addRect(vak(8, 8, 284, 384))
        p.move(to: CGPoint(x: 8 * sx, y: 200 * sy))
        p.addLine(to: CGPoint(x: 292 * sx, y: 200 * sy))
        p.addEllipse(in: vak(104, 154 + (46 - 46 * sx / sy), 92, 92 * sx / sy))
        p.addRect(vak(72, 8, 156, 58))
        p.addRect(vak(72, 334, 156, 58))
        p.addRect(vak(115, 8, 70, 22))
        p.addRect(vak(115, 370, 70, 22))
        return p
    }
}

/// De bank naast het veld, per linie. Wie het minst speelde staat bovenaan.
struct Bank: View {
    let bank: [String]
    let formatie: String
    var gekozen: String?
    var tijden: [String: Double]?
    let speler: (String?) -> Player?
    var leeg = "Iedereen speelt."
    var opTik: (String) -> Void

    private var spelers: [Player] { bank.compactMap { speler($0) } }
    private var doelLinie: Line? { gekozen.map { positionLine($0, formatie) } }

    private func past(_ p: Player) -> Bool {
        guard let doelLinie else { return false }
        return doelLinie == .K ? canKeep(p) : p.line.rawValue == doelLinie.rawValue
    }

    private func groep(_ linie: Line) -> [Player] {
        spelers.filter { groupOf($0) == linie }.sorted { a, b in
            if let tijden { return tijden[a.id, default: 0] < tijden[b.id, default: 0] }
            return a.name.localizedCompare(b.name) == .orderedAscending
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("BANK").font(.caption.bold()).kerning(1).foregroundStyle(Kleur.accent)
                .padding(.bottom, 4)
            ScrollView {
                VStack(alignment: .leading, spacing: 5) {
                    if spelers.isEmpty {
                        Text(leeg).font(.footnote).foregroundStyle(.secondary)
                    }
                    ForEach(LINE_ORDER, id: \.self) { linie in
                        let groepje = groep(linie)
                        if !groepje.isEmpty {
                            let raak = gekozen != nil && groepje.contains(where: past)
                            HStack {
                                Text(LINES[linie] ?? "").font(.caption2.bold())
                                Spacer()
                                Text("\(groepje.count)").font(.caption2).monospacedDigit()
                            }
                            .foregroundStyle(raak ? Kleur.oranje : .secondary)
                            .padding(.top, 4)
                            ForEach(groepje) { p in
                                Button { opTik(p.id) } label: {
                                    VStack(alignment: .leading, spacing: 1) {
                                        Text(p.name).font(.subheadline.weight(.semibold)).lineLimit(1).minimumScaleFactor(0.75)
                                        if let tijden {
                                            Text("\(Int((tijden[p.id, default: 0] / 60).rounded()))′")
                                                .font(.caption).monospacedDigit().foregroundStyle(.secondary)
                                        }
                                    }
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                    .padding(.horizontal, 9)
                                    .padding(.vertical, 8)
                                    .background(
                                        gekozen != nil && past(p) ? Kleur.oranjeLicht : Color(.secondarySystemBackground),
                                        in: RoundedRectangle(cornerRadius: 9)
                                    )
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 9)
                                            .stroke(gekozen != nil && past(p) ? Kleur.oranje : .clear, lineWidth: 1.5)
                                    )
                                    .opacity(gekozen != nil && !past(p) ? 0.6 : 1)
                                    .foregroundStyle(.primary)
                                }
                                .buttonStyle(.plain)
                                .accessibilityLabel("Bank: \(p.name)")
                            }
                        }
                    }
                }
            }
        }
    }
}
