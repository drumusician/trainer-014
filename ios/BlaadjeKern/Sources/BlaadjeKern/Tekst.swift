/**
 * Vaste tekst die de rekenkern zelf nodig heeft.
 *
 * In de webapp staat elke zin die een trainer te zien krijgt in `text/nl.ts`.
 * Hier staat alleen wat de functies in dit pakket daaruit gebruiken, letterlijk
 * overgenomen; de rest van die tabel hoort bij de schermen.
 */
public enum Tekst {
	/** Het wisselplan: een spiekbriefje, geen wekker. Zie Domain/Plan.swift. */
	public enum Plan {
		public static func step(_ on: String, _ off: String) -> String { "\(on) voor \(off)" }
		public static func swapStep(_ a: String, _ b: String) -> String { "\(a) en \(b) ruilen van plek" }
		public static func stepAt(_ on: String, _ off: String, _ position: String) -> String {
			"\(on) voor \(off) (\(position))"
		}
		public static func swapTo(_ a: String, _ toA: String, _ b: String, _ toB: String) -> String {
			"\(a) naar \(toA), \(b) naar \(toB)"
		}
		public static func notBothOn(_ a: String, _ b: String) -> String {
			"\(a) en \(b) staan niet allebei in het veld"
		}
		public static func absent(_ name: String) -> String { "\(name) is er niet" }
		public static func alreadyOn(_ name: String) -> String { "\(name) staat al in het veld" }
		public static func notOn(_ name: String) -> String { "\(name) staat niet in het veld" }
	}
}
