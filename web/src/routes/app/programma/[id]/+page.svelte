<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { text } from '$lib/text/nl';
	import { app } from '$lib/store.svelte';
	import { zetKop } from '$lib/header.svelte';
	import { shortDate } from '$lib/domain/dates';
	import { OPEN, VERENIGING, kanNiet, soorten, taken, wedstrijd } from '$lib/actions/program';
	import { kickedOff } from '$lib/actions/clock';
	import type { TaskKind } from '$lib/domain/types';

	/* Eén wedstrijd uit het programma: bijwerken, wie wat regelt, en op de dag zelf beginnen. */
	const t = $derived(app.toestand);
	const id = $derived(page.params.id ?? '');
	const p = $derived(wedstrijd(t, id));
	/* Er is een wedstrijd afgetrapt die nog niet bewaard is: die gaat voor. */
	const bezig = $derived(!!t.match && !t.match.archived && kickedOff(t.match));
	const vandaag = new Date().toISOString().slice(0, 10);

	$effect(() => zetKop(p ? shortDate(p.date) + ' · ' + p.opponent : text.program.title));

	const naam = (id: string | undefined) => t.players.find((s) => s.id === id)?.name ?? '?';
	/* Uit regelt de thuisclub de limonade en het fluiten; thuis rijdt niemand. */
	const eenmalig = $derived(p ? soorten(p.home).filter((s) => s !== 'rijden') : []);

	function taakVan(wedstrijd: string, soort: TaskKind) {
		return taken(t, wedstrijd).find((x) => x.kind === soort);
	}

	/* Met een opstelling die al klaarstaat daarheen, anders eerst wie er is. */
	function begin() {
		const klaar = Object.values(p?.lineup ?? {}).some(Boolean);
		if (!app.startFromProgram(id)) return;
		goto(klaar ? '/app/opstelling/wedstrijd' : '/app/aanwezig');
	}
</script>

<main>
	<div class="pad">
		<a class="terug" href="/app/programma">{text.program.backToList}</a>
		{#if p}
			{@const declined = taken(t, id).filter((x) => !x.player && x.declinedBy)}
			<div class="tweekolom">
				<label class="vak">
					{text.program.dateLabel}
					<input type="date" value={p.date} onchange={(e) => app.updateProgram(id, { datum: e.currentTarget.value })} />
				</label>
				<label class="vak">
					{text.program.timeLabel}
					<input
						type="time"
						value={p.time ?? ''}
						onchange={(e) => app.updateProgram(id, { aanvang: e.currentTarget.value || null })}
					/>
				</label>
			</div>
			<div class="tweekolom">
				<label class="vak">
					{text.program.opponentLabel}
					<input value={p.opponent} onchange={(e) => app.updateProgram(id, { tegenstander: e.currentTarget.value })} />
				</label>
				<label class="vak">
					{text.program.homeLabel}
					<select
						value={p.home ? 'thuis' : 'uit'}
						onchange={(e) => app.updateProgram(id, { thuis: e.currentTarget.value === 'thuis' })}
					>
						<option value="thuis">{text.program.home}</option>
						<option value="uit">{text.program.away}</option>
					</select>
				</label>
			</div>

			<h2>{text.program.whoDoesWhat}</h2>
			<div class="taken">
				{#each eenmalig as soort (soort)}
					{@const taak = taakVan(id, soort)}
					<label class="taak">
						<span>{text.program.kinds[soort]}</span>
						<select
							aria-label={text.program.kinds[soort] + ' ' + p.opponent}
							value={!taak ? '' : taak.club ? VERENIGING : (taak.player ?? OPEN)}
							onchange={(e) => app.setTask(id, soort, e.currentTarget.value || null)}
						>
							<option value="">{text.program.nobodyOption}</option>
							<option value={OPEN}>{text.program.openOption}</option>
							{#if soort === 'fluiten'}
								<option value={VERENIGING}>{text.program.club}</option>
							{/if}
							{#each t.players as speler (speler.id)}
								<option value={speler.id}>{speler.name}</option>
							{/each}
						</select>
					</label>
				{/each}
				{#each p.home ? [] : taken(t, id).filter((x) => x.kind === 'rijden') as taak (taak.id)}
					<div class="taak">
						<span>{text.program.kinds.rijden}</span>
						<select
							aria-label={text.program.kinds.rijden + ' ' + p.opponent}
							value={taak.player ?? ''}
							onchange={(e) => app.assignTask(taak.id, e.currentTarget.value || null)}
						>
							<option value="">{text.program.openOption}</option>
							{#each t.players as speler (speler.id)}
								<option value={speler.id}>{speler.name}</option>
							{/each}
						</select>
						<button class="klein weg" aria-label="Haal weg" onclick={() => app.removeTask(taak.id)}>×</button>
					</div>
				{/each}
			</div>
			{#if declined.length}
				<p class="uitleg mager">
					{declined
						.map(
							(x) => text.program.declined(naam(x.declinedBy)) + ' (' + text.program.kinds[x.kind].toLowerCase() + ')'
						)
						.join(', ')}
				</p>
			{/if}

			{#if !p.home}
				<p class="uitleg mager">{text.program.driversThemselves}</p>
			{/if}
			{#if kanNiet(t, id).length}
				<h2>{text.program.absentHeading}</h2>
				<p>
					{kanNiet(t, id)
						.map((x) => x.name)
						.join(', ')}
				</p>
				<p class="uitleg mager">{text.program.absentHint}</p>
			{/if}

			<div class="knoprij" style="padding-left: 0; margin-top: 16px">
				{#if !p.home}
					<button onclick={() => app.addTask(id, 'rijden', null)}>{text.program.addDriver}</button>
				{/if}
				{#if t.match?.id === id}
					<a class="knop prim" href="/app/opstelling/wedstrijd">{text.program.continueLineup}</a>
				{:else if !bezig}
					<button class="prim" onclick={begin}
						>{p.date <= vandaag
							? text.program.startToday
							: Object.values(p.lineup ?? {}).some(Boolean)
								? text.program.continueLineup
								: text.program.makeLineup}</button
					>
				{/if}
				<button
					class="uit"
					onclick={() => {
						if (confirm(text.program.confirmRemove(p.opponent))) {
							app.removeFromProgram(id);
							goto('/app/programma');
						}
					}}>{text.program.remove}</button
				>
			</div>
		{:else}
			<p class="uitleg">{text.program.gone}</p>
		{/if}
	</div>
</main>

<style>
	.terug {
		display: inline-block;
		margin-bottom: 14px;
		color: var(--groen);
		text-decoration: none;
		font-size: 14px;
	}
	.taken {
		border-top: 1px solid var(--lijn);
	}
	.taak {
		display: grid;
		grid-template-columns: 110px 1fr auto;
		align-items: center;
		gap: 10px;
		padding: 8px 0;
		border-bottom: 1px solid var(--lijn);
		font-size: 15px;
	}
	.taak select {
		width: 100%;
		min-width: 0;
		font: inherit;
		font-size: 16px;
		padding: 8px 10px;
		border: 1px solid var(--lijn);
		border-radius: 9px;
		background: #fff;
		color: var(--inkt);
	}
	.taak .weg {
		padding: 6px 12px;
	}
</style>
