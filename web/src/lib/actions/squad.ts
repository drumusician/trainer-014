import type { Player, State, FieldLine } from '$lib/domain/types';

/** Wie er in je selectie zitten en wat ze spelen. */

function newId(): string {
	return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function playerById(t: State, id: string | null | undefined): Player | undefined {
	return id ? t.spelers.find((p) => p.id === id) : undefined;
}

/** Een plakblok met namen, één per regel. Lege regels slaan we over. */
export function addPlayerNames(t: State, tekst: string) {
	tekst
		.split('\n')
		.map((x) => x.trim())
		.filter(Boolean)
		.forEach((naam) => {
			t.spelers.push({ id: newId(), naam, linie: '' });
		});
}

export function renamePlayer(p: Player, naam: string) {
	p.naam = naam.trim();
}

export function removePlayer(t: State, p: Player) {
	t.spelers = t.spelers.filter((x) => x.id !== p.id);
}

/** Nog eens dezelfde linie aantikken zet hem weer uit. */
export function setLine(p: Player, linie: FieldLine) {
	p.linie = p.linie === linie ? '' : linie;
}

/** Keepen staat los van de linie: een verdediger die ook keept houdt zijn linie. */
export function toggleKeeper(p: Player) {
	p.keept = !p.keept;
}
