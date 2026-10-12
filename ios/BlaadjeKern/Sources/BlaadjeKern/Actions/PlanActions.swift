/** Het wisselplan bijhouden, en een stap doorvoeren als de trainer het moment kiest. */
public enum PlanActions {
	/**
	 * Met `naDeel` is het een wissel in de pauze na dat deel; `minuut` is dan het
	 * einde ervan. Met soort 'ruil' wisselen twee spelers in het veld van plek.
	 */
	@discardableResult
	public static func voegToe(
		_ w: inout Match,
		minuut: Double,
		on: String,
		off: String,
		naDeel: Int? = nil,
		soort: PlanSoort? = nil,
		nieuwId: () -> String = IdGenerator.standaard("w")
	) -> Bool {
		if on.isEmpty || off.isEmpty || on == off || !minuut.isFinite || minuut < 0 { return false }
		var plan = w.plan ?? []
		plan.append(
			PlannedSub(
				id: nieuwId(),
				minuut: Int(jsRound(minuut)),
				on: on,
				off: off,
				naDeel: naDeel == 0 ? nil : naDeel,
				soort: soort
			)
		)
		w.plan = plan
		return true
	}

	@discardableResult
	public static func voegToe(
		_ w: inout Match?,
		minuut: Double,
		on: String,
		off: String,
		naDeel: Int? = nil,
		soort: PlanSoort? = nil,
		nieuwId: () -> String = IdGenerator.standaard("w")
	) -> Bool {
		met(&w) { voegToe(&$0, minuut: minuut, on: on, off: off, naDeel: naDeel, soort: soort, nieuwId: nieuwId) }
	}

	@discardableResult
	public static func haalWeg(_ w: inout Match, id: String) -> Bool {
		guard let plan = w.plan else { return false }
		w.plan = plan.filter { $0.id != id }
		return w.plan!.count < plan.count
	}

	@discardableResult
	public static func haalWeg(_ w: inout Match?, id: String) -> Bool {
		met(&w) { haalWeg(&$0, id: id) }
	}

	@discardableResult
	public static func slaOver(_ w: inout Match, id: String, overslaan: Bool = true) -> Bool {
		guard let i = w.plan?.firstIndex(where: { $0.id == id }) else { return false }
		w.plan![i].skipped = overslaan ? true : nil
		return true
	}

	@discardableResult
	public static func slaOver(_ w: inout Match?, id: String, overslaan: Bool = true) -> Bool {
		met(&w) { slaOver(&$0, id: id, overslaan: overslaan) }
	}

	/**
	 * De stap doorvoeren: een gewone wissel, met alles wat daarbij hoort in het
	 * verloop. Alleen na de aftrap, want daarvoor is het opstellen en geen wissel,
	 * en alleen als hij kan; anders gebeurt er niets.
	 */
	@discardableResult
	public static func voerUit(_ w: inout Match, nu: Double, id: String) -> Bool {
		guard let s = planStappen(w, nu: nu).first(where: { $0.stap.id == id }),
			ClockActions.kickedOff(w), s.status == .open, s.kanNiet == nil, let positie = s.positie.gevuld
		else { return false }
		if s.stap.soort == .ruil {
			guard let positieOn = s.positieOn.gevuld else { return false }
			return MatchEventActions.ruil(&w, nu: nu, positieOn, positie)
		}
		return MatchEventActions.putOnPosition(&w, nu: nu, position: positie, spelerId: s.stap.on)
	}

	@discardableResult
	public static func voerUit(_ w: inout Match?, nu: Double, id: String) -> Bool {
		met(&w) { voerUit(&$0, nu: nu, id: id) }
	}
}
