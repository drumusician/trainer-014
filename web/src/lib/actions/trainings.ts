import { sortTrainings } from '$lib/domain/attendance';
import type { Attendance, State, Training } from '$lib/domain/types';

/**
 * Everything that changes a training session.
 *
 * The split from domain/ is deliberate: that folder calculates without touching
 * anything, this one changes state. These functions never save by themselves —
 * the store does, so there is a single place where syncing is triggered.
 */

/** Short, unique enough, and readable if something ever goes wrong. */
function newId(): string {
	return 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/** Everyone starts as present; marking someone off is the exception. */
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

/** One tap onwards: present, excused, no-show, and back to present. */
export function cycleAttendance(training: Training, spelerId: string) {
	const volgorde: Attendance[] = ['present', 'excused', 'absent'];
	const nu = training.status[spelerId] ?? 'present';
	training.status[spelerId] = volgorde[(volgorde.indexOf(nu) + 1) % volgorde.length];
}

/** A date can upend the order, so sort again afterwards. */
export function setTrainingDate(t: State, training: Training, date: string): boolean {
	if (!date) return false;
	training.date = date;
	t.trainings = sortTrainings(t.trainings);
	return true;
}

export function removeTraining(t: State, training: Training) {
	t.trainings = t.trainings.filter((x) => x.id !== training.id);
}
