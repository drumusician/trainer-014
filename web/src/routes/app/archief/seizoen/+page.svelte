<script lang="ts">
	import { makers, seizoenStand } from '$lib/domain/season';
	import { app } from '$lib/store.svelte';
	import { zetKop } from '$lib/header.svelte';

	$effect(() => zetKop('Seizoen', '/app', 'Terug'));

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
		<h2>Seizoen</h2>
		{#if !t.archive.length && !t.trainings.length}
			<p class="uitleg">
				Nog geen bewaarde wedstrijden en geen trainings. Sluit een match af en bewaar hem, dan telt hij hier mee.
			</p>
		{:else if t.archive.length}
			<p style="font-size: 22px; font-weight: 700; margin: 0 0 4px">
				{st.wedstrijden}
				{st.wedstrijden === 1 ? 'wedstrijd' : 'wedstrijden'} · {st.gewonnen}W {st.gelijk}G {st.verloren}V
			</p>
			<p class="uitleg">
				{st.voor} voor, {st.tegen} tegen · {Math.round(st.seconds / 60)} minuten voetbal
			</p>

			{#if scorers.length}
				<h2>Topscorers</h2>
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
				<p class="uitleg">Alleen doelpunten waarvan je de maker aantikte. De rest telt gewoon mee in de uitslag.</p>
			{/if}

			<div class="knoprij" style="padding-left: 0; margin-top: 16px">
				<a class="knop prim" href="/app/team/spelers">Speeltijd en presentie per player</a>
			</div>
		{:else}
			<p class="uitleg">Nog geen bewaarde wedstrijden.</p>
		{/if}
	</div>
</main>
