import { beforeEach, describe, expect, it } from 'vitest';
import { laadProblemen, meldProbleem, problemen, wisProblemen } from './problemen.svelte';

beforeEach(() => {
	localStorage.clear();
	wisProblemen();
});

describe('het logboekje van wat er misging', () => {
	it('noteert wat er gebeurde, nieuwste bovenaan', () => {
		meldProbleem('Eerste');
		meldProbleem('Tweede', new Error('kapot'));
		expect(problemen.lijst.map((p) => p.wat)).toEqual(['Tweede', 'Eerste']);
		expect(problemen.lijst[0].melding).toBe('kapot');
	});

	it('overleeft opnieuw laden', () => {
		meldProbleem('Blijft staan');
		problemen.lijst = [];
		laadProblemen();
		expect(problemen.lijst.map((p) => p.wat)).toEqual(['Blijft staan']);
	});

	it('houdt er hoogstens twintig, zodat de opslag niet volloopt', () => {
		for (let i = 0; i < 30; i++) meldProbleem('nummer ' + i);
		expect(problemen.lijst).toHaveLength(20);
		expect(problemen.lijst[0].wat).toBe('nummer 29');
	});

	/* Dit wordt vanuit een catch aangeroepen. Een logboek dat zelf de app laat
	   vallen is erger dan geen logboek. */
	it('gaat zelf nooit stuk, ook niet als de opslag weigert', () => {
		const echt = localStorage.setItem;
		localStorage.setItem = () => {
			throw new Error('vol');
		};
		expect(() => meldProbleem('Toch melden')).not.toThrow();
		localStorage.setItem = echt;
	});

	it('wist de lijst als je erom vraagt', () => {
		meldProbleem('Weg hiermee');
		wisProblemen();
		expect(problemen.lijst).toHaveLength(0);
		laadProblemen();
		expect(problemen.lijst).toHaveLength(0);
	});
});
