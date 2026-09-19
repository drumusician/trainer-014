<script lang="ts">
	import { kanNietOpMoment, planStappen, standOp, wanneer } from '$lib/domain/plan';
	import { momentName } from '$lib/domain/parts';
	import { redenTekst, stapTekst } from '$lib/plan-tekst';
	import type { PlannedSub } from '$lib/domain/types';
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

	/* Een pauze ('na-1' is de pauze na het eerste deel) of een eigen minuut. */
	let moment = $state('');
	let minuut = $state<number | null>(null);
	/* Wissel met de bank, of twee spelers in het veld die van plek ruilen. */
	let soort = $state<'wissel' | 'ruil'>('wissel');
	let erin = $state('');
	let eruit = $state('');

	const pauzes = $derived(
		w ? Array.from({ length: w.parts - 1 }, (_, i) => ({ naDeel: i + 1, naam: momentName(i + 1, w.parts) })) : []
	);
	const naDeel = $derived(moment.startsWith('na-') ? Number(moment.slice(3)) : undefined);
	/* De pauze telt voor de volgorde als het einde van dat deel. */
	const opMinuut = $derived(
		naDeel ? naDeel * app.toestand.minutesPerPart : moment === 'minuut' && minuut !== null ? minuut : null
	);

	/*
	 * Niet iedereen, maar wie er rond die minuut kan: eruit wie dan in het veld
	 * staat, erin wie dan op de bank zit. Met de stappen die al gepland staan erbij,
	 * zodat na "35′ Casper voor Maher" Maher in een volgende stap bij de bank staat.
	 */
	const stand = $derived(standOp(w, opMinuut ?? 0));
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

	/* Waar iemand staat vlak vóór deze stap, met de eerdere stappen meegerekend. */
	function plekOpMoment(stap: PlannedSub) {
		const veld = standOp(w, stap.minuut, stap.id).veld;
		return (id: string) => {
			const r = veld.find((x) => x.id === id);
			return r && w ? positionLabel(r.plek, w.formation) : null;
		};
	}

	/* Bij een ruil: iedereen in het veld behalve wie je al koos. */
	const metWie = $derived(inHetVeld.map((r) => r.id).filter((id) => id !== eruit));

	/* Andere minuut, andere stand: een keuze die dan niet meer kan, valt weg. */
	$effect(() => {
		if (eruit && !inHetVeld.some((r) => r.id === eruit)) eruit = '';
		if (erin && !(soort === 'ruil' ? metWie : opDeBank).includes(erin)) erin = '';
	});

	function toevoegen() {
		if (opMinuut === null || opMinuut < 0 || !erin || !eruit || erin === eruit) {
			alert(text.plan.needAll);
			return;
		}
		app.planAdd(opMinuut, erin, eruit, naDeel, soort === 'ruil' ? 'ruil' : undefined);
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
						<!-- Vervallen op zijn eigen moment, met de stappen ervoor meegerekend:
						     niet op hoe het nu staat, anders is de tweede helft van een
						     keeperwissel vooraf al 'vervallen'. -->
						{@const reden = s.status === 'open' ? kanNietOpMoment(w, s.stap) : null}
						<li class:klaar={s.status !== 'open' || !!reden}>
							<b>{wanneer(s.stap, w.parts)}</b>
							<span>
								{s.status === 'open' && !reden
									? stapTekst(s.stap, naam, plekOpMoment(s.stap))
									: stapTekst(s.stap, naam, () => null)}
								{#if s.status === 'gedaan'}<span class="sub">{text.plan.done}</span>
								{:else if s.status === 'overgeslagen'}<span class="sub">{text.plan.skipped}</span>
								{:else if reden}<span class="sub">{text.plan.voided(redenTekst(reden, s.stap, naam))}</span>{/if}
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

			<!-- Een pauze is aan de beurt zodra je hem aantikt, niet op de klok: de
			     rust valt zelden op 35:00 precies. -->
			<div class="wanneer">
				<label class="vak">
					{text.plan.whenLabel}
					<select bind:value={moment}>
						<option value="">{text.plan.choose}</option>
						{#each pauzes as p (p.naDeel)}<option value="na-{p.naDeel}">{p.naam}</option>{/each}
						<option value="minuut">{text.plan.ownMinute}</option>
					</select>
				</label>
				{#if moment === 'minuut'}
					<label class="vak minuut">
						{text.plan.minuteLabel}
						<input type="number" inputmode="numeric" min="0" max="200" bind:value={minuut} />
					</label>
				{/if}
			</div>
			<label class="vak">
				{text.plan.kindLabel}
				<select bind:value={soort}>
					<option value="wissel">{text.plan.kindSub}</option>
					<option value="ruil">{text.plan.kindSwap}</option>
				</select>
			</label>
			<div class="toevoegen">
				<label class="vak">
					{soort === 'ruil' ? text.plan.swapALabel : text.plan.offLabel}
					<select bind:value={eruit}>
						<option value="">{text.plan.choose}</option>
						{#each inHetVeld as r (r.id)}
							<option value={r.id}>{text.plan.withPosition(naam(r.id), positionLabel(r.plek, w.formation))}</option>
						{/each}
					</select>
				</label>
				<label class="vak">
					{soort === 'ruil' ? text.plan.swapBLabel : text.plan.onLabel}
					<select bind:value={erin}>
						<option value="">{text.plan.choose}</option>
						{#if soort === 'ruil'}
							{#each inHetVeld.filter((r) => r.id !== eruit) as r (r.id)}
								<option value={r.id}>{text.plan.withPosition(naam(r.id), positionLabel(r.plek, w.formation))}</option>
							{/each}
						{:else}
							{#each opDeBank as id (id)}<option value={id}>{naam(id)}</option>{/each}
						{/if}
					</select>
				</label>
			</div>
			{#if opMinuut !== null}
				<p class="uitleg">
					{text.plan.optionsHint(
						naDeel ? text.plan.inBreak(momentName(naDeel, w.parts).toLowerCase()) : text.plan.aroundMinute(opMinuut)
					)}
				</p>
			{/if}
			<div class="knoprij" style="padding-left: 0">
				<button onclick={toevoegen}>{text.plan.add}</button>
				<a class="knop prim" href={terug}>{text.common.done}</a>
			</div>
		{/if}
	</div>
</main>

<style>
	.wanneer {
		display: grid;
		grid-template-columns: 1fr 90px;
		gap: 8px;
		margin-top: 16px;
	}
	.toevoegen {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8px;
	}
	.klaar {
		opacity: 0.55;
	}
</style>
