import Testing
@testable import BlaadjeKern

/*
 * Het wisselplan is een spiekbriefje. Wat er echt gebeurde blijft de waarheid:
 * een stap is gedaan als die wissel in het verloop staat, ook als je hem met de
 * hand deed, en weer open als je hem ongedaan maakt.
 */

private func wedstrijd(_ minuten: Double = 0) -> Match {
	Match(
		date: "2026-09-20",
		opponent: "De nummer 1",
		home: false,
		formation: "1-2-2-1",
		lineup: ["K": "kasper", "LV": "gijs", "RV": "jack", "ML": "zenith", "MR": "daanish", "SP": "max"],
		bench: ["maher", "alain"],
		events: [MatchEvent(type: .start, t: 0)],
		elapsed: minuten * 60,
		since: nil,
		running: false,
		parts: 2,
		part: 1,
		inBreak: false,
		finished: false,
		absent: ["siem"]
	)
}

/* Ids die bij elke run hetzelfde zijn, in plaats van de klok en het toeval. */
@discardableResult
private func voegToe(
	_ w: inout Match,
	_ minuut: Double,
	_ on: String,
	_ off: String,
	_ naDeel: Int? = nil,
	_ soort: PlanSoort? = nil
) -> Bool {
	let nummer = w.plan?.count ?? 0
	return PlanActions.voegToe(&w, minuut: minuut, on: on, off: off, naDeel: naDeel, soort: soort) { "w\(nummer)" }
}

@Suite("het wisselplan")
struct WisselplanTests {
	@Test("zet de stappen op volgorde van minuut")
	func opVolgorde() {
		var w = wedstrijd()
		voegToe(&w, 35, "maher", "kasper")
		voegToe(&w, 25, "alain", "max")
		#expect(planStappen(w, nu: NU).map(\.stap.minuut) == [25, 35])
		#expect(volgendeStap(w, nu: NU)?.stap.on == "alain")
	}

	@Test("weet waar hij erin komt: op de plek waar de ander nu staat")
	func waarHijErinKomt() {
		var w = wedstrijd()
		voegToe(&w, 25, "alain", "max")
		#expect(volgendeStap(w, nu: NU)?.positie == "SP")
		/* Max is intussen naar links geschoven: dan komt Alain daar */
		w.lineup["SP"] = "zenith"
		w.lineup["ML"] = "max"
		#expect(volgendeStap(w, nu: NU)?.positie == "ML")
	}

	@Test("zegt wanneer hij aan de beurt is, maar dwingt niets af")
	func aanDeBeurt() {
		var w = wedstrijd(20)
		voegToe(&w, 25, "alain", "max")
		#expect(volgendeStap(w, nu: NU)?.aanDeBeurt == false)
		w.elapsed = 27 * 60
		#expect(volgendeStap(w, nu: NU)?.aanDeBeurt == true)
		/* en er is niets gewisseld */
		#expect(w.lineup["SP"] == "max")
	}

	@Test("voert een stap door als een gewone wissel, met verloop en al")
	func voertDoor() throws {
		var w = wedstrijd(26)
		voegToe(&w, 25, "alain", "max")
		#expect(PlanActions.voerUit(&w, nu: NU, id: w.plan![0].id) == true)
		#expect(w.lineup["SP"] == "alain")
		#expect(w.bench.contains("max"))
		let laatste = try #require(w.events.last)
		#expect(laatste == MatchEvent(type: .substitution, t: 26 * 60, off: "max", on: "alain", position: "SP"))
		#expect(volgendeStap(w, nu: NU) == nil)
		#expect(planStappen(w, nu: NU)[0].status == .gedaan)
	}

	@Test("telt een wissel die je met de hand deed ook als gedaan")
	func metDeHand() {
		var w = wedstrijd(26)
		voegToe(&w, 25, "alain", "max")
		w.lineup["SP"] = "alain"
		w.events.append(MatchEvent(type: .substitution, t: 1500, off: "max", on: "alain", position: "SP"))
		#expect(planStappen(w, nu: NU)[0].status == .gedaan)
	}

