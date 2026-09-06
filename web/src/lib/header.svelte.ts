/** What sits in the top bar. Every screen sets this itself. */
export const kop = $state({
	titel: 'Blaadje',
	/** where the top-right button goes; null = no button */
	terug: null as string | null,
	terugTekst: 'Terug',
	/** score, during a match only */
	score: null as string | null,
	/**
	 * Always go to `back`, even when you came from somewhere. For buttons that are
	 * not "back" but an exit: after a match you want the start screen, not to walk
	 * back into the match you just finished.
	 */
	vast: false
});

export function zetKop(
	titel: string,
	terug: string | null = null,
	terugTekst = 'Terug',
	score: string | null = null,
	vast = false
) {
	kop.titel = titel;
	kop.terug = terug;
	kop.terugTekst = terugTekst;
	kop.score = score;
	kop.vast = vast;
}
