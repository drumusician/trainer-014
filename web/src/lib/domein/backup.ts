import { legeToestand, type Toestand } from './types';

/** Alles wat de app onthoudt, als tekst. Voor als je telefoon in de sloot valt. */
export interface Backup {
	blaadje: 1;
	gemaakt: string;
	toestand: Omit<Toestand, 'wedstrijd'>;
}

export function maakBackup(t: Toestand, gemaakt: string): string {
	const { wedstrijd: _weg, ...rest } = t; /* een lopende wedstrijd hoort bij het toestel */
	const backup: Backup = { blaadje: 1, gemaakt, toestand: rest };
	return JSON.stringify(backup, null, 2);
}

/**
 * Leest een back-up. Accepteert ook de kale toestand, zodat een export uit de
 * oude app of een half geknipt bestand er nog in kan.
 */
export function leesBackup(tekst: string): Omit<Toestand, 'wedstrijd'> {
	const d = JSON.parse(tekst);
	const t = d?.toestand ?? d;
	if (!t || !Array.isArray(t.spelers) || !t.spelers.length) {
		throw new Error('hier staat geen selectie in');
	}
	const leeg = legeToestand();
	return {
		teamnaam: typeof t.teamnaam === 'string' && t.teamnaam.trim() ? t.teamnaam : leeg.teamnaam,
		spelers: t.spelers,
		formatie: typeof t.formatie === 'string' ? t.formatie : leeg.formatie,
		helftMinuten: Number(t.helftMinuten) || leeg.helftMinuten,
		delen: t.delen === 4 ? 4 : leeg.delen,
		standaard: t.standaard ?? null,
		archief: Array.isArray(t.archief) ? t.archief : [],
		trainingen: Array.isArray(t.trainingen) ? t.trainingen : [],
		verslagWissels: !!t.verslagWissels
	};
}

export function backupNaam(gemaakt: string): string {
	return 'blaadje-' + gemaakt.slice(0, 10) + '.json';
}