	@Test("zet een stap weer open als je de wissel ongedaan maakt")
	func ongedaan() {
		var w = wedstrijd(26)
		voegToe(&w, 25, "alain", "max")
		PlanActions.voerUit(&w, nu: NU, id: w.plan![0].id)
		MatchEventActions.undoLast(&w)
		#expect(volgendeStap(w, nu: NU)?.stap.on == "alain")
		#expect(w.lineup["SP"] == "max")
	}

	/* De keeperwissel in de rust: eerst Maher in het doel, dan Kasper het veld in. */
	@Test("kan een tweede stap pas doen als de eerste gedaan is")
	func tweedeStap() {
		var w = wedstrijd(35)
		voegToe(&w, 35, "maher", "kasper")
		voegToe(&w, 35, "kasper", "zenith")
		let stappen = planStappen(w, nu: NU)
		let (eerste, tweede) = (stappen[0], stappen[1])
		#expect(eerste.kanNiet == nil)
		#expect(tweede.kanNiet == .alInHetVeld)
		PlanActions.voerUit(&w, nu: NU, id: eerste.stap.id)
		#expect(volgendeStap(w, nu: NU) != nil)
		#expect(volgendeStap(w, nu: NU)?.kanNiet == nil)
		PlanActions.voerUit(&w, nu: NU, id: tweede.stap.id)
		#expect(w.lineup["K"] == "maher")
		#expect(w.lineup["ML"] == "kasper")
		#expect(w.bench.contains("zenith"))
	}

	@Test("zegt waarom een stap niet kan")
	func waaromNiet() {
		var w = wedstrijd(30)
		voegToe(&w, 25, "siem", "max")
		voegToe(&w, 26, "alain", "maher")
		let stappen = planStappen(w, nu: NU)
		let (afwezig, weg) = (stappen[0], stappen[1])
		#expect(afwezig.kanNiet == .afwezig)
		/* Maher staat niet in het veld, dus voor hem kan niemand erin */
		#expect(weg.kanNiet == .nietInHetVeld)
		#expect(PlanActions.voerUit(&w, nu: NU, id: afwezig.stap.id) == false)
		#expect(w.lineup["SP"] == "max")
	}

	@Test("slaat een stap over, en kan dat terugdraaien")
	func overslaan() {
		var w = wedstrijd()
		voegToe(&w, 25, "alain", "max")
		voegToe(&w, 30, "maher", "gijs")
		PlanActions.slaOver(&w, id: w.plan![0].id)
		#expect(volgendeStap(w, nu: NU)?.stap.on == "maher")
		#expect(nogOpen(w, nu: NU) == 1)
		PlanActions.slaOver(&w, id: w.plan![0].id, overslaan: false)
		#expect(nogOpen(w, nu: NU) == 2)
	}

	@Test("wisselt nooit vóór de aftrap")
	func nooitVoorDeAftrap() {
		var w = wedstrijd()
		w.events = []
		voegToe(&w, 0, "alain", "max")
		#expect(PlanActions.voerUit(&w, nu: NU, id: w.plan![0].id) == false)
		#expect(w.lineup["SP"] == "max")
	}

	@Test("weigert een stap zonder zin")
	func zonderZin() {
		var w = wedstrijd()
		#expect(voegToe(&w, 25, "max", "max") == false)
		#expect(voegToe(&w, -1, "alain", "max") == false)
		#expect(voegToe(&w, 25, "", "max") == false)
		#expect((w.plan ?? []) == [])
	}

	@Test("haalt een stap weg")
	func haaltWeg() {
		var w = wedstrijd()
		voegToe(&w, 25, "alain", "max")
		PlanActions.haalWeg(&w, id: w.plan![0].id)
		#expect(w.plan == [])
	}

	@Test("is leeg zonder plan")
	func leeg() {
		#expect(planStappen(wedstrijd(), nu: NU) == [])
		#expect(volgendeStap(nil, nu: NU) == nil)
	}
}

@Suite("wie er rond een minuut staat")
struct StandOpTests {
	@Test("is bij minuut 0 de opstelling van nu")
	func minuutNul() {
		var w = wedstrijd()
		w.events = []
		let s = standOp(w, 0)
		#expect(s.bank == ["maher", "alain"])
		#expect(s.veld.first { $0.plek == "K" }?.id == "kasper")
	}

