<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import Speeltijd from '$lib/components/Speeltijd.svelte';
	import Verloop from '$lib/components/Verloop.svelte';
	import Verslag from '$lib/components/Verslag.svelte';
	import { mmss, positionText } from '$lib/domain/time';
	import { shortDate, datumMetJaar } from '$lib/domain/dates';
	import { timelineRows } from '$lib/domain/report';
	import { bronVanArchief } from '$lib/domain/report';
	import { app } from '$lib/store.svelte';
	import { zetKop } from '$lib/header.svelte';
	import { text } from '$lib/text/nl';

	const i = $derived(Number(page.params.i));
	const a = $derived(app.toestand.archive[i]);
	/* Derived, not called in the template: that recalculates on every render. */
	const regels = $derived(a ? timelineRows(a.events ?? [], app.toestand.players, a.names, a.parts, a.formation) : []);

	$effect(() =>
		zetKop(
			a ? text.archivedMatch.title(shortDate(a.date), a.opponent) : text.archivedMatch.fallbackTitle,
			'/app',
			text.common.back
		)
	);

	/** The current name, even if someone was renamed after the match. */
	function naamNu(r: { id?: string; name: string }) {
		return (r.id && app.playerById(r.id)?.name) || r.name;
	}

	let bewerken = $state(false);
	let nieuwMinuut = $state('');
	let nieuwMaker = $state('');
	let nieuwTegen = $state(false);

	/* Who played in that match, for the list of scorers. */
	const makers = $derived(
		(a?.playingTime ?? [])
			.filter((r) => (r.seconds ?? 0) > 0)
			.map((r) => ({ id: r.id ?? '', name: naamNu(r) }))
			.filter((r) => r.id)
	);

	function doelpuntErbij() {
		const m = Number(nieuwMinuut);
		if (!Number.isFinite(m) || m < 0) {
			alert('Vul een minuut in.');
			return;
		}
		app.addGoal(i, m, nieuwTegen ? null : nieuwMaker || null, nieuwTegen);
		nieuwMinuut = '';
		nieuwMaker = '';
	}

	function verwijder() {
		if (!confirm(text.archivedMatch.confirmRemove(a.opponent, a.date))) return;
		app.removeFromArchive(i);
		goto('/app');
	}
</script>

<main>
	<div class="pad">
		{#if !a}
			<p class="uitleg">{text.archivedMatch.gone}</p>
			<div class="knoprij" style="padding-left: 0"><a class="knop prim" href="/app">{text.common.back}</a></div>
		{:else}
			{@const home = a.home !== false}
			{@const ons = a.teamName?.trim() || app.toestand.teamName}
			<h2>{text.archivedMatch.resultHeading}</h2>
			<p style="font-size: 22px; font-weight: 700; margin: 0 0 4px">
				{home ? ons : a.opponent}
				{a.score[0]} – {a.score[1]}
				{home ? a.opponent : ons}
			</p>
			<p class="uitleg">{text.archivedMatch.details(datumMetJaar(a.date), mmss(a.duration ?? 0), a.formation)}</p>
			<div class="knoprij" style="padding-left: 0">
				<button onclick={() => (bewerken = !bewerken)}
					>{bewerken ? text.archivedMatch.doneEditing : text.archivedMatch.edit}</button
				>
			</div>

			{#if bewerken}
				<div class="tweekolom">
					<label class="vak">
						{text.archivedMatch.dateLabel}
						<input
							type="date"
							value={a.date}
							onchange={(e) => app.updateArchived(i, { date: e.currentTarget.value })}
						/>
					</label>
					<label class="vak">
						{text.archivedMatch.homeOrAwayLabel}
						<select
							value={a.home !== false ? 'thuis' : 'uit'}
							onchange={(e) => app.updateArchived(i, { home: e.currentTarget.value === 'thuis' })}
						>
							<option value="thuis">{text.archivedMatch.home}</option>
							<option value="uit">{text.archivedMatch.away}</option>
						</select>
					</label>
				</div>
				<label class="vak">
					{text.archivedMatch.opponentLabel}
					<input value={a.opponent} onchange={(e) => app.updateArchived(i, { opponent: e.currentTarget.value })} />
				</label>
			{/if}

			<h2>{text.archivedMatch.playingTimeHeading}</h2>
			<Speeltijd
				rijen={(a.playingTime ?? []).map((r) => ({
					name: naamNu(r),
					seconds: r.seconds ?? 0,
					/* oudere wedstrijden hebben alleen keeperminuten, nieuwere alle positionsOf */
					sub:
						positionText(r.positions, a.formation) ||
						(r.keeper ? text.archivedMatch.keeperMinutes(Math.round(r.keeper / 60)) : undefined)
				}))}
			/>

			<h2>{text.archivedMatch.timelineHeading}</h2>
			{#if !bewerken}
				<Verloop events={a.events ?? []} names={a.names} parts={a.parts} formation={a.formation} />
			{:else}
				<p class="uitleg">{text.archivedMatch.editHint}</p>
				<ul class="log">
					{#each regels as r (r.index)}
						<li>
							<b>{mmss(r.t)}</b>
							<span>{r.tekst}</span>
							{#if r.type === 'goal' || r.type === 'conceded'}
								<button class="klein uit" onclick={() => app.removeGoal(i, r.index)}>{text.common.delete}</button>
							{/if}
						</li>
					{/each}
				</ul>

				<h2>{text.archivedMatch.addGoalHeading}</h2>
				<div class="tweekolom">
					<label class="vak">
						{text.archivedMatch.minuteLabel}
						<input
							type="number"
							inputmode="numeric"
							bind:value={nieuwMinuut}
							placeholder={text.archivedMatch.minutePlaceholder}
						/>
					</label>
					<label class="vak">
						{text.archivedMatch.forOrAgainstLabel}
						<select bind:value={nieuwTegen}>
							<option value={false}>{text.archivedMatch.forUs(ons)}</option>
							<option value={true}>{text.archivedMatch.against}</option>
						</select>
					</label>
				</div>
				{#if !nieuwTegen}
					<label class="vak">
						{text.archivedMatch.scorerLabel}
						<select bind:value={nieuwMaker}>
							<option value="">{text.archivedMatch.scorerUnknown}</option>
							{#each makers as m (m.id)}<option value={m.id}>{m.name}</option>{/each}
						</select>
					</label>
				{/if}
				<div class="knoprij" style="padding-left: 0">
					<button class="prim" onclick={doelpuntErbij}>{text.archivedMatch.add}</button>
				</div>
			{/if}

			<h2>{text.archivedMatch.noteHeading}</h2>
			<textarea
				value={a.note ?? ''}
				placeholder={text.archivedMatch.notePlaceholder}
				oninput={(e) => app.setArchiveNote(i, e.currentTarget.value)}></textarea>

			<h2>{text.archivedMatch.shareHeading}</h2>
			<Verslag bron={bronVanArchief(a)} />

			<div class="knoprij" style="padding-left: 0; margin-top: 16px">
				<a class="knop prim" href="/app">{text.common.back}</a>
				<button class="uit" onclick={verwijder}>{text.archivedMatch.remove}</button>
			</div>
		{/if}
	</div>
</main>
