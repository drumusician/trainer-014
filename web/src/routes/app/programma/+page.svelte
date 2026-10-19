<script lang="ts">
	import { text } from '$lib/text/nl';
	import { app } from '$lib/store.svelte';
	import { zetKop } from '$lib/header.svelte';
	import { shortDate } from '$lib/domain/dates';
	import { SOORTEN, beurten, samenvatting, telling } from '$lib/actions/program';
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

	function erbij() {
		app.addToProgram(datum, aanvang || undefined, tegenstander, thuis);
		tegenstander = '';
		aanvang = '';
	}
</script>

<main>
	<div class="pad">
		<h2>{text.program.heading}</h2>
		<p class="uitleg">{programma.length ? text.program.hint : text.program.none}</p>
		{#if programma.length && sync.teamAan !== true}
			<p class="uitleg"><b class="mager">{text.program.parentsNotYet}</b></p>
		{/if}

		{#if programma.length}
			<ul class="log">
				{#each programma as p (p.id)}
					{@const wie = samenvatting(t, p.id, (id) => t.players.find((s) => s.id === id)?.name)}
					<li class="klikbaar">
						<a href="/app/programma/{p.id}">
							<b>{shortDate(p.date)}</b>
							<span>
								{text.program.line(p.home, p.opponent, p.time ?? '')}
								{#if wie}<small class="samenvatting">{wie}</small>{/if}
							</span>
							<em>›</em>
						</a>
					</li>
				{/each}
			</ul>
		{/if}

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
	.samenvatting {
		display: block;
		color: var(--zacht, #666);
		font-size: 13px;
		margin-top: 2px;
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
</style>
