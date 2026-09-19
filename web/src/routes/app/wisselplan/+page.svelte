<script lang="ts">
	import { planStappen } from '$lib/domain/plan';
	import { app } from '$lib/store.svelte';
	import { zetKop } from '$lib/header.svelte';
	import { text } from '$lib/text/nl';

	const w = $derived(app.match);
	/* Vóór de aftrap kom je hier vanaf het opstelscherm, daarna vanaf de wedstrijd. */
	const terug = $derived(app.kickedOff ? '/app/wedstrijd' : '/app/opstelling/wedstrijd');
	$effect(() => zetKop(text.plan.title, terug, text.common.back));

	const stappen = $derived(planStappen(w, app.nu));
	/* Wie er vandaag is, op naam. Ook wie nu op de bank zit kan later eruit. */
	const erbij = $derived(
		app.toestand.players.filter((p) => !(w?.absent ?? []).includes(p.id)).sort((a, b) => a.name.localeCompare(b.name))
	);
	const naam = (id: string) => app.playerById(id)?.name ?? '?';

	let minuut = $state<number | null>(null);
	let erin = $state('');
	let eruit = $state('');

	function toevoegen() {
		if (minuut === null || minuut < 0 || !erin || !eruit || erin === eruit) {
			alert(text.plan.needAll);
			return;
		}
		app.planAdd(minuut, erin, eruit);
		erin = '';
		eruit = '';
	}
</script>

<main>
	<div class="pad">
		{#if !w || w.finished}
			<p class="uitleg">{text.plan.noMatch}</p>
			<div class="knoprij" style="padding-left: 0"><a class="knop prim" href="/app">{text.common.back}</a></div>
		{:else}
			<p class="uitleg">{text.plan.intro}</p>

			{#if !stappen.length}
				<p class="uitleg">{text.plan.empty}</p>
			{:else}
				<ul class="log">
					{#each stappen as s (s.stap.id)}
						<li class:klaar={s.status !== 'open'}>
							<b>{s.stap.minuut}′</b>
							<span>
								{text.plan.step(naam(s.stap.on), naam(s.stap.off))}
								{#if s.status === 'gedaan'}<span class="sub">{text.plan.done}</span>
								{:else if s.status === 'overgeslagen'}<span class="sub">{text.plan.skipped}</span>{/if}
							</span>
							{#if s.status === 'overgeslagen'}
								<button class="klein" onclick={() => app.planSkip(s.stap.id, false)}>{text.plan.undoSkip}</button>
							{:else if s.status === 'open'}
								<button class="klein" onclick={() => app.planRemove(s.stap.id)}>{text.plan.remove}</button>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}

			<div class="toevoegen">
				<label class="vak minuut">
					{text.plan.minuteLabel}
					<input type="number" inputmode="numeric" min="0" max="200" bind:value={minuut} />
				</label>
				<label class="vak">
					{text.plan.onLabel}
					<select bind:value={erin}>
						<option value="">{text.plan.choose}</option>
						{#each erbij as p (p.id)}<option value={p.id}>{p.name}</option>{/each}
					</select>
				</label>
				<label class="vak">
					{text.plan.offLabel}
					<select bind:value={eruit}>
						<option value="">{text.plan.choose}</option>
						{#each erbij as p (p.id)}<option value={p.id}>{p.name}</option>{/each}
					</select>
				</label>
			</div>
			<div class="knoprij" style="padding-left: 0">
				<button onclick={toevoegen}>{text.plan.add}</button>
				<a class="knop prim" href={terug}>{text.common.done}</a>
			</div>
		{/if}
	</div>
</main>

<style>
	.toevoegen {
		display: grid;
		grid-template-columns: 80px 1fr 1fr;
		gap: 8px;
		margin-top: 16px;
	}
	.klaar {
		opacity: 0.55;
	}
</style>
