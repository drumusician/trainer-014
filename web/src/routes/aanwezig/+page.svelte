<script lang="ts">
	import { goto } from '$app/navigation';
	import { mager, presentie } from '$lib/domein/presentie';
	import { app } from '$lib/toestand.svelte';
	import { zetKop } from '$lib/kop.svelte';

	$effect(() => zetKop('Wie is er?', '/instellen', 'Terug'));

	const w = $derived(app.wedstrijd);
	const afwezig = $derived(new Set(w?.afwezig ?? []));
	const er = $derived(app.toestand.spelers.filter((p) => !afwezig.has(p.id)).length);
</script>

<main>
	<div class="pad">
		{#if !w}
			<p class="uitleg">Er is geen wedstrijd om spelers voor af te melden.</p>
			<div class="knoprij" style="padding-left: 0"><a class="knop prim" href="/instellen">Terug</a></div>
		{:else}
			<h2>Wie is er vandaag</h2>
			<p class="uitleg">
				Tik weg wie er niet is. Die staat dan niet op de bank, zodat je hem er langs de lijn niet per ongeluk in
				brengt. Wie al opgesteld stond, laat zijn plek leeg.
			</p>
			<p class="telling"><span><b>{er}</b> van de {app.toestand.spelers.length} zijn er</span></p>

			{#each app.toestand.spelers as p (p.id)}
				{@const weg = afwezig.has(p.id)}
				{@const recent = presentie(app.toestand.trainingen, p.id, 4)}
				<div class="sregel">
					<span class="naam">
						{p.naam}
						{#if mager(recent)}<span class="min mager"> {recent.er}/{recent.totaal} training</span>{/if}
					</span>
					<button class="presknop {weg ? 'nee' : 'ja'}" onclick={() => app.zetAfwezig(p.id, !weg)}>
						{weg ? 'Er niet' : 'Er wel'}
					</button>
				</div>
			{/each}

			<div class="knoprij" style="padding-left: 0; margin-top: 16px">
				<a class="knop prim" href="/opstelling/wedstrijd">Verder naar de opstelling</a>
			</div>
		{/if}
	</div>
</main>
