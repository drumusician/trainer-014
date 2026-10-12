/**
 * What the web app's store does on top of the actions: the handful of rules that
 * live there rather than in a separate file. Saving, syncing and the screen
 * state around them stay with the app.
 */
public enum StoreActions {
	/**
	 * `typing` while the trainer is still in the field: keep what they typed, spaces
	 * included, or 'Sparta ' becomes 'Sparta' under their fingers. Tidied up once
	 * they leave the field.
	 */
	public static func setOpponent(_ w: inout Match?, _ name: String, typing: Bool = false) {
		guard w != nil else { return }
		let naam = typing ? name : name.jsTrim()
		w!.opponent = naam.isEmpty ? "Tegenstander" : naam
	}

	public static func setTeamName(_ t: inout AppState, _ name: String) {
		let naam = name.jsTrim()
		t.teamName = naam.isEmpty ? "Ons team" : naam
	}

	/**
	 * Deze wedstrijd op dit toestel overnemen.
	 *
	 * Voor de telefoon die leegloopt. De wedstrijd zelf staat hier al. Wat hier
	 * verandert is alleen wie hem bijhoudt, zodat het andere toestel bij een
	 * volgende poging een botsing krijgt in plaats van er stil overheen te
	 * schrijven.
	 *
	 * `wie` is wie er tikt. Alleen bekend als je ingelogd bent; anders gebeurt er niets.
	 */
	@discardableResult
	public static func takeOverMatch(_ w: inout Match?, wie: String?) -> Bool {
		guard let m = w, !m.finished, let wie = wie.gevuld else { return false }
		w!.keptBy = wie
		return true
	}

	/**
	 * Adopt a package from another device. Everything in it replaces what you had;
	 * what is not in it stays. It never touches a running match.
	 */
	public static func adoptPackage(_ t: inout AppState, _ pakket: Overzetbaar) {
		if let teamName = pakket.teamName, !teamName.jsTrim().isEmpty { t.teamName = teamName }
		if let players = pakket.players { t.players = players }
		if let formation = pakket.formation, knowsFormation(formation) { t.formation = formation }
		if let minuten = pakket.minutesPerPart, minuten != 0, !minuten.isNaN { t.minutesPerPart = minuten }
		if let parts = pakket.parts, parts == 2 || parts == 4 { t.parts = parts }
		/* Niet 'standaard': zo heette het veld vóór de omzetting naar het Engels, en
		   wat hier binnenkomt is al omgezet. Met de oude naam kwam de
		   standaardopstelling bij terugzetten nooit mee. */
		if let defaultLineup = pakket.defaultLineup { t.defaultLineup = defaultLineup }
		if let trainings = pakket.trainings { t.trainings = trainings }
		if let archive = pakket.archive { t.archive = archive }
		if let reportSubs = pakket.reportSubs { t.reportSubs = reportSubs }
	}

	public static func adoptPackage(_ t: inout AppState, _ pakket: TransferPackage) {
		adoptPackage(&t, pakket.pakket)
	}

	/**
	 * What travels back and forth between your devices.
	 *
	 * The match goes along. Before kick-off that is simply preparation: you set the
	 * lineup and the absences at home and pick it up on your phone at the pitch.
	 * During the match it is a backup, because a flat battery is now the only thing
	 * that can cost you a whole match. What does not happen is the other direction:
	 * a running match is never overwritten by what sits on the server. See
	 * adoptSyncPayload.
	 */
	public static func syncPayload(_ t: AppState) -> JSONValue {
		var o = OrderedDict<JSONValue>()
		o["teamName"] = .string(t.teamName)
		o["players"] = .array(t.players.map(\.json))
		o["formation"] = .string(t.formation)
		o["minutesPerPart"] = .number(t.minutesPerPart)
		o["parts"] = .number(Double(t.parts))
		o["defaultLineup"] = t.defaultLineup?.json ?? .null
		o["trainings"] = .array(t.trainings.map(\.json))
		o["archive"] = .array(t.archive.map(\.json))
		o["reportSubs"] = .bool(t.reportSubs)
		o["match"] = t.match?.json ?? .null
		return .object(o)
	}

	/**
	 * Take over what another device sent. False, and nothing changed, when there
	 * is no squad in it or it cannot be read.
	 */
	@discardableResult
	public static func adoptSyncPayload(_ t: inout AppState, _ ruw: JSONValue) -> Bool {
		/* What sits on the server may come from a device that has not been updated
		   yet, and then the field names are still Dutch. */
		let d = migreerToestand(ruw)
		guard let o = d.objectValue, let spelers = o.arr("players") else { return false }
		let players: [Player]
		let defaultLineup: DefaultLineup?
		let trainings: [Training]
		let archive: [ArchivedMatch]
		let match: Match?
		do {
			players = try spelers.map(Player.init(json:))
			defaultLineup = try o.obj("defaultLineup").map(DefaultLineup.init(json:))
			trainings = try (o.arr("trainings") ?? []).map(Training.init(json:))
			archive = try (o.arr("archive") ?? []).map(ArchivedMatch.init(json:))
			match = try o.obj("match").map(Match.init(json:))
		} catch {
			return false
		}

		t.players = players
		if let teamName = o.str("teamName"), !teamName.jsTrim().isEmpty { t.teamName = teamName }
		if let formation = o.str("formation"), knowsFormation(formation) { t.formation = formation }
		if let minuten = o.num("minutesPerPart"), minuten != 0, !minuten.isNaN { t.minutesPerPart = minuten }
		if let parts = o.num("parts"), parts == 2 || parts == 4 { t.parts = Int(parts) }
		t.defaultLineup = defaultLineup
		t.trainings = trainings
		t.archive = archive
		t.reportSubs = o["reportSubs"]?.truthy ?? false
		/*
		 * Where the line sits: kick-off.
		 *
		 * Everything about the match — the lineup and every substitution — is stored
		 * and does go to the server, four seconds after each change. This is not
		 * about what gets saved. It is about who wins when this device and the server
		 * disagree.
		 *
		 * Before kick-off the server wins. Worst case you prepared a lineup here and
		 * someone prepared a different one elsewhere: you pick again, two minutes.
		 *
		 * After kick-off this device always wins, because of the gap between tapping
		 * a substitution and it reaching the server. Normally four seconds; standing
		 * behind the sports hall with no signal, twenty minutes. For that stretch
		 * those substitutions exist on this phone and nowhere else, and overwriting
		 * them would put them beyond recovery — nobody remembers who came off ten
		 * minutes ago.
		 */
		if !(ClockActions.kickedOff(t.match) && t.match?.finished != true) { t.match = match }
		return true
	}
}
