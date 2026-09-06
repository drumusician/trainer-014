/**
 * Browsers ruimen opslag op bij plaatsgebrek of lange inactiviteit. Een trainer
 * die in de winterstop zes weken niet opent en dan zijn seizoen kwijt is: dat is
 * het ergste wat deze app kan doen.
 *
 * We vragen de browser daarom om de opslag te beschermen. Geen garantie — de
 * browser beslist, en niet elke browser kent dit — maar het kost niets en het
 * scheelt op Chrome en Edge echt iets. Op iOS is een app op je beginscherm
 * sowieso beter af dan een tabblad.
 */
export const opslagstand = $state({
	/** null = nog niet gevraagd of niet ondersteund */
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
