/** Wat er in de balk bovenaan staat. Elk scherm zet dit zelf. */
export const kop = $state({
	titel: 'Blaadje',
	/** waar de knop rechtsboven naartoe gaat; null = geen knop */
	terug: null as string | null,
	terugTekst: 'Terug',
	/** stand, alleen tijdens een wedstrijd */
	stand: null as string | null
});

export function zetKop(titel: string, terug: string | null = null, terugTekst = 'Terug', stand: string | null = null) {
	kop.titel = titel;
	kop.terug = terug;
	kop.terugTekst = terugTekst;
	kop.stand = stand;
}
