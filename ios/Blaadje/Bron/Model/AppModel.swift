import BlaadjeKern
import Foundation
import Observation

/// Alles wat de app onthoudt, en wat een tik ermee doet.
///
/// De regels zelf staan in BlaadjeKern en zijn daar getest. Hier staat alleen
/// het doorgeven: welke plek is gekozen, hoe laat is het, en bewaren na elke
/// wijziging.
@MainActor
@Observable
final class AppModel {
    private(set) var toestand: AppState
    /// Nu, in milliseconden. Loopt elke seconde mee zolang de klok loopt.
    private(set) var nu: Double = Date().timeIntervalSince1970 * 1000
    /// De plek op het veld waar je net op tikte.
    var gekozenPlek: String?

    private let bestand: URL?
    private var tikker: Timer?

    /// - Parameter bestand: waar de toestand bewaard wordt; `nil` bewaart niets (voor tests en voorbeelden).
    init(bestand: URL? = AppModel.standaardBestand, toestand: AppState? = nil) {
        self.bestand = bestand
        if let toestand {
            self.toestand = toestand
        } else if let bestand, let ruw = try? String(contentsOf: bestand, encoding: .utf8) {
            if let gelezen = try? Opslag.lees(ruw) {
                self.toestand = gelezen
            } else {
                // Er staat iets wat we niet kunnen lezen. Leeg beginnen mag, maar
                // dan eerst opzij zetten: anders schrijft de eerste tik eroverheen
                // en is een heel seizoen weg dat misschien nog te redden was.
                let opzij = bestand.deletingLastPathComponent()
                    .appendingPathComponent("blaadje-onleesbaar-\(Int(Date().timeIntervalSince1970)).json")
                try? FileManager.default.moveItem(at: bestand, to: opzij)
                self.toestand = emptyState()
            }
        } else {
            self.toestand = emptyState()
        }
        regelTikker()
    }

    nonisolated static var standaardBestand: URL? {
        guard let map = try? FileManager.default.url(
            for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
        else { return nil }
        return map.appendingPathComponent("blaadje.json")
    }

    // MARK: - bewaren en de tijd

    /// Na elke wijziging. Eerst naar een tijdelijk bestand en dan omzetten, zodat
    /// een telefoon die halverwege uitvalt nooit een half bestand achterlaat.
    private func bewaar() {
        regelTikker()
        guard let bestand else { return }
        try? Opslag.schrijf(toestand).write(to: bestand, atomically: true, encoding: .utf8)
    }

    private var echtNu: Double { Date().timeIntervalSince1970 * 1000 }

    var vandaag: String {
        let f = DateFormatter()
        f.calendar = Calendar(identifier: .gregorian)
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "yyyy-MM-dd"
        return f.string(from: Date())
    }

    /// De klok rekent vanaf het moment van starten, dus hij klopt ook als de app
    /// op de achtergrond stond. De tikker is er alleen om het scherm bij te werken.
    private func regelTikker() {
        let moetLopen = toestand.match?.running == true
        if moetLopen, tikker == nil {
            tikker = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in
                Task { @MainActor in self?.nu = Date().timeIntervalSince1970 * 1000 }
            }
        } else if !moetLopen {
            tikker?.invalidate()
            tikker = nil
        }
    }

    /// Als de app weer in beeld komt: de tijd is intussen doorgelopen.
    func bijDeTijd() { nu = echtNu }

    // MARK: - lezen

    var match: Match? { toestand.match }
    var spelers: [Player] { toestand.players }
    var afgetrapt: Bool { ClockActions.kickedOff(toestand.match) }
    var kanVolgendDeel: Bool { ClockActions.canStartNextPart(toestand.match) }
    func speler(_ id: String?) -> Player? { SquadActions.playerById(toestand, id) }

    /// Seconden gespeeld per speler, in de wedstrijd van nu.
    var speeltijden: [String: Double] { playingTimes(toestand.match, toestand.players, nu: nu).dictionary }
    var keepertijden: [String: Double] { keeperTimes(toestand.match, nu: nu).dictionary }
    var verstreken: Double { elapsed(toestand.match, nu: nu) }
    var stand: Score { score(toestand.match) }
    var terugTeDraaien: String? { MatchEventActions.undoable(toestand.match) }

    // MARK: - team

    func voegSpelersToe(_ tekst: String) {
        SquadActions.addPlayerNames(&toestand, tekst)
        if toestand.match != nil { MatchActions.rebuildBench(&toestand) }
        bewaar()
    }

    func hernoem(_ id: String, _ naam: String) {
        guard let i = toestand.players.firstIndex(where: { $0.id == id }) else { return }
        SquadActions.renamePlayer(&toestand.players[i], naam)
        bewaar()
    }

