import { afterEach, describe, expect, it, vi } from 'vitest';
import { deel } from './share';

/*
 * Er moet altijd een weg zijn. Een trainer die op 'delen' drukt en niets ziet
 * gebeuren, probeert het niet nog een keer.
 */
function metNavigator(opties: { share?: unknown; clipboard?: unknown }) {
	if ('share' in opties) {
		Object.defineProperty(navigator, 'share', { value: opties.share, configurable: true });
	} else {
		Reflect.deleteProperty(navigator, 'share');
	}
	Object.defineProperty(navigator, 'clipboard', { value: opties.clipboard, configurable: true });
}

afterEach(() => vi.restoreAllMocks());

describe('iets doorgeven aan een ander', () => {
	it('gebruikt het deelvenster van het toestel als dat er is', async () => {
		const share = vi.fn().mockResolvedValue(undefined);
		metNavigator({ share, clipboard: { writeText: vi.fn() } });
		expect(await deel('de uitleg', 'Blaadje')).toBe('gedeeld');
		expect(share).toHaveBeenCalledWith({ title: 'Blaadje', text: 'de uitleg' });
	});

	/* Een laptop heeft dat venster meestal niet. */
	it('valt terug op het klembord', async () => {
		const writeText = vi.fn().mockResolvedValue(undefined);
		metNavigator({ clipboard: { writeText } });
		expect(await deel('de uitleg')).toBe('gekopieerd');
		expect(writeText).toHaveBeenCalledWith('de uitleg');
	});

	/* Wie het deelvenster wegtikt wil de tekst misschien nog steeds. */
	it('kopieert alsnog als je het deelvenster wegtikt', async () => {
		const writeText = vi.fn().mockResolvedValue(undefined);
		metNavigator({ share: vi.fn().mockRejectedValue(new Error('afgebroken')), clipboard: { writeText } });
		expect(await deel('de uitleg')).toBe('gekopieerd');
		expect(writeText).toHaveBeenCalled();
	});

	/* En lukt er helemaal niets, dan zegt hij dat, zodat het scherm de tekst kan
	   laten zien om met de hand te pakken. */
	it('zegt het als de trainer het zelf moet doen', async () => {
		metNavigator({ clipboard: undefined });
		expect(await deel('de uitleg')).toBe('zelf');
	});
});
