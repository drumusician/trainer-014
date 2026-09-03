import { describe, expect, it } from 'vitest';
import { opstellingTekst } from './opstelling';
import type { Speler } from './types';

const namen = ['Gijs', 'Jack', 'Maher', 'Daan', 'Mirza', 'Siem', 'Kasper', 'Daanish', 'Mauro', 'Max', 'Simon', 'Amir'];
const spelers: Speler[] = namen.map((naam, i) => ({ id: 'p' + i, naam, linie: '' }));
const opstelling = {
	K: 'p0', RV: 'p1', CVr: 'p2', CVl: 'p3', LV: 'p4',
	MR: 'p5', MC: 'p6', ML: 'p7', RB: 'p8', SP: 'p9', LB: 'p10'
};

describe('opstelling als tekst', () => {
	it('zet elke linie op een eigen regel, keeper zonder plekcode', () => {
		const tekst = opstellingTekst('4-3-3', opstelling, ['p11'], spelers);
		expect(tekst.split('\n')).toEqual([
			'Opstelling 4-3-3',
			'Keeper: Gijs',
			'Verdediging: Jack (RV), Maher (CV), Daan (CV), Mirza (LV)',
			'Middenveld: Siem (M), Kasper (M), Daanish (M)',
			'Aanval: Mauro (RB), Max (SP), Simon (LB)',
			'Bank: Amir'
		]);
	});

	it('laat lege plekken en een lege bank gewoon weg', () => {
		const tekst = opstellingTekst('4-3-3', { K: 'p0' }, [], spelers);
		expect(tekst).toBe('Opstelling 4-3-3\nKeeper: Gijs');
	});
});
