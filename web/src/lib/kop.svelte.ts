/** Wat er in de balk bovenaan staat. Elk scherm zet dit zelf. */
export const kop = $state({
	titel: 'Blaadje',
	/** waar de knop rechtsboven naartoe gaat */
	terug: '/instellen',
	terugTekst: 'Instellen',
	/** stand, alleen tijdens een wedstrijd */
	stand: null as string | null
});

export function zetKop(titel: string, terug = '/instellen', terugTekst = 'Terug', stand: string | null = null) {
	kop.titel = titel;
	kop.terug = terug;
	kop.terugTekst = terugTekst;
	kop.stand = stand;
}
