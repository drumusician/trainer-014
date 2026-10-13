import ActivityKit
import Foundation

/// Wat er op het vergrendelscherm staat tijdens een wedstrijd. Zit in de app én
/// in de uitbreiding die het tekent, dus hier staat niets wat de rest nodig heeft.
struct KlokGegevens: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        /// Thuis eerst, zoals op het scorebord.
        var links: String
        var rechts: String
        var standLinks: Int
        var standRechts: Int
        /// "1e helft", "Rust".
        var deel: String
        var loopt: Bool
        /// Het moment waarop de klok op nul stond. Het vergrendelscherm telt
        /// daar zelf vanaf, ook als de app dicht is.
        var begin: Date
        /// Waar de klok op stilstaat, als hij niet loopt.
        var verstreken: Double
    }
}
