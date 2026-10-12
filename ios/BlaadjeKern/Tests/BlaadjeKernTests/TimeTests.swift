import Testing
@testable import BlaadjeKern

private let NAMEN = ["Gijs", "Jack", "Maher", "Daan", "Mirza", "Siem", "Kasper", "Daanish", "Mauro", "Max", "Simon", "Amir"]
private let players: [Player] = NAMEN.map { Player(id: "p" + $0, name: $0, line: .geen) }

private func match() -> Match {
	var lineup = Lineup()
	for (i, p) in FORMATIONS["4-3-3"]!.enumerated() { lineup[p.id] = players[i].id }
	return Match(
		date: "2026-09-06",
		opponent: "Test",
		home: true,
		formation: "4-3-3",
		lineup: lineup,
		bench: ["pAmir"],
		events: [MatchEvent(type: .start, t: 0)],
		elapsed: 4200,
		since: nil,
		running: false,
		parts: 2,
		part: 2,
		inBreak: false,
		finished: true
	)
}

@Suite("speeltijd")
struct SpeeltijdTests {
	@Test("telt een wedstrijd zonder wissels als elf keer de speelduur")
	func zonderWissels() {
		var w = match()
		w.events.append(MatchEvent(type: .end, t: 4200))
		let t = playingTimes(w, players, nu: NU)
		#expect(t["pGijs"] == 4200)
		#expect(t["pAmir"] == 0)
		#expect(som(t) == 11 * 4200)
	}

	@Test("verdeelt de tijd over een wissel")
	func overEenWissel() {
		var w = match()
		w.lineup["SP"] = "pAmir"
		w.bench = ["pMax"]
		w.events.append(MatchEvent(type: .substitution, t: 1200, off: "pMax", on: "pAmir", position: "SP"))
		w.events.append(MatchEvent(type: .end, t: 4200))
		let t = playingTimes(w, players, nu: NU)
		#expect(t["pMax"] == 1200)
		#expect(t["pAmir"] == 3000)
		#expect(som(t) == 11 * 4200)
	}

	@Test("houdt keeperminuten apart als er bij rust gedraaid wordt")
	func keeperminuten() {
		/* Gijs keept de eerste helft, gaat daarna linksback spelen.
		   Amir komt in het doel. Jouw regel: wie keept, speelt de rest volledig. */
		var w = match()
		w.lineup["K"] = "pAmir"
		w.lineup["LV"] = "pGijs"
		w.bench = ["pMirza"]
		w.events += [
			MatchEvent(type: .break, t: 2100),
			MatchEvent(type: .substitution, t: 2100, off: "pGijs", on: "pAmir", position: "K"),
			MatchEvent(type: .substitution, t: 2100, off: "pMirza", on: "pGijs", position: "LV"),
			MatchEvent(type: .end, t: 4200),
		]
		let t = playingTimes(w, players, nu: NU)
		let k = keeperTimes(w, nu: NU)
		#expect(t["pGijs"] == 4200)
		#expect(k["pGijs"] == 2100)
		#expect(t["pAmir"] == 2100)
		#expect(k["pAmir"] == 2100)
		#expect(t["pMirza"] == 2100)
		#expect(k["pMirza"] == nil)
		#expect(som(t) == 11 * 4200)
	}

	@Test("laat geen plek onbezet als een wissel geen plek meekreeg")
	func wisselZonderPlek() {
		var w = match()
		w.lineup["SP"] = "pAmir"
		w.bench = ["pMax"]
		w.events.append(MatchEvent(type: .substitution, t: 2000, off: "pMax", on: "pAmir"))
		w.events.append(MatchEvent(type: .end, t: 4200))
		#expect(fieldIntervals(w, nu: NU).count == 12)
		#expect(som(playingTimes(w, players, nu: NU)) == 11 * 4200)
	}
}

@Suite("van plek ruilen tijdens de wedstrijd")
struct RuilenTijdTests {
	/* The rule here: whoever keeps one half plays the other half outfield. At
	   half-time you usually swap with someone already on the pitch. */
	@Test("houdt de totale tijd gelijk en telt alleen het doel apart")
	func totaalGelijk() {
		var w = match()
		/* Gijs kept the first half; at half-time he swaps with Kasper (midfield) */
		w.lineup["K"] = "pKasper"
		w.lineup["MC"] = "pGijs"
		w.events += [
			MatchEvent(type: .break, t: 2100),
			MatchEvent(type: .swap, t: 2100, positionA: "K", positionB: "MC"),
			MatchEvent(type: .end, t: 4200),
		]
		let t = playingTimes(w, players, nu: NU)
		let k = keeperTimes(w, nu: NU)
		#expect(t["pGijs"] == 4200)
		#expect(t["pKasper"] == 4200)
		#expect(k["pGijs"] == 2100)
		#expect(k["pKasper"] == 2100)
		#expect(som(t) == 11 * 4200)
	}

	@Test("werkt ook als er daarna nog gewisseld wordt")
	func daarnaGewisseld() {
		var w = match()
		w.lineup["K"] = "pKasper"
		w.lineup["MC"] = "pAmir"
		w.bench = ["pGijs"]
		w.events += [
			MatchEvent(type: .swap, t: 2100, positionA: "K", positionB: "MC"),
			MatchEvent(type: .substitution, t: 3000, off: "pGijs", on: "pAmir", position: "MC"),
			MatchEvent(type: .end, t: 4200),
		]
		let t = playingTimes(w, players, nu: NU)
		let k = keeperTimes(w, nu: NU)
		#expect(k["pGijs"] == 2100) /* eerste helft in het doel */
		#expect(t["pGijs"] == 3000) /* daarna middenveld tot minuut 50 */
		#expect(t["pAmir"] == 1200)
		#expect(k["pKasper"] == 2100)
		#expect(som(t) == 11 * 4200)
	}
}

