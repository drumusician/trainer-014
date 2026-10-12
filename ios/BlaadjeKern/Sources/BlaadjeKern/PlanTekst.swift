/**
 * Een stap uit het wisselplan in woorden, met de plekken erbij zoals ze op dat
 * moment zijn: 'Alain voor Max (SP)', of bij een ruil 'Maher naar K, Kasper naar
 * LM'. Zonder plekken (al gedaan, of hij kan niet meer) de kale tekst.
 *
 * `plek` geeft het label van waar iemand staat, of nil.
 */
public func stapTekst(_ stap: PlannedSub, naam: (String) -> String, plek: (String) -> String?) -> String {
	let plekOff = plek(stap.off).gevuld
	if stap.soort == .ruil {
		if let plekOff, let plekOn = plek(stap.on).gevuld {
			return Tekst.Plan.swapTo(naam(stap.off), plekOn, naam(stap.on), plekOff)
		}
		return Tekst.Plan.swapStep(naam(stap.off), naam(stap.on))
	}
	if let plekOff { return Tekst.Plan.stepAt(naam(stap.on), naam(stap.off), plekOff) }
	return Tekst.Plan.step(naam(stap.on), naam(stap.off))
}

/** Waarom een stap niet kan, in woorden; leeg als hij wel kan. */
public func redenTekst(_ kanNiet: KanNiet?, _ stap: PlannedSub, naam: (String) -> String) -> String {
	switch kanNiet {
	case .afwezig: return Tekst.Plan.absent(naam(stap.on))
	case .alInHetVeld: return Tekst.Plan.alreadyOn(naam(stap.on))
	case .nietInHetVeld: return Tekst.Plan.notOn(naam(stap.off))
	case .nietBeideInHetVeld: return Tekst.Plan.notBothOn(naam(stap.off), naam(stap.on))
	case nil: return ""
	}
}