    func verwijder(_ speler: Player) {
        SquadActions.removePlayer(&toestand, speler)
        bewaar()
    }

    func zetLinie(_ id: String, _ linie: FieldLine) {
        guard let i = toestand.players.firstIndex(where: { $0.id == id }) else { return }
        SquadActions.setLine(&toestand.players[i], linie)
        bewaar()
    }

    func wisselKeeper(_ id: String) {
        guard let i = toestand.players.firstIndex(where: { $0.id == id }) else { return }
        SquadActions.toggleKeeper(&toestand.players[i])
        bewaar()
    }

    func zetTeamnaam(_ naam: String) {
        StoreActions.setTeamName(&toestand, naam)
        bewaar()
    }

    func kiesFormatie(_ formatie: String) {
        if LineupActions.chooseFormation(&toestand, formatie) { bewaar() }
    }

    func zetDelen(_ delen: Int, minuten: Double) {
        toestand.parts = delen == 4 ? 4 : 2
        toestand.minutesPerPart = min(max(minuten, 1), 60)
        bewaar()
    }

    // MARK: - een wedstrijd opzetten

    func nieuweWedstrijd(tegenstander: String, thuis: Bool) {
        MatchActions.nieuwe(&toestand, opponent: tegenstander.trimmingCharacters(in: .whitespaces), home: thuis, vandaag: vandaag)
        gekozenPlek = nil
        bewaar()
    }

    func gooiWedstrijdWeg() {
        toestand.match = nil
        gekozenPlek = nil
        bewaar()
    }

    func zetAfwezig(_ id: String, _ afwezig: Bool) {
        if MatchActions.setAbsent(&toestand, spelerId: id, absent: afwezig) { bewaar() }
    }

    /// Vóór de aftrap: iemand op de gekozen plek zetten is opstellen, geen wissel.
    func zetOpPlekBijOpstellen(_ bron: LineupActions.Bron, _ id: String) {
        guard let plek = gekozenPlek else { return }
        guard LineupActions.zetOpPlekInOpzet(&toestand, bron, plek, id) else { return }
        gekozenPlek = nil
        bewaar()
    }

    func ruilBijOpstellen(_ bron: LineupActions.Bron, _ a: String, _ b: String) {
        guard LineupActions.swapPositions(&toestand, bron, a, b) else { return }
        gekozenPlek = nil
        bewaar()
    }

    func haalVanVeld(_ bron: LineupActions.Bron, _ plek: String) {
        guard LineupActions.takeOffPitch(&toestand, bron, plek) else { return }
        gekozenPlek = nil
        bewaar()
    }

    func maakStandaardopstelling() {
        _ = LineupActions.ensureDefaultLineup(&toestand)
        bewaar()
    }

    func wisStandaardopstelling() {
        LineupActions.clearDefaultLineup(&toestand)
        bewaar()
    }

    // MARK: - de klok

    func startOfPauzeer() {
        guard ClockActions.toggleRunning(&toestand.match, nu: echtNu, vandaag: vandaag) else { return }
        nu = echtNu
        bewaar()
    }

    func volgendDeelOfRust() {
        guard ClockActions.togglePart(&toestand.match, nu: echtNu, vandaag: vandaag) else { return }
        nu = echtNu
        bewaar()
    }

    func verschuifKlok(_ seconden: Double) {
        guard ClockActions.verschuif(&toestand.match, seconds: seconden) else { return }
        nu = echtNu
        bewaar()
    }

    // MARK: - tijdens de wedstrijd

    func brengIn(_ id: String) {
        guard let plek = gekozenPlek else { return }
        MatchEventActions.putOnPosition(&toestand.match, nu: nu, position: plek, spelerId: id)
        gekozenPlek = nil
        bewaar()
    }

    func ruil(_ a: String, _ b: String) {
        guard MatchEventActions.ruil(&toestand.match, nu: nu, a, b) else { return }
        gekozenPlek = nil
        bewaar()
    }

    func doelpunt(_ id: String?) {
        MatchEventActions.goal(&toestand.match, nu: nu, spelerId: id)
        bewaar()
    }

    func assist(_ id: String?) {
        if MatchEventActions.setAssist(&toestand.match, spelerId: id) { bewaar() }
    }

    func tegendoelpunt() {
        MatchEventActions.concede(&toestand.match, nu: nu)
        bewaar()
    }

    func draaiTerug() {
        guard MatchEventActions.undoLast(&toestand.match) else { return }
        gekozenPlek = nil
        bewaar()
    }

    func sluitAf() {
        guard MatchActions.finish(&toestand.match, nu: echtNu) else { return }
        nu = echtNu
        gekozenPlek = nil
        bewaar()
    }

