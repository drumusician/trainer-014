<script lang="ts">
	import { mager } from '$lib/domein/presentie';
	import { percentage, sorteer, spelersOverzicht, type Sortering } from '$lib/domein/spelers';
	import { app } from '$lib/toestand.svelte';
	import { zetKop } from '$lib/kop.svelte';

	$effect(() => zetKop('Spelers', '/team', 'Terug'));

	let hoe = $state<Sortering>('minuten');

	const t = $derived(app.toestand);
	const rijen = $derived(sorteer(spelersOverzicht(t.spelers, t.archief, t.trainingen), hoe));
	const langst = $derived(Math.max(1, ...rijen.map((r) => r.seconden)));

	const KNOPPEN: { hoe: Sortering; naam: string }[] = [
		{ hoe: 'minuten', naam: 'Speeltijd' },
		{ hoe: 'presentie', naam: 'Presentie' },
		{ hoe: 'doelpunten', naam: 'Doelpunten' },
		{ hoe: 'naam', naam: 'Naam' }
	];
</script>

<main>
	<div class="pad">
		{#if !t.spelers.length}
			<h2>Spelers</h2>
			<p class="uitleg">Nog geen selectie. Zet je namen erin bij Team.</p>
		{:else}
			<h2>Spelers</h2>
			<p class="uitleg">
				Alles bij elkaar: gespeelde minuten over {t.archief.length}
				{t.archief.length === 1 ? 'bewaarde wedstrijd' : 'bewaarde wedstrijden'}, en hoe vaak iemand op de training
				stond ({t.trainingen.length}
				{t.trainingen.length === 1 ? 'training' : 'trainingen'}).
			</p>
			<div class="keuze sorteer" style="margin-bottom: 12px">
				{#each KNOPPEN as k (k.hoe)}
					<button style="width: auto; padding: 7px 11px" class:aan={hoe === k.hoe} onclick={() => (hoe = k.hoe)}>
						{k.naam}
					</button>
				{/each}
			</div>

			<table class="uitslag spelers">
				<tbody>
					{#each rijen as r (r.id)}
						{@const pct = percentage(r.presentie)}
						<tr>
							<td>
								{r.naam}
								<span class="sub">
									{[r.keept ? 'K' : '', r.linie].filter(Boolean).join('·') || 'geen linie'}
									{#if r.wedstrijden}
										· {r.wedstrijden}
										{r.wedstrijden === 1 ? 'wedstrijd' : 'wedstrijden'} · gem. {Math.round(r.seconden / 60 / r.wedstrijden)} min
									{/if}
									{#if r.keeper}· {Math.round(r.keeper / 60)} min in het doel{/if}
									{#if r.doelpunten}· <b>{r.doelpunten}× gescoord</b>{/if}
									{#if r.assists}· <b>{r.assists} {r.assists === 1 ? 'assist' : 'assists'}</b>{/if}
								</span>
							</td>
							<td class="balk">
								<div class="staaf"><i style="width: {Math.round((r.seconden / langst) * 100)}%"></i></div>
							</td>
							<td class="m">
								{Math.round(r.seconden / 60)} min
								<span class="sub" class:mager={mager(r.recent)}>
									{#if pct === null}geen training{:else}{pct}% · {r.presentie.er}/{r.presentie.totaal}{/if}
								</span>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
			<p class="uitleg" style="margin-top: 12px">
				Speeltijd telt alleen wedstrijden die je bewaard hebt. Een wedstrijd waarin iemand niet in het veld kwam telt
				bij hem niet mee, dus zijn gemiddelde blijft eerlijk.
			</p>
		{/if}
	</div>
</main>
