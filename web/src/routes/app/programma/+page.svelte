<script lang="ts">
	import { goto } from '$app/navigation';
	import { text } from '$lib/text/nl';
	import { app } from '$lib/store.svelte';
	import { zetKop } from '$lib/header.svelte';
	import { shortDate } from '$lib/domain/dates';
	import { SOORTEN, VERENIGING, beurten, isOpen, taken, telling } from '$lib/actions/program';
	import { sync } from '$lib/supabase/sync.svelte';
	import type { TaskKind } from '$lib/domain/types';

	$effect(() => zetKop(text.program.title));

	/* Zien ouders dit al? Eén keer vragen zodra we weten welk team het is. */
	let statusVoor = $state<string | null>(null);
	$effect(() => {
		const team = sync.sessie?.teamId;
		if (team && statusVoor !== team) {
			statusVoor = team;
			sync.haalTeamStatus();
		}
	});

	const t = $derived(app.toestand);
	const programma = $derived(t.program ?? []);
	const vandaag = new Date().toISOString().slice(0, 10);

	let datum = $state(vandaag);
	let aanvang = $state('');
	let tegenstander = $state('');
	let thuis = $state(true);

	let overzicht = $state<TaskKind>('fluiten');
	const wanneer = $derived(beurten(t, overzicht));

	const naam = (id: string | undefined) => t.players.find((p) => p.id === id)?.name ?? '?';
	const eenmalig = SOORTEN.filter((s) => s !== 'rijden');

	function erbij() {
		app.addToProgram(datum, aanvang || undefined, tegenstander, thuis);
		tegenstander = '';
		aanvang = '';
	}

	function taakVan(wedstrijd: string, soort: TaskKind) {
		return taken(t, wedstrijd).find((x) => x.kind === soort);
	}

	function begin(id: string) {
		if (app.startFromProgram(id)) goto('/app/aanwezig');
	}
</script>

<main>
	<div class="pad">
		<h2>{text.program.heading}</h2>
		<p class="uitleg">{programma.length ? text.program.hint : text.program.none}</p>
		{#if programma.length && sync.teamAan !== true}
			<p class="uitleg"><b class="mager">{text.program.parentsNotYet}</b></p>
		{/if}

		{#each programma as p (p.id)}
			{@const declined = taken(t, p.id).filter((x) => !x.player && x.declinedBy)}
			<section class="wedstrijd" id={p.id}>
				<h3>{shortDate(p.date)} · {text.program.line(p.home, p.opponent, p.time ?? '')}</h3>
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

				<table class="uitslag taken">
					<tbody>
						{#each eenmalig as soort (soort)}
							{@const taak = taakVan(p.id, soort)}
							<tr>
								<td>{text.program.kinds[soort]}</td>
								<td>
									<select
										aria-label={text.program.kinds[soort] + ' ' + p.opponent}
										value={taak?.club ? VERENIGING : (taak?.player ?? '')}
										onchange={(e) => app.setTask(p.id, soort, e.currentTarget.value || null)}
									>
										<option value="">{taak && isOpen(taak) ? text.program.open : text.program.nobody}</option>
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
						{#each taken(t, p.id).filter((x) => x.kind === 'rijden') as taak (taak.id)}
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
					<button onclick={() => app.addTask(p.id, 'rijden', null)}>{text.program.addDriver}</button>
					{#if p.date <= vandaag && !(t.match && !t.match.archived)}
						<button class="prim" onclick={() => begin(p.id)}>{text.program.startToday}</button>
					{/if}
					<button
						class="uit"
						onclick={() => {
							if (confirm(text.program.confirmRemove(p.opponent))) app.removeFromProgram(p.id);
						}}>{text.program.remove}</button
					>
				</div>
			</section>
		{/each}

		{#if (t.tasks ?? []).length}
			<h2>{text.program.whoHeading}</h2>
			<p class="uitleg">{text.program.whoHint}</p>
			<label class="vak">
				{text.program.whoTask}
				<select bind:value={overzicht}>
					{#each SOORTEN as soort (soort)}
						<option value={soort}>{text.program.kinds[soort]}</option>
					{/each}
				</select>
			</label>
			<div class="tweekolom wiedeedwat">
				<table class="uitslag">
					<thead><tr><th colspan="2">{text.program.howOften}</th></tr></thead>
					<tbody>
						{#each telling(t, overzicht) as regel (regel.speler.id)}
							<tr>
								<td>{regel.speler.name}</td>
								<td class="getal">{regel.keer === 0 ? text.program.notYet : regel.keer + '×'}</td>
							</tr>
						{/each}
					</tbody>
				</table>
				{#if wanneer.length}
					<table class="uitslag">
						<thead><tr><th colspan="3">{text.program.when}</th></tr></thead>
						<tbody>
							{#each wanneer as b, i (b.wedstrijd + i)}
								<tr class:geweest={b.geweest}>
									<td>{shortDate(b.datum)}</td>
									<td>{b.tegenstander}</td>
									<td>{b.club ? text.program.club : naam(b.speler)}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				{/if}
			</div>
		{/if}

		<h2>{text.program.addHeading}</h2>
		<div class="tweekolom">
			<label class="vak">
				{text.program.dateLabel}
				<input type="date" bind:value={datum} />
			</label>
			<label class="vak">
				{text.program.timeLabel}
				<input type="time" bind:value={aanvang} />
			</label>
		</div>
		<div class="tweekolom">
			<label class="vak">
				{text.program.opponentLabel}
				<input bind:value={tegenstander} placeholder="Sparta" />
			</label>
			<label class="vak">
				{text.program.homeLabel}
				<select bind:value={thuis}>
					<option value={true}>{text.program.home}</option>
					<option value={false}>{text.program.away}</option>
				</select>
			</label>
		</div>
		<div class="knoprij" style="padding-left: 0">
			<button class="prim" disabled={!datum} onclick={erbij}>{text.program.add}</button>
		</div>
	</div>
</main>

<style>
	.wedstrijd {
		border-top: 1px solid var(--lijn, #ddd);
		padding-top: 12px;
		margin-top: 12px;
	}
	.taken td:first-child {
		width: 30%;
	}
	.wiedeedwat {
		align-items: start;
		margin-top: 10px;
	}
	.wiedeedwat .getal {
		text-align: right;
		color: var(--zacht, #666);
	}
	.wiedeedwat .geweest td {
		color: var(--zacht, #666);
	}
	.taken select {
		width: auto;
		min-width: 9em;
	}
</style>
