import { migreerToestand } from './migrate-storage';
import { emptyState, type State } from './types';

/** Everything the app remembers, as text. For when your phone ends up in a ditch. */
export interface Backup {
	blaadje: 1;
	gemaakt: string;
	toestand: Omit<State, 'match'>;
}

export function makeBackup(t: State, gemaakt: string): string {
	const { match: _weg, ...rest } = t; /* a running match belongs to the device */
	const backup: Backup = { blaadje: 1, gemaakt, toestand: rest };
	return JSON.stringify(backup, null, 2);
}

/**
 * Reads a backup. Also accepts the bare state, so an export from the old app or
 * a half-copied file still goes in.
 */
export function readBackup(tekst: string): Omit<State, 'match'> {
	const d = JSON.parse(tekst);
	/* A backup sits inside a wrapper with a date around it, so unpack first and
	   convert after — otherwise the conversion does not recognise the old format. */
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const t = migreerToestand(d?.toestand ?? d) as any;
	if (!t || !Array.isArray(t.players) || !t.players.length) {
		throw new Error('hier staat geen selectie in');
	}
	const leeg = emptyState();
	return {
		teamName: typeof t.teamName === 'string' && t.teamName.trim() ? t.teamName : leeg.teamName,
		players: t.players,
		formation: typeof t.formation === 'string' ? t.formation : leeg.formation,
		minutesPerPart: Number(t.minutesPerPart) || leeg.minutesPerPart,
		parts: t.parts === 4 ? 4 : leeg.parts,
		defaultLineup: t.defaultLineup ?? null,
		archive: Array.isArray(t.archive) ? t.archive : [],
		trainings: Array.isArray(t.trainings) ? t.trainings : [],
		reportSubs: !!t.reportSubs
	};
}

export function backupName(gemaakt: string): string {
	return 'blaadje-' + gemaakt.slice(0, 10) + '.json';
}
