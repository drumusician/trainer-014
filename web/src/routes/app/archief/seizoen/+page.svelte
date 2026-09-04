<script lang="ts">
	import { makers, seizoenStand } from '$lib/domein/seizoen';
	import { app } from '$lib/toestand.svelte';
	import { zetKop } from '$lib/kop.svelte';

	$effect(() => zetKop('Seizoen', '/app/archief', 'Terug'));

	const t = $derived(app.toestand);
	const st = $derived(seizoenStand(t.archief));
	const scorers = $derived(makers(t.archief, t.spelers));

	function datumKort(d: string) {
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
		{#if !t.archief.length && !t.trainingen.length}
			<p class="uitleg">
				Nog geen bewaarde wedstrijden en geen trainingen. Sluit een wedstrijd af en bewaar hem, dan telt hij hier mee.
			</p>
		{:else if t.archief.length}
			<p style="font-size: 22px; font-weight: 700; margin: 0 0 4px">
				{st.wedstrijden}
				{st.wedstrijden === 1 ? 'wedstrijd' : 'wedstrijden'} · {st.gewonnen}W {st.gelijk}G {st.verloren}V
			</p>
			<p class="uitleg">
				{st.voor} voor, {st.tegen} tegen · {Math.round(st.seconden / 60)} minuten voetbal
			</p>

			{#if scorers.length}
				<h2>Topscorers</h2>
				<ul class="log">
					{#each scorers as r (r.naam)}
						<li>
							<b>{r.doelpunten}×</b>
							<span>
								{r.naam}
								<span class="sub">
									{r.wedstrijden.map((w) => datumKort(w.datum) + (w.aantal > 1 ? ' ' + w.aantal + '×' : '')).join(' · ')}
								</span>
							</span>
						</li>
					{/each}
				</ul>
				<p class="uitleg">
					Alleen doelpunten waarvan je de maker aantikte. De rest telt gewoon mee in de uitslag.
				</p>
			{/if}

			<div class="knoprij" style="padding-left: 0; margin-top: 16px">
				<a class="knop prim" href="/app/team/spelers">Speeltijd en presentie per speler</a>
			</div>
		{:else}
			<p class="uitleg">Nog geen bewaarde wedstrijden.</p>
		{/if}

		<div class="knoprij" style="padding-left: 0; margin-top: 16px">
			<a class="knop prim" href="/app/archief">Terug naar de wedstrijden</a>
		</div>
	</div>
</main>
