<script lang="ts">
	import { planStappen, standOp } from '$lib/domain/plan';
	import { groupOf, positionLabel } from '$lib/domain/formations';
	import { app } from '$lib/store.svelte';
	import { zetKop } from '$lib/header.svelte';
	import { text } from '$lib/text/nl';

	const w = $derived(app.match);
	/* Vóór de aftrap kom je hier vanaf het opstelscherm, daarna vanaf de wedstrijd. */
	const terug = $derived(app.kickedOff ? '/app/wedstrijd' : '/app/opstelling/wedstrijd');
	$effect(() => zetKop(text.plan.title, terug, text.common.back));

	const stappen = $derived(planStappen(w, app.nu));
	const naam = (id: string) => app.playerById(id)?.name ?? '?';

	let minuut = $state<number | null>(null);
	let erin = $state('');
	let eruit = $state('');

	/*
	 * Niet iedereen, maar wie er rond die minuut kan: eruit wie dan in het veld
	 * staat, erin wie dan op de bank zit. Met de stappen die al gepland staan erbij,
	 * zodat na "35′ Casper voor Maher" Maher in een volgende stap bij de bank staat.
	 */
	const stand = $derived(standOp(w, minuut ?? 0));
	const inHetVeld = $derived(
		stand.veld.map((r) => ({ id: r.id, plek: r.plek })).sort((a, b) => naam(a.id).localeCompare(naam(b.id)))
	);
	/* Wie in dezelfde linie speelt als wie eruit gaat, bovenaan. */
	const opDeBank = $derived.by(() => {
		const uit = app.playerById(eruit);
		const linie = uit ? groupOf(uit) : null;
		const zelfde = (id: string) => {
			const p = app.playerById(id);
			return linie !== null && !!p && groupOf(p) === linie;
		};
		return [...stand.bank].sort((a, b) => Number(zelfde(b)) - Number(zelfde(a)) || naam(a).localeCompare(naam(b)));
	});

	/* Andere minuut, andere stand: een keuze die dan niet meer kan, valt weg. */
	$effect(() => {
		if (eruit && !inHetVeld.some((r) => r.id === eruit)) eruit = '';
		if (erin && !opDeBank.includes(erin)) erin = '';
	});

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
					{text.plan.offLabel}
					<select bind:value={eruit}>
						<option value="">{text.plan.choose}</option>
						{#each inHetVeld as r (r.id)}
							<option value={r.id}>{text.plan.withPosition(naam(r.id), positionLabel(r.plek, w.formation))}</option>
						{/each}
					</select>
				</label>
				<label class="vak">
					{text.plan.onLabel}
					<select bind:value={erin}>
						<option value="">{text.plan.choose}</option>
						{#each opDeBank as id (id)}<option value={id}>{naam(id)}</option>{/each}
					</select>
				</label>
			</div>
			<p class="uitleg">{text.plan.optionsHint(minuut ?? 0)}</p>
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
