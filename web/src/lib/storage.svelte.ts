/**
 * Browsers clear storage when space runs short or after long inactivity. A coach
 * who does not open the app for six weeks over the winter break and then loses
 * his season: that is the worst thing this app can do.
 *
 * So we ask the browser to protect the storage. No guarantee — the browser
 * decides, and not every browser knows this — but it costs nothing and genuinely
 * helps on Chrome and Edge. On iOS an app on the home screen is better off than
 * a tab either way.
 */
export const opslagstand = $state({
	/** null = not asked yet, or not supported */
	blijvend: null as boolean | null,
	ondersteund: false
});

export async function vraagBlijvendeOpslag() {
	if (typeof navigator === 'undefined' || !navigator.storage?.persist) return;
	opslagstand.ondersteund = true;
	try {
		opslagstand.blijvend = (await navigator.storage.persisted?.()) || (await navigator.storage.persist());
	} catch {
		opslagstand.blijvend = null;
	}
}
