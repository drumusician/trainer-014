<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { app } from '$lib/toestand.svelte';
	import { zetKop } from '$lib/kop.svelte';
	import { datumKort } from '$lib/domein/datum';
	import type { Aanwezigheid } from '$lib/domein/types';

	const WOORD: Record<Aanwezigheid, string> = { ja: 'Aanwezig', af: 'Afgemeld', nee: 'Niet gekomen' };

	const t = $derived(app.trainingMetId(page.params.id));

	$effect(() => zetKop(t ? 'Training ' + datumKort(t.datum) : 'Training', '/app/trainingen', 'Terug'));

	const telling = $derived.by(() => {
		const w = { ja: 0, af: 0, nee: 0 };
		const training = t;
		if (training) {
			app.toestand.spelers.forEach((p) => {
				const st = training.status[p.id];
				if (st) w[st]++;
			});
		}
		return w;
	});

	function verwijder() {
		if (!t) return;
		if (!confirm('De training van ' + datumKort(t.datum) + ' verwijderen?')) return;
		app.verwijderTraining(t);
		goto('/app/trainingen');
	}
</script>

<main>
	<div class="pad">
		{#if !t}
			<p class="uitleg">Deze training staat er niet meer.</p>
			<div class="knoprij" style="padding-left: 0"><a class="knop prim" href="/app/trainingen">Terug</a></div>
		{:else}
			<h2>Training</h2>
			<label class="vak">
				Datum
				<input type="date" value={t.datum} onchange={(e) => app.zetTrainingDatum(t, e.currentTarget.value)} />
			</label>
			<p class="telling">
				<span>{telling.ja} aanwezig</span><span>{telling.af} afgemeld</span><span>{telling.nee} niet gekomen</span>
			</p>
			<p class="uitleg">Tik op de knop achter een naam om hem langs aanwezig, afgemeld en niet gekomen te zetten.</p>

			{#each app.toestand.spelers as p (p.id)}
				{@const st = t.status[p.id] ?? 'ja'}
				<div class="sregel">
					<span class="naam">{p.naam}</span>
					<button class="presknop {st}" onclick={() => app.tikPresentie(t, p.id)}>{WOORD[st]}</button>
				</div>
			{/each}

			<div class="knoprij" style="padding-left: 0; margin-top: 16px">
				<a class="knop prim" href="/app/trainingen">Klaar</a>
				<button class="uit" onclick={verwijder}>Verwijderen</button>
			</div>
		{/if}
	</div>
</main>
