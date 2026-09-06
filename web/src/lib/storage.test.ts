import { beforeEach, describe, expect, it, vi } from 'vitest';
import { opslagstand, vraagBlijvendeOpslag } from './storage.svelte';

/*
 * De browser mag opslag weggooien als er ruimte nodig is. Een trainer die zes
 * weken winterstop niet opent en dan zijn seizoen kwijt is: dat is het ergste
 * wat deze app kan doen. Daarom vragen we om bescherming, en daarom moet het
 * antwoord kloppen — ook als de browser het niet kent.
 */
function metOpslag(waarde: Partial<StorageManager> | undefined) {
	Object.defineProperty(navigator, 'storage', { value: waarde, writable: true, configurable: true });
}

beforeEach(() => {
	opslagstand.blijvend = null;
	opslagstand.ondersteund = false;
});

describe('blijvende opslag vragen', () => {
	it('doet niets in een browser die het niet kent', async () => {
		metOpslag(undefined);
		await vraagBlijvendeOpslag();
		expect(opslagstand.ondersteund).toBe(false);
		expect(opslagstand.blijvend).toBeNull();
	});

	it('vraagt niet opnieuw als het al beschermd is', async () => {
		const persist = vi.fn();
		metOpslag({ persisted: async () => true, persist });
		await vraagBlijvendeOpslag();
		expect(opslagstand.ondersteund).toBe(true);
		expect(opslagstand.blijvend).toBe(true);
		expect(persist).not.toHaveBeenCalled();
	});

	it('vraagt erom als het nog niet beschermd is', async () => {
		metOpslag({ persisted: async () => false, persist: async () => true });
		await vraagBlijvendeOpslag();
		expect(opslagstand.blijvend).toBe(true);
	});

	/* Een browser mag nee zeggen. Dan hoort de app dat te weten en het scherm te
	   waarschuwen dat de gegevens kunnen verdwijnen. */
	it('onthoudt een weigering', async () => {
		metOpslag({ persisted: async () => false, persist: async () => false });
		await vraagBlijvendeOpslag();
		expect(opslagstand.ondersteund).toBe(true);
		expect(opslagstand.blijvend).toBe(false);
	});

	it('valt terug op onbekend als de browser struikelt', async () => {
		metOpslag({
			persisted: async () => {
				throw new Error('nee');
			},
			persist: async () => true
		});
		await vraagBlijvendeOpslag();
		expect(opslagstand.blijvend).toBeNull();
	});
});
