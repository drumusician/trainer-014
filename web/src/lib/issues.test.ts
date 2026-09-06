import { beforeEach, describe, expect, it } from 'vitest';
import { loadIssues, reportIssue, issues, clearIssues } from './issues.svelte';

beforeEach(() => {
	localStorage.clear();
	clearIssues();
});

describe('het logboekje van wat er misging', () => {
	it('noteert wat er gebeurde, nieuwste bovenaan', () => {
		reportIssue('Eerste');
		reportIssue('Tweede', new Error('kapot'));
		expect(issues.lijst.map((p) => p.wat)).toEqual(['Tweede', 'Eerste']);
		expect(issues.lijst[0].melding).toBe('kapot');
	});

	it('overleeft opnieuw laden', () => {
		reportIssue('Blijft staan');
		issues.lijst = [];
		loadIssues();
		expect(issues.lijst.map((p) => p.wat)).toEqual(['Blijft staan']);
	});

	it('houdt er hoogstens twintig, zodat de opslag niet volloopt', () => {
		for (let i = 0; i < 30; i++) reportIssue('nummer ' + i);
		expect(issues.lijst).toHaveLength(20);
		expect(issues.lijst[0].wat).toBe('nummer 29');
	});

	/* Dit wordt vanuit een catch aangeroepen. Een logboek dat zelf de app laat
	   vallen is erger dan geen logboek. */
	it('gaat zelf nooit stuk, ook niet als de opslag weigert', () => {
		const echt = localStorage.setItem;
		localStorage.setItem = () => {
			throw new Error('vol');
		};
		expect(() => reportIssue('Toch melden')).not.toThrow();
		localStorage.setItem = echt;
	});

	it('wist de lijst als je erom vraagt', () => {
		reportIssue('Weg hiermee');
		clearIssues();
		expect(issues.lijst).toHaveLength(0);
		loadIssues();
		expect(issues.lijst).toHaveLength(0);
	});
});
