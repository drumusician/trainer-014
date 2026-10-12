/** Who is in your squad and what they play. */
public enum SquadActions {
	public static func playerById(_ t: AppState, _ id: String?) -> Player? {
		guard let id = id.gevuld else { return nil }
		return t.players.first { $0.id == id }
	}

	/** A pasted block of names, one per line. Empty lines are skipped. */
	public static func addPlayerNames(
		_ t: inout AppState,
		_ tekst: String,
		nieuwId: () -> String = IdGenerator.standaard("p")
	) {
		for name in tekst.split(separator: "\n", omittingEmptySubsequences: false).map({ String($0).jsTrim() })
		where !name.isEmpty {
			t.players.append(Player(id: nieuwId(), name: name, line: .geen))
		}
	}

	public static func renamePlayer(_ p: inout Player, _ name: String) {
		p.name = name.jsTrim()
	}

	public static func removePlayer(_ t: inout AppState, _ p: Player) {
		t.players = t.players.filter { $0.id != p.id }
	}

	/** Tapping the same line again switches it back off. */
	public static func setLine(_ p: inout Player, _ line: FieldLine) {
		p.line = p.line == line ? .geen : line
	}

	/** Keeping is separate from the line: a defender who also keeps stays a defender. */
	public static func toggleKeeper(_ p: inout Player) {
		p.keeper = !(p.keeper ?? false)
	}
}
