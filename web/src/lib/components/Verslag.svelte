<script lang="ts">
	import { text } from '$lib/text/nl';
	import { reportText, type ReportSource } from '$lib/domain/report';
	import { app } from '$lib/store.svelte';

	let { bron }: { bron: ReportSource } = $props();
	let tekst = $state('');

	async function kopieer() {
		tekst = reportText(bron, app.toestand.players, app.toestand.reportSubs);
		try {
			await navigator.clipboard.writeText(tekst);
		} catch {
			/* then copy it by hand from the box below */
		}
	}
</script>

<div class="knoprij" style="padding-left: 0; margin-top: 16px">
	<button class="prim" onclick={kopieer}>Verslag kopiëren</button>
	<button
		onclick={() => {
			app.toestand.reportSubs = !app.toestand.reportSubs;
			app.save();
			if (tekst) kopieer();
		}}
	>
		Wissels: {app.toestand.reportSubs ? 'wel' : 'niet'} mee
	</button>
</div>
{#if tekst}
	<p class="uitleg" style="margin-top: 12px">{text.afterMatch.copied}</p>
	<textarea readonly style="min-height: 160px">{tekst}</textarea>
{/if}
