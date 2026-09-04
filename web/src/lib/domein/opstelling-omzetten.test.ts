import { describe, expect, it } from 'vitest';
import { zetOpstellingOm } from './opstelling';

/** De opstelling zoals hij in 4-3-3 stond. */
const vier33 = {
	K: 'keeper', RV: 'jack', CVr: 'kasper', CVl: 'mirza', LV: 'daan',
	MR: 'daanish', MC: 'amir', ML: 'mauro',
	RB: 'simon', SP: 'max', LB: 'siem'
};

describe('van formatie wisselen', () => {
	it('houdt keeper en verdediging staan bij 4-3-3 naar 4-4-2', () => {
		const uit = zetOpstellingOm(vier33, '4-3-3', '4-4-2');
		expect(uit.opstelling.K).toBe('keeper');
		expect(uit.opstelling.RV).toBe('jack');
		expect(uit.opstelling.CVr).toBe('kasper');
		expect(uit.opstelling.CVl).toBe('mirza');
		expect(uit.opstelling.LV).toBe('daan');
	});

	it('schuift de drie middenvelders door en laat de vierde plek leeg', () => {
		const uit = zetOpstellingOm(vier33, '4-3-3', '4-4-2');
		const middenveld = ['MR', 'MCr', 'MCl', 'ML'].map((p) => uit.opstelling[p]).filter(Boolean);
		/* Er zijn er maar drie. De lege plek vult de trainer zelf; er stilletjes
		   een aanvaller neerzetten zou een keuze voor hem maken. */
		expect(middenveld).toHaveLength(3);
	});

	it('zet de aanvaller die niet meer past op de bank', () => {
		const uit = zetOpstellingOm(vier33, '4-3-3', '4-4-2');
		expect(['SPr', 'SPl'].map((p) => uit.opstelling[p]).filter(Boolean)).toHaveLength(2);
		expect(uit.afgevallen).toHaveLength(1);
		expect(Object.values(uit.opstelling).filter(Boolean)).toHaveLength(10);
	});

	it('past precies bij de ruit, want die heeft ook vier middenveldplekken', () => {
		const uit = zetOpstellingOm(vier33, '4-3-3', '4-4-2 ruit');
		expect(Object.values(uit.opstelling).filter(Boolean)).toHaveLength(10);
		expect(uit.bank).toHaveLength(1);
	});

	it('laat niemand verdwijnen bij 11 tegen 11 naar 8 tegen 8', () => {
		const uit = zetOpstellingOm(vier33, '4-3-3', '1-3-3-1', []);
		const inVeld = Object.values(uit.opstelling).filter(Boolean);
		expect(inVeld).toHaveLength(8);
		expect(inVeld.length + uit.bank.length).toBe(11);
	});

	it('houdt de bestaande bank in stand', () => {
		const uit = zetOpstellingOm(vier33, '4-3-3', '4-4-2', ['alain', 'zenith']);
		expect(uit.bank).toContain('alain');
		expect(uit.bank).toContain('zenith');
	});
});
