<script lang="ts">
	import { thinAttendance, attendanceOf } from '$lib/domain/attendance';
	import { app } from '$lib/store.svelte';
	import { zetKop } from '$lib/header.svelte';

	$effect(() => zetKop('Wie is er?', '/app', 'Terug'));

	const w = $derived(app.match);
	const absent = $derived(new Set(w?.absent ?? []));
	const er = $derived(app.toestand.players.filter((p) => !absent.has(p.id)).length);
	/* Loopt de wedstrijd al, dan is dit geen opzetscherm meer maar een correctie. */
	const bezig = $derived(app.kickedOff && !w?.finished);
</script>

<main>
	<div class="pad">
		{#if !w}
			<p class="uitleg">Er is geen match om players voor af te melden.</p>
			<div class="knoprij" style="padding-left: 0"><a class="knop prim" href="/app">Terug</a></div>
		{:else}
			<h2>Tegen wie</h2>
			<div class="tweekolom">
				<label class="vak">
					Tegenstander
					<input
						value={w.opponent === 'Tegenstander' ? '' : w.opponent}
						placeholder="bijv. Sparta JO11-2"
						onchange={(e) => app.setOpponent(e.currentTarget.value)}
					/>
				</label>
				<label class="vak">
					Thuis of uit
					<select value={w.home ? 'thuis' : 'uit'} onchange={(e) => app.setHome(e.currentTarget.value === 'thuis')}>
						<option value="thuis">Thuis</option>
						<option value="uit">Uit</option>
					</select>
				</label>
			</div>

			<h2>Wie is er vandaag</h2>
			<p class="uitleg">
				{#if bezig}
					De match running. Wie in het veld staat haal je off met een wissel, niet hier — anders klopt zijn playingTime
					niet meer. Van de bench afmelden kan wel.
				{:else}
					Tik weg wie er niet is. Die staat dan niet op de bench, zodat je hem er langs de lijn niet per ongeluk in
					brengt. Wie al opgesteld stond, laat zijn position leeg.
				{/if}
			</p>
			<p class="telling">
				<span><b>{er}</b> van de {app.toestand.players.length} aanwezig</span>
			</p>

			{#each app.toestand.players as p (p.id)}
				{@const weg = absent.has(p.id)}
				{@const recent = attendanceOf(app.toestand.trainings, p.id, 4)}
				<div class="sregel">
					<span class="naam">
						{p.name}
						{#if thinAttendance(recent)}<span class="min mager"> {recent.er}/{recent.totaal} training</span>{/if}
					</span>
					{#if bezig && app.isOnPitch(p.id)}
						<span class="presknop veld">In het veld</span>
					{:else}
						<button class="presknop {weg ? 'absent' : 'present'}" onclick={() => app.setAbsent(p.id, !weg)}>
							{weg ? 'Er niet' : 'Er wel'}
						</button>
					{/if}
				</div>
			{/each}

			<div class="knoprij" style="padding-left: 0; margin-top: 16px">
				{#if bezig}
					<a class="knop prim" href="/app/wedstrijd">Terug naar de match</a>
				{:else}
					<a class="knop prim" href="/app/opstelling/wedstrijd">Verder naar de lineup</a>
				{/if}
			</div>
		{/if}
	</div>
</main>
