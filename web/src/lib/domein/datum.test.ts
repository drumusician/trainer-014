import { describe, expect, it } from 'vitest';
import { shortDate, datumMetJaar } from './datum';

describe('datums', () => {
	it('schrijft ze zoals je ze zegt', () => {
		expect(shortDate('2026-09-04')).toBe('4 sep');
		expect(datumMetJaar('2026-09-04')).toBe('4 september 2026');
	});

	it('rekent niet met tijdzones mis rond middernacht', () => {
		expect(shortDate('2026-01-01')).toBe('1 jan');
		expect(shortDate('2026-12-31')).toBe('31 dec');
	});

	it('laat onzin met rust in plaats van te klagen', () => {
		expect(shortDate('')).toBe('');
		expect(shortDate('geen datum')).toBe('geen datum');
	});
});