	@Test("past de geplande stappen tot en met die minuut toe")
	func totEnMet() {
		var w = wedstrijd()
		w.events = []
		voegToe(&w, 25, "alain", "max")
		voegToe(&w, 50, "max", "jack")
		#expect(standOp(w, 20).bank.contains("alain"))
		#expect(standOp(w, 25).bank == ["maher", "max"])
		#expect(standOp(w, 25).veld.first { $0.plek == "SP" }?.id == "alain")
		#expect(standOp(w, 50).veld.first { $0.plek == "RV" }?.id == "max")
	}

	/* De keeperwissel in de rust: daarna staat Kasper op de bank en kan hij weer het veld in. */
	@Test("rekent stappen in dezelfde minuut na elkaar door")
	func zelfdeMinuut() {
		var w = wedstrijd()
		w.events = []
		voegToe(&w, 35, "maher", "kasper")
		let s = standOp(w, 35)
		#expect(s.bank.contains("kasper"))
		#expect(s.veld.first { $0.plek == "K" }?.id == "maher")
	}

	@Test("telt een overgeslagen stap niet, en een gedane zit al in de opstelling")
	func overgeslagenEnGedaan() {
		var w = wedstrijd(30)
		voegToe(&w, 25, "alain", "max")
		voegToe(&w, 26, "maher", "gijs")
		PlanActions.voerUit(&w, nu: NU, id: w.plan![0].id)
		PlanActions.slaOver(&w, id: w.plan![1].id)
		let s = standOp(w, 40)
		#expect(s.veld.first { $0.plek == "SP" }?.id == "alain")
		#expect(s.veld.first { $0.plek == "LV" }?.id == "gijs")
	}

	@Test("slaat een stap die niet kan over in plaats van te gokken")
	func nietGokken() {
		var w = wedstrijd()
		w.events = []
		voegToe(&w, 25, "alain", "maher")
		#expect(standOp(w, 30).bank == ["maher", "alain"])
	}
}

@Suite("een wissel in de pauze")
struct PauzewisselTests {
	/* De rust valt zelden op 35:00 precies. Hij is aan de beurt als je de rust aantikt. */
	@Test("is aan de beurt zodra de pauze er is, niet op de klok")
	func zodraDePauzeErIs() {
		var w = wedstrijd(36)
		voegToe(&w, 35, "maher", "kasper", 1)
		#expect(volgendeStap(w, nu: NU)?.aanDeBeurt == false)
		w.inBreak = true
		#expect(volgendeStap(w, nu: NU)?.aanDeBeurt == true)
		/* en ook als het volgende deel al begonnen is */
		w.inBreak = false
		w.part = 2
		#expect(volgendeStap(w, nu: NU)?.aanDeBeurt == true)
	}

	@Test("zegt wanneer, zoals je het zegt")
	func wanneerTekst() {
		#expect(wanneer(PlannedSub(id: "x", minuut: 25, on: "a", off: "b"), 2) == "25′")
		#expect(wanneer(PlannedSub(id: "x", minuut: 35, on: "a", off: "b", naDeel: 1), 2) == "Rust")
		#expect(wanneer(PlannedSub(id: "x", minuut: 15, on: "a", off: "b", naDeel: 1), 4) == "Pauze na 1e kwart")
		#expect(wanneer(PlannedSub(id: "x", minuut: 30, on: "a", off: "b", naDeel: 2), 4) == "Rust")
	}
}

/* De keeperwissel met een veldspeler: geen wissel met de bank, maar ruilen. */
@Suite("twee spelers die van plek ruilen")
struct PlanRuilTests {
	@Test("ruilt ze als het moment er is, met een ruil in het verloop")
	func ruilt() throws {
		var w = wedstrijd(35)
		voegToe(&w, 35, "zenith", "kasper", 1, .ruil)
		let stap = try #require(volgendeStap(w, nu: NU))
		#expect(stap.kanNiet == nil)
		#expect(PlanActions.voerUit(&w, nu: NU, id: stap.stap.id) == true)
		#expect(w.lineup["K"] == "zenith")
		#expect(w.lineup["ML"] == "kasper")
		#expect(w.bench == ["maher", "alain"])
		let laatste = try #require(w.events.last)
		#expect(laatste.type == .swap)
		#expect(laatste.playerA == "zenith")
		#expect(laatste.playerB == "kasper")
		#expect(volgendeStap(w, nu: NU) == nil)
	}

