<script lang="ts">
	import { goto } from '$app/navigation';
	import { app } from '$lib/toestand.svelte';
	import { zetKop } from '$lib/kop.svelte';
	import type { Training } from '$lib/domein/types';

	$effect(() => zetKop('Trainingen', '/instellen', 'Terug'));

	const trainingen = $derived(app.toestand.trainingen);

	function telling(t: Training) {
		const w = { ja: 0, af: 0, nee: 0 };
		app.toestand.spelers.forEach((p) => {
			const st = t.status[p.id];
			if (st) w[st]++;
		});
		return w;
	}

	function datumKort(d: string) {
		try {
			return new Date(d + 'T12:00:00').toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
		} catch {
			return d;
		}
	}

	function nieuw() {
		if (!app.toestand.spelers.length) {
			alert('Zet eerst je selectie erin.');
			return;
		}
		const t = app.nieuweTraining();
		goto('/trainingen/' + app.toestand.trainingen.indexOf(t));
	}
</script>

<main>
	<div class="pad">
		<h2>Trainingen</h2>
		{#if !trainingen.length}
			<p class="uitleg">
				Nog geen trainingen. Maak er een aan; iedereen staat dan op aanwezig en je tikt alleen wie er niet is.
			</p>
		{:else}
			<p class="uitleg">
				Tik een training aan om hem bij te werken. De datum kun je daar aanpassen, dus een gemiste week vul je later
				gewoon in.
			</p>
			<ul class="log">
				{#each trainingen as t, i (t)}
					{@const w = telling(t)}
					<li class="klikbaar">
						<a href="/trainingen/{i}">
							<b>{datumKort(t.datum)}</b>
							<span>
								{w.ja} er{w.af ? ', ' + w.af + ' afgemeld' : ''}{w.nee ? ', ' + w.nee + ' niet gekomen' : ''}
							</span>
							<em>›</em>
						</a>
					</li>
				{/each}
			</ul>
		{/if}
		<div class="knoprij" style="padding-left: 0; margin-top: 12px">
			<button class="prim" onclick={nieuw}>Nieuwe training</button>
			<a class="knop" href="/instellen">Terug</a>
		</div>
	</div>
</main>
