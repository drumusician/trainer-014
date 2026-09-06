<script lang="ts">
	/*
	 * What you see when something breaks. Without this page you get a white screen,
	 * and the touchline is the worst possible place to have to guess.
	 *
	 * Important: there is a way back to the match here, because your data is still
	 * on your device. Nothing is lost because a screen failed.
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
