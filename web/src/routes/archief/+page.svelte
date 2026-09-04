<script lang="ts">
	import { seizoenStand } from '$lib/domein/seizoen';
	import { app } from '$lib/toestand.svelte';
	import { zetKop } from '$lib/kop.svelte';
	import { datumKort } from '$lib/domein/datum';

	$effect(() => zetKop('Archief'));

	const t = $derived(app.toestand);
	const st = $derived(seizoenStand(t.archief));

</script>

<main>
	<div class="pad">
		{#if !t.archief.length}
			<h2>Wedstrijden</h2>
			<p class="uitleg">
				Nog geen bewaarde wedstrijden. Sluit een wedstrijd af en bewaar hem, dan staat hij hier met uitslag,
				speeltijden en het hele verloop.
			</p>
			{#if t.trainingen.length}
				<div class="knoprij" style="padding-left: 0">
					<a class="knop" href="/archief/seizoen">Presentie bekijken</a>
				</div>
			{/if}
		{:else}
			<h2>Seizoen</h2>
			<p style="font-size: 22px; font-weight: 700; margin: 0 0 4px">
				{st.gewonnen}W {st.gelijk}G {st.verloren}V
			</p>
			<p class="uitleg">{st.voor} voor, {st.tegen} tegen · {Math.round(st.seconden / 60)} minuten voetbal</p>
			<div class="knoprij" style="padding-left: 0">
				<a class="knop prim" href="/archief/seizoen">Speeltijd, topscorers en presentie</a>
			</div>

			<h2>Wedstrijden</h2>
			<p class="uitleg">Tik een wedstrijd aan om hem terug te kijken of bij te werken.</p>
			<ul class="log">
				{#each t.archief as a, i (a)}
					<li class="klikbaar">
						<a href="/archief/{i}">
							<b>{datumKort(a.datum)}</b>
							<span>{a.thuis !== false ? 'thuis' : 'uit'} tegen {a.tegenstander}</span>
							<span style="flex: none; font-weight: 700; font-variant-numeric: tabular-nums">
								{a.stand?.[0] ?? 0}–{a.stand?.[1] ?? 0}
							</span>
							<em>›</em>
						</a>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</main>
