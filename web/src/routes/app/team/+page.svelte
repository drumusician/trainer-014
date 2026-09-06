<script lang="ts">
	import { app } from '$lib/store.svelte';
	import { zetKop } from '$lib/header.svelte';
	import { thinAttendance, attendanceOf } from '$lib/domain/attendance';
	import { bezetting, dunneKeepersbezetting, gedrang, tekort } from '$lib/domain/coverage';
	import type { Player, FieldLine } from '$lib/domain/types';
	import { text } from '$lib/text/nl';

	$effect(() => zetKop(text.team.title));

	const t = $derived(app.toestand);
	const verdeling = $derived(bezetting(t.players, t.formation));
	const ingevuld = $derived(t.teamName !== 'Ons team');
	let namenVak = $state('');
	const LINIEKNOPPEN: FieldLine[] = ['V', 'M', 'A'];

	function wijzig(p: Player) {
		const name = prompt(text.team.askRename, p.name);
		if (name === null) return;
		if (!name.trim()) {
			if (confirm(text.team.confirmRemove(p.name))) app.removePlayer(p);
		} else {
			app.renamePlayer(p, name);
		}
	}
</script>

<main>
	<div class="pad">
		{#if t.players.length}
			<h2>{text.team.statsHeading}</h2>
			<p class="uitleg">{text.team.statsHint}</p>
			<div class="knoprij" style="padding-left: 0">
				<a class="knop prim" href="/app/team/spelers">{text.team.toStats}</a>
			</div>
		{/if}

		<h2>{text.team.squadHeading}</h2>
		{#if !t.players.length}
			<p class="uitleg">
				{text.team.emptyHint} <a href="/app/opzetten">{text.team.emptyHintLink}</a>
			</p>
			<textarea bind:value={namenVak} placeholder={text.team.namesPlaceholder}></textarea>
			<div class="knoprij" style="padding-left: 0; margin-top: 10px">
				<button
					class="prim"
					onclick={() => {
						app.addPlayerNames(namenVak);
						namenVak = '';
					}}>{text.team.add}</button
				>
			</div>
		{:else}
			<p class="uitleg">
				Zet per speler de linie: V verdediging, M middenveld, A aanval. <b>K</b> staat los: dat is iedereen die kan keepen,
				ook als hij verder in het veld speelt. Alleen K aan en de rest uit betekent: keept en verder niets. Tik een naam aan
				om te wijzigen of te verwijderen.
			</p>
			{#each t.players as p (p.id)}
				{@const recent = attendanceOf(t.trainings, p.id, 4)}
				<div class="sregel">
					<button type="button" class="naam" onclick={() => wijzig(p)}>
						{p.name}{#if thinAttendance(recent)}<span class="min mager"> {recent.er}/{recent.totaal}</span>{/if}
					</button>
					<div class="keuze">
						<button class:aan={p.keeper} onclick={() => app.toggleKeeper(p)}>K</button>
						{#each LINIEKNOPPEN as code (code)}
							<button class:aan={p.line === code} onclick={() => app.setLine(p, code)}>{code}</button>
						{/each}
					</div>
				</div>
			{/each}
			<div class="knoprij" style="padding-left: 0; margin-top: 12px">
				<button
					onclick={() => {
						const name = prompt(text.team.askName);
						if (name?.trim()) app.addPlayerNames(name);
					}}>{text.team.addPlayer}</button
				>
			</div>

			<h2>{text.team.coverageHeading(t.formation)}</h2>
			<table class="uitslag">
				<tbody>
					{#each verdeling as b (b.line)}
						<tr>
							<td>{b.name}</td>
							<td class="m" class:mager={tekort(b) || gedrang(b)}>
								{b.line === 'K' ? text.team.canKeep(b.players) : text.team.forPositions(b.players, b.positionsOf)}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
			<p class="uitleg" style="margin-top: 8px">
				{#if verdeling.some(tekort)}
					{text.team.coverageShort}
				{:else if dunneKeepersbezetting(verdeling)}
					{text.team.coverageThinKeepers}
				{:else if verdeling.some(gedrang)}
					{text.team.coverageCrowded}
				{:else}
					{text.team.coverageFine}
				{/if}
			</p>
		{/if}

		<h2>{text.team.nameHeading}</h2>
		<p class="uitleg">
			{text.team.nameHint}
			{#if !ingevuld}<b class="mager">{text.team.nameWarning}</b>{/if}
		</p>
		<label class="vak">
			{text.team.nameLabel}
			<input
				value={t.teamName}
				placeholder={text.team.namePlaceholder}
				onchange={(e) => app.setTeamName(e.currentTarget.value)}
			/>
		</label>
	</div>
</main>
