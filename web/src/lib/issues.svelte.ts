/**
 * Een klein logboekje van wat er misging, op dit toestel.
 *
 * De app slikt op een paar plekken bewust fouten in: een volle opslag mag de
 * klok niet stoppen en een haperend netwerk mag geen wedstrijd onderbreken. Maar
 * daardoor kon je achteraf niet weten dát er iets was, en ik kon het niet
 * nakijken. Dit noteert het, en verder niets.
 *
 * Blijft op het toestel. Er gaat niets naar een server — dat is de belofte op de
 * landingspagina, en die geldt ook voor foutmeldingen.
 */
const SLEUTEL = 'o14-problemen-v1';
const MAX = 20;

export interface Issue {
	/** wanneer, als ISO-tekst zodat het in de opslag leesbaar blijft */
	wanneer: string;
	/** wat er misging, in gewone taal */
	wat: string;
	/** de technische melding, voor als ik moet zoeken */
	melding?: string;
}

const storage = () => (typeof localStorage === 'undefined' ? null : localStorage);

function lees(): Issue[] {
	try {
		const ruw = storage()?.getItem(SLEUTEL);
		const d = ruw ? JSON.parse(ruw) : null;
		return Array.isArray(d) ? d : [];
	} catch {
		return [];
	}
}

export const issues = $state<{ lijst: Issue[]; savingFails: boolean }>({
	lijst: [],
	/** Losse vlag: als opslaan niet lukt is alles wat je daarna doet weg. */
	savingFails: false
});

export function loadIssues() {
	issues.lijst = lees();
}

/**
 * Iets noteren. Mag nooit zelf stukgaan: dit wordt aangeroepen vanuit een catch,
 * en een logboek dat de app laat vallen is erger dan geen logboek.
 */
export function reportIssue(wat: string, fout?: unknown) {
	try {
		const melding = fout instanceof Error ? fout.message : fout ? String(fout) : undefined;
		/* eslint-disable-next-line svelte/prefer-svelte-reactivity -- meteen omgezet naar tekst, niet bewaard */
		const wanneer = new Date().toISOString();
		issues.lijst = [{ wanneer, wat, melding }, ...issues.lijst].slice(0, MAX);
		storage()?.setItem(SLEUTEL, JSON.stringify(issues.lijst));
	} catch {
		/* Dan houdt het op. Hier niets meer proberen. */
	}
}

export function clearIssues() {
	issues.lijst = [];
	try {
		storage()?.removeItem(SLEUTEL);
	} catch {
		/* stil */
	}
}
