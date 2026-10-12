import Foundation

/**
 * Where new ids come from.
 *
 * The web app makes them on the spot from the clock and a dash of chance:
 * `'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7)`.
 * Here every function that needs an id takes a generator as a parameter, so the
 * logic itself stays free of clocks and dice and a test can hand in its own.
 * `standaard` is the generator that does what the web app does.
 */
public enum IdGenerator {
	/** Short, unique enough, and readable if something ever goes wrong. */
	public static func standaard(_ voorvoegsel: String) -> () -> String {
		{
			let ms = Int64(Date().timeIntervalSince1970 * 1000)
			let tekens = Array("0123456789abcdefghijklmnopqrstuvwxyz")
			let staart = String((0..<5).map { _ in tekens[Int.random(in: 0..<tekens.count)] })
			return voorvoegsel + String(ms, radix: 36) + staart
		}
	}
}
