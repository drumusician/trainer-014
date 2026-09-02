<script lang="ts">
	import { verslagTekst, type Verslagbron } from '$lib/domein/verslag';
	import { app } from '$lib/toestand.svelte';

	let { bron }: { bron: Verslagbron } = $props();
	let tekst = $state('');

	async function kopieer() {
		tekst = verslagTekst(bron, app.toestand.spelers, app.toestand.verslagWissels);
		try {
			await navigator.clipboard.writeText(tekst);
		} catch {
			/* dan met de hand uit het vak hieronder */
		}
	}
</script>

<div class="knoprij" style="padding-left: 0; margin-top: 16px">
	<button class="prim" onclick={kopieer}>Verslag kopiëren</button>
	<button
		onclick={() => {
			app.toestand.verslagWissels = !app.toestand.verslagWissels;
			app.bewaar();
			if (tekst) kopieer();
		}}
	>
		Wissels: {app.toestand.verslagWissels ? 'wel' : 'niet'} mee
	</button>
</div>
{#if tekst}
	<p class="uitleg" style="margin-top: 12px">Gekopieerd. Staat hier ook, voor als plakken niet lukt.</p>
	<textarea readonly style="min-height: 160px">{tekst}</textarea>
{/if}
