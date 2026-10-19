<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { text } from '$lib/text/nl';
	import { app } from '$lib/store.svelte';
	import { zetKop } from '$lib/header.svelte';
	import { shortDate } from '$lib/domain/dates';
	import { OPEN, VERENIGING, soorten, taken } from '$lib/actions/program';
	import type { TaskKind } from '$lib/domain/types';

	/* Eén wedstrijd uit het programma: bijwerken, wie wat regelt, en op de dag zelf beginnen. */
	const t = $derived(app.toestand);
	const p = $derived((t.program ?? []).find((x) => x.id === page.params.id));
	const vandaag = new Date().toISOString().slice(0, 10);

	$effect(() => zetKop(p ? shortDate(p.date) + ' · ' + p.opponent : text.program.title));

	const naam = (id: string | undefined) => t.players.find((s) => s.id === id)?.name ?? '?';
	/* Uit regelt de thuisclub de limonade en het fluiten; thuis rijdt niemand. */
	const eenmalig = $derived(p ? soorten(p.home).filter((s) => s !== 'rijden') : []);

	function taakVan(wedstrijd: string, soort: TaskKind) {
		return taken(t, wedstrijd).find((x) => x.kind === soort);
	}

	function begin(id: string) {
		if (app.startFromProgram(id)) goto('/app/aanwezig');
	}
</script>

<main>
	<div class="pad">
		{#if p}
			{@const declined = taken(t, p.id).filter((x) => !x.player && x.declinedBy)}
			<h2>{text.program.line(p.home, p.opponent, p.time ?? '')}</h2>
			<div class="tweekolom">
				<label class="vak">
					{text.program.dateLabel}
					<input
						type="date"
						value={p.date}
						onchange={(e) => app.updateProgram(p.id, { datum: e.currentTarget.value })}
					/>
				</label>
				<label class="vak">
					{text.program.timeLabel}
					<input
						type="time"
						value={p.time ?? ''}
						onchange={(e) => app.updateProgram(p.id, { aanvang: e.currentTarget.value || null })}
					/>
				</label>
			</div>
			<div class="tweekolom">
				<label class="vak">
					{text.program.opponentLabel}
					<input
						value={p.opponent}
						onchange={(e) => app.updateProgram(p.id, { tegenstander: e.currentTarget.value })}
					/>
				</label>
				<label class="vak">
					{text.program.homeLabel}
					<select
						value={p.home ? 'thuis' : 'uit'}
						onchange={(e) => app.updateProgram(p.id, { thuis: e.currentTarget.value === 'thuis' })}
					>
						<option value="thuis">{text.program.home}</option>
						<option value="uit">{text.program.away}</option>
					</select>
				</label>
			</div>

			<h2>{text.program.whoDoesWhat}</h2>
			<table class="uitslag taken">
				<tbody>
					{#each eenmalig as soort (soort)}
						{@const taak = taakVan(p.id, soort)}
						<tr>
							<td>{text.program.kinds[soort]}</td>
							<td>
								<select
									aria-label={text.program.kinds[soort] + ' ' + p.opponent}
									value={!taak ? '' : taak.club ? VERENIGING : (taak.player ?? OPEN)}
									onchange={(e) => app.setTask(p.id, soort, e.currentTarget.value || null)}
								>
									<option value="">{text.program.nobody}</option>
									<option value={OPEN}>{text.program.openOption}</option>
									{#if soort === 'fluiten'}
										<option value={VERENIGING}>{text.program.club}</option>
									{/if}
									{#each t.players as speler (speler.id)}
										<option value={speler.id}>{speler.name}</option>
									{/each}
								</select>
							</td>
						</tr>
					{/each}
					{#each p.home ? [] : taken(t, p.id).filter((x) => x.kind === 'rijden') as taak (taak.id)}
						<tr>
							<td>{text.program.kinds.rijden}</td>
							<td>
								<select
									aria-label={text.program.kinds.rijden + ' ' + p.opponent}
									value={taak.player ?? ''}
									onchange={(e) => app.assignTask(taak.id, e.currentTarget.value || null)}
								>
									<option value="">{text.program.open}</option>
									{#each t.players as speler (speler.id)}
										<option value={speler.id}>{speler.name}</option>
									{/each}
								</select>
								<button class="klein" aria-label="Haal weg" onclick={() => app.removeTask(taak.id)}>×</button>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
			{#if declined.length}
				<p class="uitleg mager">
					{declined
						.map(
							(x) => text.program.declined(naam(x.declinedBy)) + ' (' + text.program.kinds[x.kind].toLowerCase() + ')'
						)
						.join(', ')}
				</p>
			{/if}

			<div class="knoprij" style="padding-left: 0">
				{#if !p.home}
					<button onclick={() => app.addTask(p.id, 'rijden', null)}>{text.program.addDriver}</button>
				{/if}
				{#if p.date <= vandaag && !(t.match && !t.match.archived)}
					<button class="prim" onclick={() => begin(p.id)}>{text.program.startToday}</button>
				{/if}
				<button
					class="uit"
					onclick={() => {
						if (confirm(text.program.confirmRemove(p.opponent))) {
							app.removeFromProgram(p.id);
							goto('/app/programma');
						}
					}}>{text.program.remove}</button
				>
			</div>
		{:else}
			<p class="uitleg">{text.program.gone}</p>
		{/if}
		<p><a href="/app/programma">{text.program.backToList}</a></p>
	</div>
</main>

<style>
	.taken td:first-child {
		width: 30%;
	}
	.taken select {
		width: auto;
		min-width: 9em;
	}
</style>
