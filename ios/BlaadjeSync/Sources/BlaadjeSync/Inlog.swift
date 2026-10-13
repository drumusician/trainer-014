import Foundation
import Security

/// Wie er is ingelogd, en tot wanneer het bewijs geldt.
public struct Sessie: Codable, Equatable, Sendable {
	public var toegang: String
	public var vernieuw: String
	/// Seconden sinds 1970.
	public var verloopt: Double
	public var gebruiker: String
	public var email: String
}

public enum InlogFout: Error, Equatable {
	case nietIngelogd
	/// De server wees het af: een verkeerde code, of een ingetrokken sessie.
	case afgewezen(String)
	/// Geen bereik, of de server is even weg. Later opnieuw proberen.
	case storing
}

/// Waar de sessie bewaard wordt tussen twee keer openen.
public protocol Kluis: Sendable {
	func lees() -> Data?
	func schrijf(_ data: Data?)
}

/// De sleutelhanger van het toestel: daar hoort een sessie, niet in een bestand.
public struct Sleutelhanger: Kluis {
	let dienst: String
	public init(dienst: String = "app.blaadje.sessie") { self.dienst = dienst }

	private var zoek: [String: Any] {
		[kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: dienst, kSecAttrAccount as String: "sessie"]
	}

	public func lees() -> Data? {
		var vraag = zoek
		vraag[kSecReturnData as String] = true
		var uit: CFTypeRef?
		return SecItemCopyMatching(vraag as CFDictionary, &uit) == errSecSuccess ? uit as? Data : nil
	}

	public func schrijf(_ data: Data?) {
		SecItemDelete(zoek as CFDictionary)
		guard let data else { return }
		var nieuw = zoek
		nieuw[kSecValueData as String] = data
		// Ook met een vergrendeld scherm: de wedstrijd loopt door in je zak.
		nieuw[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
		SecItemAdd(nieuw as CFDictionary, nil)
	}
}

/// Inloggen bij Supabase met een code uit de mail, net als de webapp.
///
/// Het bewijs geldt een uur en wordt op tijd vernieuwd. Lukt dat niet omdat er
/// geen bereik is, dan blijf je ingelogd: langs de lijn valt het bereik weg, en
/// opnieuw inloggen kan daar niet. Alleen als de server het bewijs echt afwijst
/// ben je uitgelogd.
public actor Inlog: Toegang {
	public typealias Verkeer = @Sendable (URLRequest) async throws -> (Data, Int)

	private let basis: URL
	private let sleutel: String
	private let kluis: Kluis
	private let verkeer: Verkeer
	private let nu: @Sendable () -> Double
	private var bezig: Task<Sessie, Error>?
	public private(set) var sessie: Sessie?

	/// - Parameter basis: het adres van het Supabase-project, zonder pad.
	public init(
		basis: URL, sleutel: String, kluis: Kluis,
		verkeer: Verkeer? = nil, nu: @escaping @Sendable () -> Double = { Date().timeIntervalSince1970 }
	) {
		self.basis = basis
		self.sleutel = sleutel
		self.kluis = kluis
		self.nu = nu
		self.verkeer = verkeer ?? { verzoek in
			let (data, antwoord) = try await URLSession.shared.data(for: verzoek)
			return (data, (antwoord as? HTTPURLResponse)?.statusCode ?? 0)
		}
		sessie = kluis.lees().flatMap { try? JSONDecoder().decode(Sessie.self, from: $0) }
	}

	private func stuur(_ pad: String, _ inhoud: [String: Any]) async throws -> [String: Any] {
		var verzoek = URLRequest(url: URL(string: basis.absoluteString + pad)!)
		verzoek.httpMethod = "POST"
		verzoek.setValue(sleutel, forHTTPHeaderField: "apikey")
		verzoek.setValue("application/json", forHTTPHeaderField: "Content-Type")
		verzoek.httpBody = try JSONSerialization.data(withJSONObject: inhoud)
		let data: Data, status: Int
		do { (data, status) = try await verkeer(verzoek) } catch { throw InlogFout.storing }
		let antwoord = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] ?? [:]
		if (200..<300).contains(status) { return antwoord }
		if status == 400 || status == 401 || status == 403 || status == 422 {
			throw InlogFout.afgewezen((antwoord["msg"] ?? antwoord["message"] ?? antwoord["error_description"] ?? "") as? String ?? "")
		}
		throw InlogFout.storing
	}

	private func bewaar(_ antwoord: [String: Any]) throws -> Sessie {
		guard let toegang = antwoord["access_token"] as? String, let vernieuw = antwoord["refresh_token"] as? String else {
			throw InlogFout.storing
		}
		let gebruiker = antwoord["user"] as? [String: Any]
		let nieuw = Sessie(
			toegang: toegang, vernieuw: vernieuw,
			verloopt: nu() + ((antwoord["expires_in"] as? Double) ?? 3600),
			gebruiker: gebruiker?["id"] as? String ?? sessie?.gebruiker ?? "",
			email: gebruiker?["email"] as? String ?? sessie?.email ?? ""
		)
		sessie = nieuw
		kluis.schrijf(try? JSONEncoder().encode(nieuw))
		return nieuw
	}

	/// Stuurt een mail met een code. Wie nog geen account heeft krijgt er een.
	public func stuurCode(email: String) async throws {
		_ = try await stuur("/auth/v1/otp", ["email": email.trimmingCharacters(in: .whitespaces), "create_user": true])
	}

	@discardableResult
	public func bevestig(email: String, code: String) async throws -> Sessie {
		let antwoord = try await stuur("/auth/v1/verify", [
			"email": email.trimmingCharacters(in: .whitespaces), "token": code.trimmingCharacters(in: .whitespaces), "type": "email",
		])
		return try bewaar(antwoord)
	}

	public func logUit() {
		sessie = nil
		bezig = nil
		kluis.schrijf(nil)
	}

	public func bewijs() async throws -> String {
		guard let s = sessie else { throw InlogFout.nietIngelogd }
		if nu() < s.verloopt - 60 { return s.toegang }
		// Twee vragers tegelijk vernieuwen samen één keer: een tweede poging met
		// hetzelfde vernieuwbewijs wijst de server af.
		if let bezig { return try await bezig.value.toegang }
		let taak = Task { try bewaar(try await stuur("/auth/v1/token?grant_type=refresh_token", ["refresh_token": s.vernieuw])) }
		bezig = taak
		defer { bezig = nil }
		do {
			return try await taak.value.toegang
		} catch InlogFout.afgewezen(let waarom) {
			logUit()
			throw InlogFout.afgewezen(waarom)
		}
	}
}
