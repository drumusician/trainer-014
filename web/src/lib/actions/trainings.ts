import { sortTrainings } from '$lib/domain/attendance';
import type { Attendance, State, Training } from '$lib/domain/types';

/**
 * Alles wat een training verandert.
 *
 * De scheiding met domein/ is bewust: daar wordt gerekend zonder iets aan te
 * raken, hier wordt de toestand gewijzigd. Deze functies bewaren zelf niets —
 * dat doet de winkel, zodat er één plek is waar synchronisatie op gang komt.
 */

/** Kort, uniek genoeg, en te lezen als er ooit iets misgaat. */
function newId(): string {
	return 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/** Iedereen staat op aanwezig; afmelden doe je bij uitzondering. */
export function newTraining(t: State, vandaag: string): Training {
	const status: Record<string, Attendance> = {};
	t.players.forEach((p) => (status[p.id] = 'present'));
	const training: Training = { id: newId(), date: vandaag, status };
	t.trainings = sortTrainings([training, ...t.trainings]);
	return training;
}

export function trainingById(t: State, id: string | undefined): Training | undefined {
	return t.trainings.find((x) => x.id === id);
}

/** Eén tik verder: aanwezig, afgemeld, niet gekomen, en weer aanwezig. */
export function cycleAttendance(training: Training, spelerId: string) {
	const volgorde: Attendance[] = ['present', 'excused', 'absent'];
	const nu = training.status[spelerId] ?? 'present';
	training.status[spelerId] = volgorde[(volgorde.indexOf(nu) + 1) % volgorde.length];
}

/** Een datum kan de volgorde omgooien, dus daarna opnieuw sorteren. */
export function setTrainingDate(t: State, training: Training, date: string): boolean {
	if (!date) return false;
	training.date = date;
	t.trainings = sortTrainings(t.trainings);
	return true;
}

export function removeTraining(t: State, training: Training) {
	t.trainings = t.trainings.filter((x) => x.id !== training.id);
}
