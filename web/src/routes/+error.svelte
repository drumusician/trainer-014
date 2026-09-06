<script lang="ts">
	/*
	 * Wat je ziet als er iets breekt. Zonder deze pagina krijg je een wit scherm,
	 * en dat is langs de lijn het slechtste moment om te moeten raden.
	 *
	 * Belangrijk: hier staat een weg terug naar de wedstrijd, want je gegevens
	 * staan gewoon nog op je toestel. Er is niets kwijt door een scherm dat het
	 * niet doet.
	 */
	import { page } from '$app/state';
	import { reportIssue } from '$lib/issues.svelte';

	$effect(() => {
		reportIssue('Een scherm liep vast: ' + page.url.pathname, page.error?.message);
	});
</script>

<svelte:head><title>Er ging iets mis · Blaadje</title></svelte:head>

<main>
	<div class="pad">
		<h2>Er ging iets mis</h2>
		<p class="uitleg">Dit scherm kwam er niet uit. Je gegevens staan gewoon nog op dit toestel — er is niets kwijt.</p>
		<div class="knoprij" style="padding-left: 0">
			<a class="knop prim" href="/app">Terug naar de wedstrijden</a>
			<a class="knop" href="/app/meer">Gegevens en back-up</a>
		</div>
		{#if page.error?.message}
			<p class="uitleg" style="margin-top: 20px; font-size: 13px">
				Voor als je het doorgeeft: <code>{page.error.message}</code>
			</p>
		{/if}
	</div>
</main>
