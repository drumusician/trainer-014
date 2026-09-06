<script lang="ts">
	import { thinAttendance, attendanceOf } from '$lib/domain/attendance';
	import { app } from '$lib/store.svelte';
	import { zetKop } from '$lib/header.svelte';
	import { text } from '$lib/text/nl';

	$effect(() => zetKop(text.attendance.title, '/app', text.common.back));

	const w = $derived(app.match);
	const absent = $derived(new Set(w?.absent ?? []));
	const er = $derived(app.toestand.players.filter((p) => !absent.has(p.id)).length);
	/* Once the match is running this is no longer a setup screen but a correction. */
	const bezig = $derived(app.kickedOff && !w?.finished);
</script>

<main>
	<div class="pad">
		{#if !w}
			<p class="uitleg">{text.attendance.noMatch}</p>
			<div class="knoprij" style="padding-left: 0"><a class="knop prim" href="/app">{text.common.back}</a></div>
		{:else}
			<h2>{text.attendance.opponentHeading}</h2>
			<div class="tweekolom">
				<label class="vak">
					{text.attendance.opponentLabel}
					<input
						value={w.opponent === 'Tegenstander' ? '' : w.opponent}
						placeholder={text.attendance.opponentPlaceholder}
						onchange={(e) => app.setOpponent(e.currentTarget.value)}
					/>
				</label>
				<label class="vak">
					{text.attendance.homeOrAwayLabel}
					<select value={w.home ? 'thuis' : 'uit'} onchange={(e) => app.setHome(e.currentTarget.value === 'thuis')}>
						<option value="thuis">{text.attendance.home}</option>
						<option value="uit">{text.attendance.away}</option>
					</select>
				</label>
			</div>

			<h2>{text.attendance.heading}</h2>
			<p class="uitleg">
				{bezig ? text.attendance.hintDuringMatch : text.attendance.hintBeforeMatch}
			</p>
			<p class="telling">
				<span><b>{er}</b> {text.attendance.countRest(app.toestand.players.length)}</span>
			</p>

			{#each app.toestand.players as p (p.id)}
				{@const weg = absent.has(p.id)}
				{@const recent = attendanceOf(app.toestand.trainings, p.id, 4)}
				<div class="sregel">
					<span class="naam">
						{p.name}
						{#if thinAttendance(recent)}<span class="min mager">
								{text.attendance.sessions(recent.er, recent.totaal)}</span
							>{/if}
					</span>
					{#if bezig && app.isOnPitch(p.id)}
						<span class="presknop veld">{text.attendance.onPitch}</span>
					{:else}
						<button class="presknop {weg ? 'absent' : 'present'}" onclick={() => app.setAbsent(p.id, !weg)}>
							{weg ? text.attendance.absent : text.attendance.present}
						</button>
					{/if}
				</div>
			{/each}

			<div class="knoprij" style="padding-left: 0; margin-top: 16px">
				{#if bezig}
					<a class="knop prim" href="/app/wedstrijd">{text.attendance.backToMatch}</a>
				{:else}
					<a class="knop prim" href="/app/opstelling/wedstrijd">{text.attendance.onToLineup}</a>
				{/if}
			</div>
		{/if}
	</div>
</main>
