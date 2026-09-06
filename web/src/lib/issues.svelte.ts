/**
 * A small log of what went wrong, on this device.
 *
 * In a few places the app deliberately swallows errors: a full disk must not stop
 * the clock, and a flaky network must not interrupt a match. But that meant you
 * could not know afterwards that anything had happened, and neither could I. This
 * writes it down, and nothing else.
 *
 * It stays on the device. Nothing goes to a server — that is the promise on the
 * landing page, and it holds for error messages too.
 */
import { untrack } from 'svelte';

const SLEUTEL = 'o14-problemen-v1';
const MAX = 20;

export interface Issue {
	/** when, as ISO text so it stays readable in storage */
	when: string;
	/** what went wrong, in plain language */
	what: string;
	/** the technical message, for when someone has to go looking */
	message?: string;
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
	/** Separate flag: if saving fails, everything you do afterwards is lost. */
	savingFails: false
});

export function loadIssues() {
	issues.lijst = lees();
}

/**
 * Record something. Must never break itself: this is called from inside a catch,
 * and a log that brings the app down is worse than no log at all.
 *
 * De bestaande lijst wordt met untrack gelezen. Zonder dat leest en schrijft deze
 * functie dezelfde staat, en wie hem vanuit een $effect aanroept zet daarmee een
 * lus in gang: schrijven maakt de effect vuil, die roept opnieuw aan. Svelte kapt
 * dat af na duizend rondes, dus je ziet er niets van behalve duizend schrijfacties
 * naar localStorage. De foutpagina deed precies dat — de ene pagina die je nooit
 * onderuit wilt hebben.
 */
export function reportIssue(what: string, fout?: unknown) {
	try {
		const message = fout instanceof Error ? fout.message : fout ? String(fout) : undefined;
		/* eslint-disable-next-line svelte/prefer-svelte-reactivity -- turned into text at once, never held */
		const when = new Date().toISOString();
		const nieuw = [{ when, what, message }, ...untrack(() => issues.lijst)].slice(0, MAX);
		issues.lijst = nieuw;
		/* De nieuwe lijst wegschrijven, niet issues.lijst opnieuw uitlezen: dat
		   lezen zou de aanroepende effect op deze staat abonneren. */
		storage()?.setItem(SLEUTEL, JSON.stringify(nieuw));
	} catch {
		/* Then that is that. Do not try anything further here. */
	}
}

export function clearIssues() {
	issues.lijst = [];
	try {
		storage()?.removeItem(SLEUTEL);
	} catch {
		/* quiet */
	}
}
