import type { Player, State, FieldLine } from '$lib/domain/types';

/** Who is in your squad and what they play. */

function newId(): string {
	return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function playerById(t: State, id: string | null | undefined): Player | undefined {
	return id ? t.players.find((p) => p.id === id) : undefined;
}

/** A pasted block of names, one per line. Empty lines are skipped. */
export function addPlayerNames(t: State, tekst: string) {
	tekst
		.split('\n')
		.map((x) => x.trim())
		.filter(Boolean)
		.forEach((name) => {
			t.players.push({ id: newId(), name, line: '' });
		});
}

export function renamePlayer(p: Player, name: string) {
	p.name = name.trim();
}

export function removePlayer(t: State, p: Player) {
	t.players = t.players.filter((x) => x.id !== p.id);
}

/** Tapping the same line again switches it back off. */
export function setLine(p: Player, line: FieldLine) {
	p.line = p.line === line ? '' : line;
}

/** Keeping is separate from the line: a defender who also keeps stays a defender. */
export function toggleKeeper(p: Player) {
	p.keeper = !p.keeper;
}
