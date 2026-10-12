import SwiftUI

/// De kleuren van Blaadje, dezelfde als op het web.
enum Kleur {
    static let groen = Color(red: 0x2f / 255, green: 0x5d / 255, blue: 0x4a / 255)
    static let groenDiep = Color(red: 0x24 / 255, green: 0x48 / 255, blue: 0x3a / 255)
    static let gras = Color(red: 0x4b / 255, green: 0x8b / 255, blue: 0x5f / 255)
    static let oranje = Color(red: 0xc1 / 255, green: 0x54 / 255, blue: 0x1f / 255)
    static let oranjeLicht = Color(red: 0xfd / 255, green: 0xf1 / 255, blue: 0xe8 / 255)
}

/// Een voelbaar tikje: langs de lijn kijk je naar het veld, niet naar je telefoon.
enum Tik {
    static func licht() { UIImpactFeedbackGenerator(style: .light).impactOccurred() }
    static func stevig() { UIImpactFeedbackGenerator(style: .rigid).impactOccurred() }
    static func gelukt() { UINotificationFeedbackGenerator().notificationOccurred(.success) }
    static func let_op() { UINotificationFeedbackGenerator().notificationOccurred(.warning) }
}

/// De grote knop onderaan een scherm: één ding dat je nu gaat doen.
struct HoofdKnop: ButtonStyle {
    var kleur: Color = Kleur.groen

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.headline)
            .frame(maxWidth: .infinity, minHeight: 52)
            .foregroundStyle(.white)
            .background(kleur.opacity(configuration.isPressed ? 0.8 : 1), in: RoundedRectangle(cornerRadius: 14))
    }
}

struct TweedeKnop: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.headline)
            .frame(maxWidth: .infinity, minHeight: 52)
            .foregroundStyle(.primary)
            .background(Color(.secondarySystemBackground).opacity(configuration.isPressed ? 0.6 : 1), in: RoundedRectangle(cornerRadius: 14))
    }
}
