<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { app } from '$lib/store.svelte';
	import { zetKop } from '$lib/header.svelte';
	import { shortDate } from '$lib/domain/dates';
	import { text } from '$lib/text/nl';

	const t = $derived(app.trainingById(page.params.id));

	$effect(() =>
		zetKop(
			t ? text.trainings.oneTitle(shortDate(t.date)) : text.trainings.oneHeading,
			'/app/trainingen',
			text.common.back
		)
	);

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
		if (!confirm(text.trainings.confirmRemove(shortDate(t.date)))) return;
		app.removeTraining(t);
		goto('/app/trainingen');
	}
</script>

<main>
	<div class="pad">
		{#if !t}
			<p class="uitleg">{text.trainings.gone}</p>
			<div class="knoprij" style="padding-left: 0">
				<a class="knop prim" href="/app/trainingen">{text.common.back}</a>
			</div>
		{:else}
			<h2>{text.trainings.oneHeading}</h2>
			<label class="vak">
				{text.trainings.dateLabel}
				<input type="date" value={t.date} onchange={(e) => app.setTrainingDate(t, e.currentTarget.value)} />
			</label>
			<p class="telling">
				<span>{text.trainings.present(telling.present)}</span><span>{text.trainings.excused(telling.excused)}</span
				><span>{text.trainings.absent(telling.absent)}</span>
			</p>
			<p class="uitleg">{text.trainings.cycleHint}</p>

			{#each app.toestand.players as p (p.id)}
				{@const st = t.status[p.id] ?? 'present'}
				<div class="sregel">
					<span class="naam">{p.name}</span>
					<button class="presknop {st}" onclick={() => app.cycleAttendance(t, p.id)}
						>{text.trainings.statusWord[st]}</button
					>
				</div>
			{/each}

			<div class="knoprij" style="padding-left: 0; margin-top: 16px">
				<a class="knop prim" href="/app/trainingen">{text.common.done}</a>
				<button class="uit" onclick={verwijder}>{text.trainings.remove}</button>
			</div>
		{/if}
	</div>
</main>
