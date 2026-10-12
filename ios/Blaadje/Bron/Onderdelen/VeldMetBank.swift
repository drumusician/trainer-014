import SwiftUI

/// Het veld links, de bank ernaast. Het veld krijgt alle ruimte die er is: zo
/// breed als past naast de bank, en nooit hoger dan het scherm, zodat je langs
/// de lijn nergens hoeft te scrollen.
struct VeldMetBank<V: View, B: View>: View {
    @ViewBuilder var veld: () -> V
    @ViewBuilder var bank: () -> B

    var body: some View {
        GeometryReader { geo in
            let maten = Self.maten(breedte: geo.size.width, hoogte: geo.size.height)
            HStack(alignment: .top, spacing: Self.tussen) {
                veld().frame(width: maten.veld, height: maten.veld * 1.6)
                bank().frame(width: maten.bank).frame(maxHeight: geo.size.height)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        }
    }

    static var tussen: CGFloat { 10 }

    /// Los van het scherm uit te rekenen, zodat een test het kan nameten.
    static func maten(breedte: CGFloat, hoogte: CGFloat) -> (veld: CGFloat, bank: CGFloat) {
        let bank = min(max(breedte * 0.26, 96), 180)
        let veld = max(min(breedte - bank - tussen, hoogte * 0.625, 520), 0)
        // Op een breed scherm blijft er naast het veld ruimte over: die is voor de bank.
        return (veld, min(max(breedte - veld - tussen, bank), 240))
    }
}
