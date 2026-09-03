import type { ArchiefWedstrijd, Gebeurtenis, Speler, Wedstrijd } from './types';
import { eindTijd, stand } from './tijd';

/** Alles wat je nodig hebt om een wedstrijd terug te lezen, live of uit het archief. */
export interface Verslagbron {
	datum: string;
	tegenstander: string;
	thuis: boolean;
	stand: [number, number];
	formatie: string;
	duur: number;
	gebeurtenissen: Gebeurtenis[];
	namen?: Record<string, string>;
}

export function bronVanWedstrijd(w: Wedstrijd): Verslagbron {
	return {
		datum: w.datum, tegenstander: w.tegenstander, thuis: w.thuis,
		stand: stand(w), formatie: w.formatie, duur: eindTijd(w),
		gebeurtenissen: w.gebeurtenissen
	};
}

export function bronVanArchief(a: ArchiefWedstrijd): Verslagbron {
	return {
		datum: a.datum, tegenstander: a.tegenstander, thuis: a.thuis !== false,
		stand: a.stand ?? [0, 0], formatie: a.formatie, duur: a.duur ?? 0,
		gebeurtenissen: a.gebeurtenissen ?? [], namen: a.namen
	};
}

/** De naam van nu; valt terug op de naam zoals hij bij het bewaren was. */
export function naamVan(id: string | null | undefined, spelers: Speler[], namen?: Record<string, string>): string {
	if (!id) return 'onbekend';
	return spelers.find((p) => p.id === id)?.naam ?? namen?.[id] ?? 'onbekend';
}

export function gebeurtenisTekst(g: Gebeurtenis, spelers: Speler[], namen?: Record<string, string>): string {
	const naam = (id?: string | null) => naamVan(id, spelers, namen);
	switch (g.type) {
		case 'start': return 'Aftrap';
		case 'rust': return 'Rust';
		case 'eind': return 'Einde';
		case 'tegen': return 'Tegendoelpunt';
		case 'goal':
			return (
				'Doelpunt' +
				(g.speler ? ' — ' + naam(g.speler) : '') +
				(g.assist ? ' (assist ' + naam(g.assist) + ')' : '')
			);
		case 'wissel': return naam(g.erin) + ' voor ' + naam(g.eruit);
		case 'ruil': return 'van plek gewisseld';
		default: return g.type;
	}
}

export function datumTekst(datum: string): string {
	try {
		return new Date(datum + 'T12:00:00').toLocaleDateString('nl-NL', {
			weekday: 'long', day: 'numeric', month: 'long'
		});
	} catch {
		return datum;
	}
}

/**
 * Het verslag voor de groepsapp. Wissels blijven er standaard uit: de uitslag
 * is voor iedereen, de opstelling is van de trainer.
 */
export function verslagTekst(bron: Verslagbron, spelers: Speler[], metWissels = false): string {
	const [v, t] = bron.stand;
	const thuis = bron.thuis !== false;
	const regels: string[] = [];
	regels.push(
		(thuis ? 'O14 – ' + bron.tegenstander : bron.tegenstander + ' – O14') + ' ' +
		(thuis ? v + '–' + t : t + '–' + v)
	);
	regels.push(datumTekst(bron.datum));
	regels.push('');

	let voor = 0;
	let tegen = 0;
	[...bron.gebeurtenissen]
		.sort((a, b) => (a.t ?? 0) - (b.t ?? 0))
		.forEach((g) => {
			const min = Math.floor((g.t ?? 0) / 60) + '′';
			if (g.type === 'goal') {
				voor++;
				const naam = g.speler ? naamVan(g.speler, spelers, bron.namen) : null;
				const assist = g.assist ? naamVan(g.assist, spelers, bron.namen) : null;
				regels.push(
					`${min}  ${voor}–${tegen}  ${naam && naam !== 'onbekend' ? naam : 'doelpunt'}` +
						(assist && assist !== 'onbekend' ? ` (assist ${assist})` : '')
				);
			} else if (g.type === 'tegen') {
				tegen++;
				regels.push(`${min}  ${voor}–${tegen}  tegendoelpunt`);
			} else if (g.type === 'wissel' && metWissels) {
				regels.push(`${min}       ${naamVan(g.erin, spelers, bron.namen)} voor ${naamVan(g.eruit, spelers, bron.namen)}`);
			}
		});
	if (voor + tegen === 0) regels.push('Geen doelpunten.');
	return regels.join('\n');
}
