import { describe, expect, it } from 'vitest';
import { bepaalToestel } from './toestel';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1';
const IPAD = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15';
const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/128.0 Safari/537.36';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/128.0 Mobile Safari/537.36';
const WINDOWS = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128.0 Safari/537.36';

describe('welk toestel', () => {
	it('herkent een iPhone en een Android', () => {
		expect(bepaalToestel(IPHONE)).toBe('ios');
		expect(bepaalToestel(ANDROID)).toBe('android');
	});

	it('houdt een iPad uit elkaar van een Mac, want een iPad doet zich voor als Mac', () => {
		expect(bepaalToestel(IPAD, 5)).toBe('ios');
		expect(bepaalToestel(MAC, 0)).toBe('desktop');
	});

	it('valt terug op desktop', () => {
		expect(bepaalToestel(WINDOWS)).toBe('desktop');
		expect(bepaalToestel('')).toBe('desktop');
	});
});
