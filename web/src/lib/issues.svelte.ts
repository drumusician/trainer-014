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
 */
export function reportIssue(what: string, fout?: unknown) {
	try {
		const message = fout instanceof Error ? fout.message : fout ? String(fout) : undefined;
		/* eslint-disable-next-line svelte/prefer-svelte-reactivity -- turned into text at once, never held */
		const when = new Date().toISOString();
		issues.lijst = [{ when, what, message }, ...issues.lijst].slice(0, MAX);
		storage()?.setItem(SLEUTEL, JSON.stringify(issues.lijst));
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
