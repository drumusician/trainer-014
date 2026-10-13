import BlaadjeKern
import Foundation

/// Houdt de toestand van de app en de tabellen op het toestel gelijk.
///
/// Twee richtingen, en ze mogen elkaar niet in de weg zitten:
///
/// - Een tik van de trainer: alleen wat er door die tik veranderde gaat naar de
///   tabellen. Niet "maak de tabellen gelijk aan de toestand", want dan gooit
///   een tik weg wat de server net stuurde en de app nog niet had verwerkt.
/// - Iets van de server: de toestand wordt opnieuw opgebouwd uit de tabellen,
///   maar pas als alles van hier is weggeschreven, en alleen als de trainer in
///   de tussentijd niets deed. Anders nog een rondje.
@MainActor
public final class Motor {
	private let spiegel: Spiegel
	public let team: String
	private let toestand: () -> AppState
	private let neemOver: (AppState) -> Void
	private let onthoud: (AppState) -> Void

	/// De rijen waarvan we weten dat ze in de tabellen staan.
	private var gespiegeld: [Rij]
	private var loopt = false
	private var opnieuw = false
	private var serverVeranderd = false
	private var luisteraar: Task<Void, Never>?
	/// De laatste fout bij het wegschrijven of lezen, voor wie het wil tonen.
	public private(set) var fout: String?

	/// - Parameters:
	///   - gespiegeld: de toestand die bij de vorige keer al in de tabellen stond; `nil` als er nog niets staat.
	///   - toestand: de toestand van nu.
	///   - neemOver: de app krijgt een toestand van de server. Mag niet zelf `lokaalGewijzigd` aanroepen.
	///   - onthoud: deze toestand staat nu in de tabellen; bewaar hem voor de volgende keer openen.
	public init(
		spiegel: Spiegel, team: String, gespiegeld: AppState?,
		toestand: @escaping () -> AppState, neemOver: @escaping (AppState) -> Void, onthoud: @escaping (AppState) -> Void
	) {
		self.spiegel = spiegel
		self.team = team
		self.gespiegeld = gespiegeld.map { SyncModel.rijen(van: $0, team: team) } ?? []
		self.toestand = toestand
		self.neemOver = neemOver
		self.onthoud = onthoud
	}

	/// Begin met luisteren naar de tabellen, en schrijf weg wat er nog lag.
	public func start() {
		luisteraar?.cancel()
		luisteraar = Task { [weak self, spiegel] in
			for await _ in spiegel.veranderingen() {
				guard let self else { return }
				self.serverVeranderd = true
				self.trap()
			}
		}
		trap()
	}

	public func stop() {
		luisteraar?.cancel()
		luisteraar = nil
	}

	/// De trainer deed iets.
	public func lokaalGewijzigd() { trap() }

	/// Is alles van hier weggeschreven en alles van de server verwerkt?
	public var rustig: Bool { !loopt && !serverVeranderd }

	private func trap() {
		if loopt {
			opnieuw = true
			return
		}
		loopt = true
		Task { await pomp() }
	}

	private func pomp() async {
		defer { loopt = false }
		repeat {
			opnieuw = false
			do {
				let doel = toestand()
				let rijen = SyncModel.rijen(van: doel, team: team)
				let stappen = SyncModel.verschil(van: gespiegeld, naar: rijen)
				if !stappen.isEmpty {
					try await spiegel.schrijf(stappen)
					gespiegeld = rijen
					onthoud(doel)
				}
				if toestand() != doel {
					opnieuw = true
					continue
				}
				guard serverVeranderd else { continue }
				serverVeranderd = false
				let tabellen = try await spiegel.lees()
				if toestand() != doel {
					serverVeranderd = true
					opnieuw = true
					continue
				}
				if let server = SyncModel.toestand(uit: tabellen, team: team), server != doel {
					neemOver(server)
					gespiegeld = SyncModel.rijen(van: server, team: team)
					onthoud(server)
				}
				fout = nil
			} catch {
				// Niets kwijt: de toestand staat in de app. De volgende tik probeert het opnieuw.
				fout = String(describing: error)
			}
		} while opnieuw
	}
}
