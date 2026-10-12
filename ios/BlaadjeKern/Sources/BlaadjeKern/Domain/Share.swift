/**
 * Iets doorgeven aan een ander.
 *
 * Blaadje verstuurt zelf niets; daar zou een server voor nodig zijn en die is er
 * bewust niet. Wat het wel kan is de tekst klaarzetten en het toestel laten doen
 * waar het goed in is.
 *
 * Eerst het deelvenster van het toestel zelf. Daar staat WhatsApp in, en Signal,
 * en de mail, en kopiëren — precies de keuze die de trainer zelf hoort te maken.
 *
 * Kent het toestel dat venster niet, dan gaat de tekst naar het klembord. Lukt
 * dat ook niet, dan blijft de tekst op het scherm staan en kan hij hem met de
 * hand pakken. Er is dus altijd een weg.
 */
public enum Deelresultaat: String, Sendable {
	case gedeeld, gekopieerd, zelf
}

/**
 * Wat het toestel kan. In de webapp is dit `navigator`; hier geeft de app mee
 * wat er is, zodat de volgorde van terugvallen te testen blijft zonder scherm.
 */
public struct Deelbaar: Sendable {
	public var share: (@Sendable (_ title: String?, _ text: String) async throws -> Void)?
	public var writeText: (@Sendable (_ text: String) async throws -> Void)?

	public init(
		share: (@Sendable (_ title: String?, _ text: String) async throws -> Void)? = nil,
		writeText: (@Sendable (_ text: String) async throws -> Void)? = nil
	) {
		self.share = share
		self.writeText = writeText
	}
}

public func deel(_ tekst: String, _ titel: String? = nil, via n: Deelbaar?) async -> Deelresultaat {
	if let share = n?.share {
		do {
			try await share(titel, tekst)
			return .gedeeld
		} catch {
			/* Afgebroken of geweigerd: dan het klembord proberen. Iemand die het
			   venster wegtikt wil misschien nog steeds de tekst. */
		}
	}
	/* Let op de expliciete vraag of writeText bestáát. Een ontbrekend klembord
	   mag nooit stilletjes 'gelukt' opleveren, want dan zegt het scherm
	   'gekopieerd' terwijl er niets op het klembord staat. */
	guard let writeText = n?.writeText else { return .zelf }
	do {
		try await writeText(tekst)
		return .gekopieerd
	} catch {
		return .zelf
	}
}
