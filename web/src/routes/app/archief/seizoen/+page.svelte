<script lang="ts">
	import { makers, seizoenStand } from '$lib/domain/season';
	import { app } from '$lib/store.svelte';
	import { zetKop } from '$lib/header.svelte';
	import { text } from '$lib/text/nl';

	$effect(() => zetKop(text.season.title, '/app', text.common.back));

	const t = $derived(app.toestand);
	const st = $derived(seizoenStand(t.archive));
	const scorers = $derived(makers(t.archive, t.players));

	function shortDate(d: string) {
		try {
			return new Date(d + 'T12:00:00').toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
		} catch {
			return d;
		}
	}
</script>

<main>
	<div class="pad">
		<h2>{text.season.heading}</h2>
		{#if !t.archive.length && !t.trainings.length}
			<p class="uitleg">{text.season.empty}</p>
		{:else if t.archive.length}
			<p style="font-size: 22px; font-weight: 700; margin: 0 0 4px">
				{text.season.record(st.wedstrijden, st.gewonnen, st.gelijk, st.verloren)}
			</p>
			<p class="uitleg">
				{text.season.goals(st.voor, st.tegen, Math.round(st.seconds / 60))}
			</p>

			{#if scorers.length}
				<h2>{text.season.scorersHeading}</h2>
				<ul class="log">
					{#each scorers as r (r.name)}
						<li>
							<b>{r.doelpunten}×</b>
							<span>
								{r.name}
								<span class="sub">
									{r.wedstrijden.map((w) => shortDate(w.date) + (w.aantal > 1 ? ' ' + w.aantal + '×' : '')).join(' · ')}
								</span>
							</span>
						</li>
					{/each}
				</ul>
				<p class="uitleg">{text.season.scorersHint}</p>
			{/if}

			<div class="knoprij" style="padding-left: 0; margin-top: 16px">
				<a class="knop prim" href="/app/team/spelers">{text.season.toPlayers}</a>
			</div>
		{:else}
			<p class="uitleg">{text.season.noMatchesYet}</p>
		{/if}
	</div>
</main>
