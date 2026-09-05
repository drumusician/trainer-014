<script lang="ts">
	import { goto } from '$app/navigation';
	import { app } from '$lib/toestand.svelte';
	import { zetKop } from '$lib/kop.svelte';
	import { datumKort } from '$lib/domein/datum';
	import type { Training } from '$lib/domein/types';

	$effect(() => zetKop('Trainingen', '/app/team', 'Terug'));

	const trainingen = $derived(app.toestand.trainingen);

	function telling(t: Training) {
		const w = { ja: 0, af: 0, nee: 0 };
		app.toestand.spelers.forEach((p) => {
			const st = t.status[p.id];
			if (st) w[st]++;
		});
		return w;
	}

	function nieuw() {
		if (!app.toestand.spelers.length) {
			goto('/app/opzetten');
			return;
		}
		goto('/app/trainingen/' + app.nieuweTraining().id);
	}
</script>

<main>
	<div class="pad">
		<h2>Trainingen</h2>
		{#if !app.toestand.spelers.length}
			<p class="uitleg">Zet eerst je selectie erin, dan kun je afvinken wie er was.</p>
		{:else if !trainingen.length}
			<p class="uitleg">
				Nog geen trainingen. Maak er een aan; iedereen staat dan op aanwezig en je tikt alleen wie er niet is.
			</p>
		{:else}
			<p class="uitleg">
				Tik een training aan om hem bij te werken. De datum kun je daar aanpassen, dus een gemiste week vul je later
				gewoon in.
			</p>
			<ul class="log">
				{#each trainingen as t (t.id)}
					{@const w = telling(t)}
					<li class="klikbaar">
						<a href="/app/trainingen/{t.id}">
							<b>{datumKort(t.datum)}</b>
							<span>
								{w.ja} aanwezig{w.af ? ', ' + w.af + ' afgemeld' : ''}{w.nee
									? ', ' + w.nee + ' niet gekomen'
									: ''}
							</span>
							<em>›</em>
						</a>
					</li>
				{/each}
			</ul>
		{/if}
		<div class="knoprij" style="padding-left: 0; margin-top: 12px">
			<button class="prim" onclick={nieuw}>Nieuwe training</button>
		</div>
	</div>
</main>