	@Test("telt een ruil die je met de hand deed ook, in welke volgorde ook")
	func metDeHand() {
		var w = wedstrijd(35)
		voegToe(&w, 35, "zenith", "kasper", 1, .ruil)
		w.events.append(
			MatchEvent(type: .swap, t: 2100, positionA: "K", positionB: "ML", playerA: "kasper", playerB: "zenith")
		)
		#expect(planStappen(w, nu: NU)[0].status == .gedaan)
	}

	@Test("kan niet als een van beiden niet in het veld staat")
	func nietBeiden() {
		var w = wedstrijd(35)
		voegToe(&w, 35, "maher", "kasper", 1, .ruil)
		#expect(planStappen(w, nu: NU)[0].kanNiet == .nietBeideInHetVeld)
		#expect(PlanActions.voerUit(&w, nu: NU, id: w.plan![0].id) == false)
	}

	@Test("rekent de ruil mee in wie er daarna waar staat")
	func daarna() {
		var w = wedstrijd()
		w.events = []
		voegToe(&w, 35, "zenith", "kasper", 1, .ruil)
		let s = standOp(w, 35)
		#expect(s.veld.first { $0.plek == "K" }?.id == "zenith")
		#expect(s.veld.first { $0.plek == "ML" }?.id == "kasper")
		#expect(s.bank == ["maher", "alain"])
	}
}

/* Na een rommelige wedstrijd met wissels die niet gepland waren. */
@Suite("als er veel anders ging dan gepland")
struct AndersDanGeplandTests {
	@Test("schuift een stap die niet meer kan stil opzij")
	func stilOpzij() {
		var w = wedstrijd(30)
		voegToe(&w, 25, "alain", "maher") /* Maher staat niet in het veld */
		voegToe(&w, 28, "alain", "max")
		#expect(volgendeStap(w, nu: NU)?.stap.off == "max")
		#expect(nogOpen(w, nu: NU) == 1)
		/* en in het plan staat hij er nog, met de reden */
		#expect(planStappen(w, nu: NU)[0].status == .open)
		#expect(planStappen(w, nu: NU)[0].kanNiet == .nietInHetVeld)
	}

	@Test("laat een opzij geschoven stap terugkomen als hij weer kan")
	func komtTerug() {
		var w = wedstrijd(30)
		voegToe(&w, 25, "alain", "maher")
		#expect(volgendeStap(w, nu: NU) == nil)
		/* Maher komt alsnog het veld in */
		w.lineup["SP"] = "maher"
		w.bench = ["alain", "max"]
		w.events.append(MatchEvent(type: .substitution, t: 1800, off: "max", on: "maher", position: "SP"))
		#expect(volgendeStap(w, nu: NU)?.stap.on == "alain")
	}

	@Test("zegt het als wie eruit moet er pas net in kwam")
	func pasNet() {
		var w = wedstrijd(30)
		w.lineup["SP"] = "alain"
		w.bench = ["maher", "max"]
		w.events.append(MatchEvent(type: .substitution, t: 26 * 60, off: "max", on: "alain", position: "SP"))
		voegToe(&w, 28, "max", "alain")
		voegToe(&w, 29, "maher", "gijs")
		let stappen = planStappen(w, nu: NU)
		let (terug, gewoon) = (stappen[0], stappen[1])
		#expect(terug.kanNiet == nil)
		/* Alain kwam 4 minuten geleden in, Max ging er 4 minuten geleden uit */
		#expect(terug.pasErin == 4)
		#expect(terug.pasEruit == 4)
		#expect(gewoon.pasErin == nil)
		#expect(gewoon.pasEruit == nil)
	}

	@Test("vindt tien minuten geleden niet meer opvallend")
	func tienMinuten() {
		var w = wedstrijd(40)
		w.lineup["SP"] = "alain"
		w.bench = ["maher", "max"]
		w.events.append(MatchEvent(type: .substitution, t: 30 * 60, off: "max", on: "alain", position: "SP"))
		voegToe(&w, 40, "maher", "alain")
		#expect(planStappen(w, nu: NU)[0].pasErin == nil)
	}

