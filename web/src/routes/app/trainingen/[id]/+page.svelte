<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { app } from '$lib/store.svelte';
	import { zetKop } from '$lib/header.svelte';
	import { shortDate } from '$lib/domain/dates';
	import type { Attendance } from '$lib/domain/types';

	const WOORD: Record<Attendance, string> = { present: 'Aanwezig', excused: 'Afgemeld', absent: 'Niet gekomen' };

	const t = $derived(app.trainingById(page.params.id));

	$effect(() => zetKop(t ? 'Training ' + shortDate(t.date) : 'Training', '/app/trainingen', 'Terug'));

	const telling = $derived.by(() => {
		const w = { present: 0, excused: 0, absent: 0 };
		const training = t;
		if (training) {
			app.toestand.players.forEach((p) => {
				const st = training.status[p.id];
				if (st) w[st]++;
			});
		}
		return w;
	});

	function verwijder() {
		if (!t) return;
		if (!confirm('De training van ' + shortDate(t.date) + ' verwijderen?')) return;
		app.removeTraining(t);
		goto('/app/trainingen');
	}
</script>

<main>
	<div class="pad">
		{#if !t}
			<p class="uitleg">Deze training staat er niet meer.</p>
			<div class="knoprij" style="padding-left: 0"><a class="knop prim" href="/app/trainingen">Terug</a></div>
		{:else}
			<h2>Training</h2>
			<label class="vak">
				Datum
				<input type="date" value={t.date} onchange={(e) => app.setTrainingDate(t, e.currentTarget.value)} />
			</label>
			<p class="telling">
				<span>{telling.present} aanwezig</span><span>{telling.excused} afgemeld</span><span
					>{telling.absent} niet gekomen</span
				>
			</p>
			<p class="uitleg">Tik op de knop achter een naam om hem langs aanwezig, afgemeld en niet gekomen te zetten.</p>

			{#each app.toestand.players as p (p.id)}
				{@const st = t.status[p.id] ?? 'present'}
				<div class="sregel">
					<span class="naam">{p.name}</span>
					<button class="presknop {st}" onclick={() => app.cycleAttendance(t, p.id)}>{WOORD[st]}</button>
				</div>
			{/each}

			<div class="knoprij" style="padding-left: 0; margin-top: 16px">
				<a class="knop prim" href="/app/trainingen">Klaar</a>
				<button class="uit" onclick={verwijder}>Verwijderen</button>
			</div>
		{/if}
	</div>
</main>
