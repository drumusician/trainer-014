/** Wat er in de balk bovenaan staat. Elk scherm zet dit zelf. */
export const kop = $state({
	titel: 'Blaadje',
	/** waar de knop rechtsboven naartoe gaat; null = geen knop */
	terug: null as string | null,
	terugTekst: 'Terug',
	/** stand, alleen tijdens een wedstrijd */
	stand: null as string | null,
	/**
	 * Altijd naar `terug`, ook als je ergens vandaan komt. Voor knoppen die geen
	 * "terug" zijn maar een uitgang: na een wedstrijd wil je naar het startscherm
	 * en niet terug het afgelopen wedstrijdscherm in.
	 */
	vast: false
});

export function zetKop(
	titel: string,
	terug: string | null = null,
	terugTekst = 'Terug',
	stand: string | null = null,
	vast = false
) {
	kop.titel = titel;
	kop.terug = terug;
	kop.terugTekst = terugTekst;
	kop.stand = stand;
	kop.vast = vast;
}
