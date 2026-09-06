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
	import { text } from '$lib/text/nl';

	$effect(() => {
		reportIssue('Een scherm liep vast: ' + page.url.pathname, page.error?.message);
	});
</script>

<svelte:head><title>{text.errorPage.title} · Blaadje</title></svelte:head>

<main>
	<div class="pad">
		<h2>{text.errorPage.heading}</h2>
		<p class="uitleg">{text.errorPage.hint}</p>
		<div class="knoprij" style="padding-left: 0">
			<a class="knop prim" href="/app">{text.errorPage.toMatches}</a>
			<a class="knop" href="/app/meer">{text.errorPage.toData}</a>
		</div>
		{#if page.error?.message}
			<p class="uitleg" style="margin-top: 20px; font-size: 13px">
				{text.errorPage.forReporting} <code>{page.error.message}</code>
			</p>
		{/if}
	</div>
</main>
