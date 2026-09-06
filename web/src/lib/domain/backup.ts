import { migreerToestand } from './migrate-storage';
import { emptyState, type State } from './types';

/** Alles wat de app onthoudt, als tekst. Voor als je telefoon in de sloot valt. */
export interface Backup {
	blaadje: 1;
	gemaakt: string;
	toestand: Omit<State, 'match'>;
}

export function makeBackup(t: State, gemaakt: string): string {
	const { match: _weg, ...rest } = t; /* een lopende wedstrijd hoort bij het toestel */
	const backup: Backup = { blaadje: 1, gemaakt, toestand: rest };
	return JSON.stringify(backup, null, 2);
}

/**
 * Leest een back-up. Accepteert ook de kale toestand, zodat een export uit de
 * oude app of een half geknipt bestand er nog in kan.
 */
export function readBackup(tekst: string): Omit<State, 'match'> {
	const d = JSON.parse(tekst);
	/* Een back-up zit in een omslag met een datum eromheen, dus eerst uitpakken en
	   dan pas omzetten — anders herkent de omzetting het oude formaat niet. */
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
