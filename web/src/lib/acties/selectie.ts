import type { Speler, Toestand, Veldlinie } from '$lib/domein/types';

/** Wie er in je selectie zitten en wat ze spelen. */

function nieuwId(): string {
	return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function spelerVan(t: Toestand, id: string | null | undefined): Speler | undefined {
	return id ? t.spelers.find((p) => p.id === id) : undefined;
}

/** Een plakblok met namen, één per regel. Lege regels slaan we over. */
export function namenErbij(t: Toestand, tekst: string) {
	tekst
		.split('\n')
		.map((x) => x.trim())
		.filter(Boolean)
		.forEach((naam) => {
			t.spelers.push({ id: nieuwId(), naam, linie: '' });
		});
}

export function hernoem(p: Speler, naam: string) {
	p.naam = naam.trim();
}

export function verwijderSpeler(t: Toestand, p: Speler) {
	t.spelers = t.spelers.filter((x) => x.id !== p.id);
}

/** Nog eens dezelfde linie aantikken zet hem weer uit. */
export function zetLinie(p: Speler, linie: Veldlinie) {
	p.linie = p.linie === linie ? '' : linie;
}

/** Keepen staat los van de linie: een verdediger die ook keept houdt zijn linie. */
export function zetKeept(p: Speler) {
	p.keept = !p.keept;
}