    func zetNotitie(_ tekst: String) {
        guard toestand.match != nil else { return }
        toestand.match?.note = tekst
        bewaar()
    }

    /// Naar het archief. Daarna is er geen lopende wedstrijd meer.
    @discardableResult
    func bewaarInArchief() -> Bool {
        guard MatchActions.archiveMatch(&toestand, nu: nu) != nil else { return false }
        toestand.match = nil
        bewaar()
        return true
    }

    // MARK: - het wisselplan

    func planVoegToe(minuut: Int, erin: String, eruit: String, naDeel: Int?, ruil: Bool) {
        guard PlanActions.voegToe(
            &toestand.match, minuut: Double(minuut), on: erin, off: eruit, naDeel: naDeel, soort: ruil ? .ruil : nil)
        else { return }
        bewaar()
    }

    func planHaalWeg(_ id: String) {
        if PlanActions.haalWeg(&toestand.match, id: id) { bewaar() }
    }

    func planSlaOver(_ id: String, _ overslaan: Bool = true) {
        if PlanActions.slaOver(&toestand.match, id: id, overslaan: overslaan) { bewaar() }
    }

    /// De stap doorvoeren. Het moment kiest de trainer; de app wisselt nooit zelf.
    func planVoerUit(_ id: String) {
        guard PlanActions.voerUit(&toestand.match, nu: nu, id: id) else { return }
        gekozenPlek = nil
        bewaar()
    }

    // MARK: - trainingen

    /// Iedereen staat op aanwezig; je tikt alleen wie er niet is.
    func nieuweTraining() -> String {
        let training = TrainingActions.newTraining(&toestand, vandaag: vandaag)
        bewaar()
        return training.id
    }

    func training(_ id: String) -> Training? { TrainingActions.trainingById(toestand, id) }

    func tikAanwezigheid(_ trainingId: String, _ spelerId: String) {
        if TrainingActions.cycleAttendance(&toestand, trainingId: trainingId, spelerId) { bewaar() }
    }

    func zetTrainingDatum(_ trainingId: String, _ datum: Date) {
        if TrainingActions.setTrainingDate(&toestand, trainingId: trainingId, date: AppModel.tekst(datum)) { bewaar() }
    }

    func verwijderTraining(_ trainingId: String) {
        TrainingActions.removeTraining(&toestand, trainingId: trainingId)
        bewaar()
    }

    // MARK: - een bewaarde wedstrijd bijwerken

    func wijzigBewaard(_ i: Int, datum: Date? = nil, tegenstander: String? = nil, thuis: Bool? = nil) {
        if ArchiveActions.wijzig(&toestand, i, date: datum.map(AppModel.tekst), opponent: tegenstander, home: thuis) { bewaar() }
    }

    func zetBewaardeNotitie(_ i: Int, _ tekst: String) {
        if ArchiveActions.setNote(&toestand, i, tekst) { bewaar() }
    }

    func verwijderBewaard(_ i: Int) {
        ArchiveActions.verwijderWedstrijd(&toestand, i)
        bewaar()
    }

    /// Alleen doelpunten: aan de wissels hangt de speeltijd, die blijven staan.
    func haalDoelpuntWeg(_ i: Int, _ index: Int) {
        if ArchiveActions.removeGoal(&toestand, i, index) { bewaar() }
    }

    func doelpuntErbij(_ i: Int, minuut: Int, maker: String?, tegen: Bool) {
        if ArchiveActions.addGoal(&toestand, i, minuut: Double(minuut), spelerId: tegen ? nil : maker, tegen: tegen) { bewaar() }
    }

    // MARK: - datums

    /// Datums staan bewaard als "2026-09-04", net als op het web.
    private static let dagvorm: DateFormatter = {
        let f = DateFormatter()
        f.calendar = Calendar(identifier: .gregorian)
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()

    static func tekst(_ datum: Date) -> String { dagvorm.string(from: datum) }
    static func datum(_ tekst: String) -> Date? { dagvorm.date(from: tekst) }

    // MARK: - overzetten

    /// Een back-up of overzetcode van de webversie inlezen. Geeft terug wat erin zat.
    func leesIn(_ tekst: String) throws -> String {
        let schoon = tekst.trimmingCharacters(in: .whitespacesAndNewlines)
        if schoon.hasPrefix("{") {
            let pakket = try readBackup(schoon)
            StoreActions.adoptPackage(&toestand, pakket)
            bewaar()
            return describePackage(pakket)
        }
        let pakket = try readTransferCode(schoon)
        StoreActions.adoptPackage(&toestand, pakket)
        bewaar()
        return describePackage(pakket)
    }

    func maakBackup() -> String {
        makeBackup(toestand, ISO8601DateFormatter().string(from: Date()))
    }
}
