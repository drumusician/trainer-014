/**
 * Everything that changes a training session.
 *
 * The split from Domain/ is deliberate: that folder calculates without touching
 * anything, this one changes state. These functions never save by themselves —
 * the app does, so there is a single place where saving is triggered.
 */
public enum TrainingActions {
	/** Everyone starts as present; marking someone off is the exception. */
	@discardableResult
	public static func newTraining(
		_ t: inout AppState,
		vandaag: String,
		nieuwId: () -> String = IdGenerator.standaard("t")
	) -> Training {
		var status = OrderedDict<Attendance>()
		for p in t.players { status[p.id] = .present }
		let training = Training(id: nieuwId(), date: vandaag, status: status)
		t.trainings = sortTrainings([training] + t.trainings)
		return training
	}

	public static func trainingById(_ t: AppState, _ id: String?) -> Training? {
		t.trainings.first { $0.id == id }
	}

	/** One tap onwards: present, excused, no-show, and back to present. */
	public static func cycleAttendance(_ training: inout Training, _ spelerId: String) {
		let volgorde: [Attendance] = [.present, .excused, .absent]
		let nu = training.status[spelerId] ?? .present
		training.status[spelerId] = volgorde[(volgorde.firstIndex(of: nu)! + 1) % volgorde.count]
	}

	/** The same tap, on the session in the state with this id. */
	@discardableResult
	public static func cycleAttendance(_ t: inout AppState, trainingId: String, _ spelerId: String) -> Bool {
		guard let i = t.trainings.firstIndex(where: { $0.id == trainingId }) else { return false }
		cycleAttendance(&t.trainings[i], spelerId)
		return true
	}

	/** A date can upend the order, so sort again afterwards. */
	@discardableResult
	public static func setTrainingDate(_ t: inout AppState, trainingId: String, date: String) -> Bool {
		if date.isEmpty { return false }
		if let i = t.trainings.firstIndex(where: { $0.id == trainingId }) { t.trainings[i].date = date }
		t.trainings = sortTrainings(t.trainings)
		return true
	}

	public static func removeTraining(_ t: inout AppState, trainingId: String) {
		t.trainings = t.trainings.filter { $0.id != trainingId }
	}
}