	/* In het plan zelf telt het moment van de stap, niet hoe het nu staat. */
	@Test("beoordeelt een stap in het plan op zijn eigen moment")
	func eigenMoment() {
		var w = wedstrijd()
		w.events = []
		voegToe(&w, 35, "maher", "kasper", 1)
		voegToe(&w, 35, "kasper", "zenith", 1)
		voegToe(&w, 40, "siem", "max")
		let stappen = planStappen(w, nu: NU).map(\.stap)
		let (eerste, tweede, derde) = (stappen[0], stappen[1], stappen[2])
		#expect(kanNietOpMoment(w, eerste) == nil)
		/* nu staat Kasper nog in het doel, maar na de eerste stap zit hij op de bank */
		#expect(planStappen(w, nu: NU)[1].kanNiet == .alInHetVeld)
		#expect(kanNietOpMoment(w, tweede) == nil)
		#expect(kanNietOpMoment(w, derde) == .afwezig)
	}
}

@Suite("wanneer een stap in beeld komt")
struct InBeeldTests {
	@Test("vanaf vijf minuten ervoor, en natuurlijk als hij aan de beurt is")
	func vijfMinuten() {
		var w = wedstrijd(19)
		voegToe(&w, 25, "alain", "max")
		#expect(volgendeStap(w, nu: NU)?.inZicht == false)
		w.elapsed = 20 * 60
		#expect(volgendeStap(w, nu: NU)?.inZicht == true)
	}

	@Test("een pauzewissel zodra de pauze er is, ook als die vroeg valt")
	func vroegePauze() {
		var w = wedstrijd(10)
		voegToe(&w, 35, "maher", "kasper", 1)
		#expect(volgendeStap(w, nu: NU)?.inZicht == false)
		w.inBreak = true
		#expect(volgendeStap(w, nu: NU)?.inZicht == true)
	}
}

/* Toegevoegd bij de overzetting naar Swift: plan-tekst.ts heeft in de webapp
   geen eigen tests, alleen de schermen die hem gebruiken. */
@Suite("een stap in woorden")
struct PlanTekstTests {
	private let namen = ["alain": "Alain", "max": "Max", "maher": "Maher", "kasper": "Kasper"]
	private func naam(_ id: String) -> String { namen[id] ?? id }

	@Test("noemt de plek erbij als hij die weet")
	func metPlek() {
		let stap = PlannedSub(id: "x", minuut: 25, on: "alain", off: "max")
		#expect(stapTekst(stap, naam: naam, plek: { $0 == "max" ? "SP" : nil }) == "Alain voor Max (SP)")
		#expect(stapTekst(stap, naam: naam, plek: { _ in nil }) == "Alain voor Max")
	}

	@Test("zegt bij een ruil wie waarheen gaat")
	func ruil() {
		let stap = PlannedSub(id: "x", minuut: 35, on: "maher", off: "kasper", soort: .ruil)
		let plekken = ["maher": "LM", "kasper": "K"]
		#expect(stapTekst(stap, naam: naam, plek: { plekken[$0] }) == "Kasper naar LM, Maher naar K")
		#expect(stapTekst(stap, naam: naam, plek: { _ in nil }) == "Kasper en Maher ruilen van plek")
	}

	@Test("zegt waarom een stap niet kan, en niets als hij kan")
	func reden() {
		let stap = PlannedSub(id: "x", minuut: 25, on: "alain", off: "max")
		#expect(redenTekst(.afwezig, stap, naam: naam) == "Alain is er niet")
		#expect(redenTekst(.alInHetVeld, stap, naam: naam) == "Alain staat al in het veld")
		#expect(redenTekst(.nietInHetVeld, stap, naam: naam) == "Max staat niet in het veld")
		#expect(redenTekst(.nietBeideInHetVeld, stap, naam: naam) == "Max en Alain staan niet allebei in het veld")
		#expect(redenTekst(nil, stap, naam: naam) == "")
	}
}
