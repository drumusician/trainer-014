import Testing
@testable import BlaadjeKern

/* Het rooster: wie wanneer speelt, en of het eerlijk verdeeld is. */

private let spelers = ["kasper", "gijs", "jack", "zenith", "daanish", "max", "maher", "alain"].map { Player(id: $0, name: $0) }

private func wedstrijd(afgetrapt minuten: Double? = nil, parts: Int = 2) -> Match {
	Match(
		date: "2026-11-08",
		opponent: "Waterwijk",
		home: false,
		formation: "1-2-2-1",
		lineup: ["K": "kasper", "LV": "gijs", "RV": "jack", "ML": "zenith", "MR": "daanish", "SP": "max"],
		bench: ["maher", "alain"],
		events: minuten == nil ? [] : [MatchEvent(type: .start, t: 0)],
		elapsed: (minuten ?? 0) * 60,
		since: nil,
		running: false,
		parts: parts,
		part: 1,
		inBreak: false,
		finished: false,
		absent: ["siem"]
	)
}

@Suite("het rooster")
struct RoosterTests {
	@Test("hakt een wedstrijd in vieren: helften in tweeën, kwarten elk een blok")
	func inVieren() {
		let helften = roosterBlokken(parts: 2, minutesPerPart: 30)
		#expect(helften.map(\.start) == [0, 15, 30, 45])
		#expect(helften.map(\.naDeel) == [nil, nil, 1, nil])
		let kwarten = roosterBlokken(parts: 4, minutesPerPart: 15)
		#expect(kwarten.map(\.start) == [0, 15, 30, 45])
		#expect(kwarten.map(\.naDeel) == [nil, 1, 2, 3])
	}

	@Test("laat zonder plan zien wie de hele wedstrijd op de bank zit")
	func zonderPlan() {
		let r = rooster(wedstrijd(), spelers, minutesPerPart: 30, nu: 0)
		#expect(r.blokken.count == 4)
		#expect(r.regels.map(\.id) == ["kasper", "gijs", "jack", "zenith", "daanish", "max", "maher", "alain"])
		#expect(r.regels[1].plekken == ["LV", "LV", "LV", "LV"])
		#expect(r.regels[1].minuten == 60)
		#expect(r.regels[6].plekken == [nil, nil, nil, nil])
		#expect(r.regels[6].minuten == 0)
		#expect(r.eerlijk == 45, "zes plekken, acht spelers, zestig minuten")
		#expect(r.regels[6].weinig)
		#expect(!r.regels[1].weinig)
	}

	@Test("een wissel op de grens van een blok, en dezelfde tik andersom maakt hem ongedaan")
	func wisselen() throws {
		var w = wedstrijd()
		let r = rooster(w, spelers, minutesPerPart: 30, nu: 0)
		#expect(PlanActions.wisselInRooster(&w, r.blokken[1], "gijs", "maher") { "s1" })
		#expect(w.plan?.first?.minuut == 15)
		#expect(w.plan?.first?.naDeel == nil)
		var na = rooster(w, spelers, minutesPerPart: 30, nu: 0)
		#expect(na.regels[1].plekken == ["LV", nil, nil, nil])
		#expect(na.regels[1].minuten == 15)
		#expect(na.regels[6].plekken == [nil, "LV", "LV", "LV"])
		#expect(na.regels[6].minuten == 45)

		// In de rust komt Gijs terug, voor Maher: een pauzewissel.
		#expect(PlanActions.wisselInRooster(&w, na.blokken[2], "maher", "gijs") { "s2" })
		#expect(w.plan?.last?.naDeel == 1)
		na = rooster(w, spelers, minutesPerPart: 30, nu: 0)
		#expect(na.regels[1].minuten == 45)
		#expect(na.regels[6].minuten == 15)

		// Nog eens dezelfde tik in de rust: weg.
		#expect(PlanActions.wisselInRooster(&w, na.blokken[2], "gijs", "maher"))
		#expect(w.plan?.map(\.id) == ["s1"])
	}

	@Test("twee uit het veld, of het begin, is geen wissel")
	func geenWissel() {
		var w = wedstrijd()
		let r = rooster(w, spelers, minutesPerPart: 30, nu: 0)
		#expect(!PlanActions.wisselInRooster(&w, r.blokken[1], "gijs", "jack"))
		#expect(!PlanActions.wisselInRooster(&w, r.blokken[0], "gijs", "maher"), "het begin is de opstelling")
		#expect(w.plan == nil)
	}

	@Test("na de aftrap telt wat gespeeld is, en wat voorbij is valt weg")
	func naDeAftrap() {
		var w = wedstrijd(afgetrapt: 20)
		_ = PlanActions.voegToe(&w, minuut: 30, on: "maher", off: "gijs", naDeel: 1) { "s1" }
		let r = rooster(w, spelers, minutesPerPart: 30, nu: 0)
		#expect(r.blokken.map(\.start) == [15, 30, 45])
		#expect(r.blokken.map(\.teVeranderen) == [false, true, true])
		#expect(r.regels[1].minuten == 30, "twintig gespeeld, nog tien tot de rust")
		#expect(r.regels[6].minuten == 30)
	}
}
