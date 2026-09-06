<script lang="ts">
	import { goto } from '$app/navigation';
	import { app } from '$lib/store.svelte';
	import { zetKop } from '$lib/header.svelte';
	import { shortDate } from '$lib/domain/dates';
	import { thinAttendance, attendanceOf } from '$lib/domain/attendance';
	import type { Training } from '$lib/domain/types';

	$effect(() => zetKop('Trainingen'));

	const trainings = $derived(app.toestand.trainings);
	const mageren = $derived(
		app.toestand.players.filter((p) => thinAttendance(attendanceOf(app.toestand.trainings, p.id, 4)))
	);

	function telling(t: Training) {
		const w = { present: 0, excused: 0, absent: 0 };
		app.toestand.players.forEach((p) => {
			const st = t.status[p.id];
			if (st) w[st]++;
		});
		return w;
	}

	function nieuw() {
		if (!app.toestand.players.length) {
			goto('/app/opzetten');
			return;
		}
		goto('/app/trainingen/' + app.newTraining().id);
	}
</script>

<main>
	<div class="pad">
		<h2>Trainingen</h2>
		{#if !app.toestand.players.length}
			<p class="uitleg">Zet eerst je selectie erin, dan kun je afvinken wie er was.</p>
		{:else if !trainings.length}
			<p class="uitleg">
				Nog geen trainingen. Maak er een aan; iedereen staat dan op aanwezig en je tikt alleen wie er niet is.
			</p>
		{:else}
			<p class="uitleg">
				Tik een training aan om hem bij te werken. De datum kun je daar aanpassen, dus een gemiste week vul je later
				gewoon in.
			</p>
			<ul class="log">
				{#each trainings as t (t.id)}
					{@const w = telling(t)}
					<li class="klikbaar">
						<a href="/app/trainingen/{t.id}">
							<b>{shortDate(t.date)}</b>
							<span>
								{w.present} aanwezig{w.excused ? ', ' + w.excused + ' afgemeld' : ''}{w.absent
									? ', ' + w.absent + ' niet gekomen'
									: ''}
							</span>
							<em>›</em>
						</a>
					</li>
				{/each}
			</ul>
		{/if}
		<div class="knoprij" style="padding-left: 0; margin-top: 12px">
			<button class="prim" onclick={nieuw}>Nieuwe training</button>
		</div>

		{#if mageren.length}
			<h2>Weinig geweest</h2>
			<p class="uitleg">Over de laatste vier trainingen. Je ziet het ook terug als je je opstelling maakt.</p>
			<table class="uitslag">
				<tbody>
					{#each mageren as p (p.id)}
						{@const r = attendanceOf(app.toestand.trainings, p.id, 4)}
						<tr>
							<td>{p.name}</td>
							<td class="m mager">{r.er}/{r.totaal}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
	</div>
</main>
