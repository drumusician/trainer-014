<script lang="ts">
	import { thinAttendance } from '$lib/domain/attendance';
	import { percentage, sorteer, spelersOverzicht, type Sortering } from '$lib/domain/players';
	import { app } from '$lib/store.svelte';
	import { zetKop } from '$lib/header.svelte';
	import { text } from '$lib/text/nl';

	$effect(() => zetKop(text.players.title, '/app/team', text.common.back));

	let hoe = $state<Sortering>('minuten');

	const t = $derived(app.toestand);
	const rijen = $derived(sorteer(spelersOverzicht(t.players, t.archive, t.trainings), hoe));
	const langst = $derived(Math.max(1, ...rijen.map((r) => r.seconds)));

	const KNOPPEN: { hoe: Sortering; name: string }[] = [
		{ hoe: 'minuten', name: text.players.sortByMinutes },
		{ hoe: 'presentie', name: text.players.sortByAttendance },
		{ hoe: 'doelpunten', name: text.players.sortByGoals },
		{ hoe: 'naam', name: text.players.sortByName }
	];
</script>

<main>
	<div class="pad">
		{#if !t.players.length}
			<h2>{text.players.heading}</h2>
			<p class="uitleg">{text.players.empty}</p>
		{:else}
			<h2>{text.players.heading}</h2>
			<p class="uitleg">
				{text.players.hint(t.archive.length, t.trainings.length)}
			</p>
			<div class="sorteerrij">
				<span>{text.players.sortLabel}</span>
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
									{[r.canKeep ? 'K' : '', r.line].filter(Boolean).join('·') || text.players.noLine}
									{#if r.matches}
										· {text.players.matchesAverage(r.matches, Math.round(r.seconds / 60 / r.matches))}
									{/if}
									{#if r.keeperSeconds}· {text.players.keeperMinutes(Math.round(r.keeperSeconds / 60))}{/if}
									{#if r.goals}· <b>{text.players.scored(r.goals)}</b>{/if}
									{#if r.assists}· <b>{text.players.assists(r.assists)}</b>{/if}
								</span>
							</td>
							<td class="balk">
								<div class="staaf"><i style="width: {Math.round((r.seconds / langst) * 100)}%"></i></div>
							</td>
							<td class="m">
								{text.players.minutes(Math.round(r.seconds / 60))}
								<span class="sub" class:mager={thinAttendance(r.recent)}>
									{pct === null
										? text.players.noSessions
										: text.players.attendance(pct, r.attendance.er, r.attendance.totaal)}
								</span>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
			<p class="uitleg" style="margin-top: 12px">
				{text.players.footnote}
			</p>
		{/if}
	</div>
</main>
