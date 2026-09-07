/**
 * Iets doorgeven aan een ander.
 *
 * Blaadje verstuurt zelf niets; daar zou een server voor nodig zijn en die is er
 * bewust niet. Wat het wel kan is de tekst klaarzetten en het toestel laten doen
 * waar het goed in is.
 *
 * Eerst het deelvenster van het toestel zelf. Daar staat WhatsApp in, en Signal,
 * en de mail, en kopiëren — precies de keuze die de trainer zelf hoort te maken.
 * Een mailto-koppeling deed dat niet: die opent op een telefoon soms niets, of
 * het verkeerde programma, terwijl vrijwel iedereen dit soort dingen via
 * WhatsApp stuurt.
 *
 * Kent de browser dat venster niet — een laptop, meestal — dan gaat de tekst
 * naar het klembord. Lukt dat ook niet, dan blijft de tekst op het scherm staan
 * en kan hij hem met de hand pakken. Er is dus altijd een weg.
 */
export type Deelresultaat = 'gedeeld' | 'gekopieerd' | 'zelf';

interface Deelbaar {
	share?: (data: { title?: string; text: string }) => Promise<void>;
	clipboard?: { writeText: (t: string) => Promise<void> };
}

export async function deel(tekst: string, titel?: string): Promise<Deelresultaat> {
	const n = (typeof navigator === 'undefined' ? undefined : navigator) as Deelbaar | undefined;
	if (n?.share) {
		try {
			await n.share({ title: titel, text: tekst });
			return 'gedeeld';
		} catch {
			/* Afgebroken of geweigerd: dan het klembord proberen. Iemand die het
			   venster wegtikt wil misschien nog steeds de tekst. */
		}
	}
	/* Let op de expliciete vraag of writeText bestáát. Met alleen optionele
	   punten levert een ontbrekend klembord stilletjes 'gelukt' op, en dan zegt
	   het scherm 'gekopieerd' terwijl er niets op het klembord staat. */
	if (typeof n?.clipboard?.writeText !== 'function') return 'zelf';
	try {
		await n.clipboard.writeText(tekst);
		return 'gekopieerd';
	} catch {
		return 'zelf';
	}
}