@Suite("kleinere speelvormen")
struct KleinereSpeelvormenTests {
	/* De rekenkern telt nergens tot elf: hij volgt de plekken uit de formatie. */
	@Test("rekent 8 tegen 8 net zo goed door")
	func achtTegenAcht() {
		let kort: [Player] = NAMEN.prefix(10).map { Player(id: "p" + $0, name: $0, line: .geen) }
		var lineup = Lineup()
		for (i, p) in FORMATIONS["1-3-3-1"]!.enumerated() { lineup[p.id] = kort[i].id }
		let w = Match(
			date: "2026-09-06",
			opponent: "Test",
			home: true,
			formation: "1-3-3-1",
			lineup: lineup,
			bench: [kort[8].id, kort[9].id],
			events: [
				MatchEvent(type: .start, t: 0),
				MatchEvent(type: .substitution, t: 1200, off: kort[7].id, on: kort[8].id, position: "SP"),
				MatchEvent(type: .swap, t: 1800, positionA: "K", positionB: "MC"),
				MatchEvent(type: .end, t: 3600),
			],
			elapsed: 3600,
			since: nil,
			running: false,
			parts: 2,
			part: 2,
			inBreak: false,
			finished: true
		)
		let t = playingTimes(w, kort, nu: NU)
		let k = keeperTimes(w, nu: NU)
		#expect(som(t) == 8 * 3600)
		#expect(t["p" + NAMEN[7]] == 1200)
		#expect(k["p" + NAMEN[0]] == 1800) /* keepte tot de ruil */
	}

	@Test("werkt ook zonder keeper, bij 4 tegen 4")
	func vierTegenVier() {
		let kort: [Player] = NAMEN.prefix(5).map { Player(id: "p" + $0, name: $0, line: .geen) }
		var lineup = Lineup()
		for (i, p) in FORMATIONS["2-2"]!.enumerated() { lineup[p.id] = kort[i].id }
		let w = Match(
			date: "2026-09-06",
			opponent: "Test",
			home: true,
			formation: "2-2",
			lineup: lineup,
			bench: [kort[4].id],
			events: [
				MatchEvent(type: .start, t: 0),
				MatchEvent(type: .end, t: 1800),
			],
			elapsed: 1800,
			since: nil,
			running: false,
			parts: 2,
			part: 2,
			inBreak: false,
			finished: true
		)
		#expect(som(playingTimes(w, kort, nu: NU)) == 4 * 1800)
		#expect(keeperTimes(w, nu: NU).isEmpty)
	}
}

@Suite("wie waar stond")
struct WieWaarStondTests {
	@Test("telt de minuten per plek")
	func perPlek() {
		var w = match()
		w.lineup["K"] = "pAmir"
		w.lineup["LV"] = "pGijs"
		w.bench = ["pMirza"]
		w.events += [
			MatchEvent(type: .substitution, t: 2100, off: "pGijs", on: "pAmir", position: "K"),
			MatchEvent(type: .substitution, t: 2100, off: "pMirza", on: "pGijs", position: "LV"),
			MatchEvent(type: .end, t: 4200),
		]
		let p = positionTimes(w, nu: NU)
		#expect(p["pGijs"]?.dictionary == ["K": 2100, "LV": 2100])
		#expect(p["pMirza"]?.dictionary == ["LV": 2100])
	}

	@Test("schrijft het leesbaar op, langste plek eerst")
	func leesbaar() {
		#expect(positionText(["LV": 2100, "K": 900], "4-3-3") == "35 min LV · 15 min K")
		#expect(positionText([:], "4-3-3") == "")
		#expect(positionText(nil, "4-3-3") == "")
	}

	@Test("vat samen als iemand overal gestaan heeft")
	func overig() {
		let tekst = positionText(["K": 600, "LV": 500, "MC": 400, "SP": 300, "RV": 200], "4-3-3")
		#expect(tekst == "10 min K · 8 min LV · 7 min M · 8 min overig")
	}

	/* Toegevoegd bij de overzetting naar Swift: twee plekken even lang houden de
	   volgorde waarin hij er stond, zoals een JavaScript-object dat doet. */
	@Test("houdt bij gelijke tijd de volgorde waarin hij er stond")
	func gelijkeTijd() {
		#expect(positionText(["K": 2100, "LV": 2100], "4-3-3") == "35 min K · 35 min LV")
		#expect(positionText(["LV": 2100, "K": 2100], "4-3-3") == "35 min LV · 35 min K")
	}
}

@Suite("de klok lezen")
struct KlokLezenTests {
	/* Toegevoegd bij de overzetting naar Swift: de webapp test dit via de schermen. */
	@Test("schrijft seconden als minuten en seconden")
	func minutenEnSeconden() {
		#expect(mmss(0) == "00:00")
		#expect(mmss(65) == "01:05")
		#expect(mmss(4200) == "70:00")
		#expect(mmss(59.9) == "00:59")
	}

	@Test("telt de lopende periode mee, in hele seconden")
	func lopendePeriode() {
		var w = match()
		w.finished = false
		w.elapsed = 100
		w.running = true
		w.since = NU - 2500
		#expect(elapsed(w, nu: NU) == 102)
		#expect(elapsed(nil, nu: NU) == 0)
	}

	@Test("zet de thuisploeg voorop")
	func thuisVoorop() {
		#expect(homeFirst([3, 5], true) == [3, 5])
		#expect(homeFirst([3, 5], false) == [5, 3])
	}
}
