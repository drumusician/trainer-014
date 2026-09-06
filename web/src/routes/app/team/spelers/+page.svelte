<script lang="ts">
	import { thinAttendance } from '$lib/domain/attendance';
	import { percentage, sorteer, spelersOverzicht, type Sortering } from '$lib/domain/players';
	import { app } from '$lib/store.svelte';
	import { zetKop } from '$lib/header.svelte';

	$effect(() => zetKop('Spelers', '/app/team', 'Terug'));

	let hoe = $state<Sortering>('minuten');

	const t = $derived(app.toestand);
	const rijen = $derived(sorteer(spelersOverzicht(t.players, t.archive, t.trainings), hoe));
	const langst = $derived(Math.max(1, ...rijen.map((r) => r.seconds)));

	const KNOPPEN: { hoe: Sortering; name: string }[] = [
		{ hoe: 'minuten', name: 'Speeltijd' },
		{ hoe: 'presentie', name: 'Presentie' },
		{ hoe: 'doelpunten', name: 'Doelpunten' },
		{ hoe: 'naam', name: 'Naam' }
	];
</script>

<main>
	<div class="pad">
		{#if !t.players.length}
			<h2>Spelers</h2>
			<p class="uitleg">Nog geen selectie. Zet je namen erin bij Team.</p>
		{:else}
			<h2>Spelers</h2>
			<p class="uitleg">
				Alles bij elkaar: gespeelde minuten over {t.archive.length}
				{t.archive.length === 1 ? 'bewaarde wedstrijd' : 'bewaarde wedstrijden'}, en hoe vaak ze op de training waren ({t
					.trainings.length}
				{t.trainings.length === 1 ? 'training' : 'trainingen'}).
			</p>
			<div class="sorteerrij">
				<span>Sorteer op</span>
				<div class="keuze sorteer">
					{#each KNOPPEN as k (k.hoe)}
						<button class:aan={hoe === k.hoe} onclick={() => (hoe = k.hoe)}>{k.name}</button>
					{/each}
				</div>
			</div>

			<table class="uitslag spelers">
				<tbody>
					{#each rijen as r (r.id)}
						{@const pct = percentage(r.attendance)}
						<tr>
							<td>
								{r.name}
								<span class="sub">
									{[r.canKeep ? 'K' : '', r.line].filter(Boolean).join('·') || 'geen linie'}
									{#if r.matches}
										· {r.matches}
										{r.matches === 1 ? 'wedstrijd' : 'wedstrijden'} · gem. {Math.round(r.seconds / 60 / r.matches)} min
									{/if}
									{#if r.keeperSeconds}· {Math.round(r.keeperSeconds / 60)} min in het doel{/if}
									{#if r.goals}· <b>{r.goals}× gescoord</b>{/if}
									{#if r.assists}· <b>{r.assists} {r.assists === 1 ? 'assist' : 'assists'}</b>{/if}
								</span>
							</td>
							<td class="balk">
								<div class="staaf"><i style="width: {Math.round((r.seconds / langst) * 100)}%"></i></div>
							</td>
							<td class="m">
								{Math.round(r.seconds / 60)} min
								<span class="sub" class:mager={thinAttendance(r.recent)}>
									{#if pct === null}geen training{:else}{pct}% · {r.attendance.er}/{r.attendance.totaal}{/if}
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
