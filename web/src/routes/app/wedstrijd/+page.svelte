<script lang="ts">
	import { goto } from '$app/navigation';
	import Veld from '$lib/components/Veld.svelte';
	import BankKolom from '$lib/components/BankKolom.svelte';
	import { LINES, positionLabel, positionLine } from '$lib/domain/formations';
	import { partName, breakName } from '$lib/domain/parts';
	import { homeFirst, keeperTimes, mmss, playingTimes, score, elapsed } from '$lib/domain/time';
	import { app } from '$lib/store.svelte';
	import { zetKop } from '$lib/header.svelte';
	import { volgendeStap, nogOpen, wanneer } from '$lib/domain/plan';
	import { stapTekst } from '$lib/plan-tekst';
	import { text } from '$lib/text/nl';
	import { sync } from '$lib/supabase/sync.svelte';

	const w = $derived(app.match);
	const klaar = $derived(!!w && !w.finished && Object.keys(w.lineup).length > 0);
	const tijden = $derived(playingTimes(w, app.toestand.players, app.nu));
	const uitslag = $derived(score(w));

	/* Who scored? Then the pitch briefly becomes a picker. */
	let doelpuntKiezen = $state(false);
	/* Adjusting the clock is almost never needed, so it hides until you tap it. */
	let klokBijstellen = $state(false);
	/* After a goal: who set it up? Skipping is fine, the game moves on. */
	let assistVragen = $state(false);
	let maker = $state<string | null>(null);

	$effect(() => {
		if (w && klaar) {
			const ons = app.toestand.teamName;
			zetKop(
				w.home ? ons + ' – ' + w.opponent : w.opponent + ' – ' + ons,
				'/app',
				text.common.toStart,
				homeFirst(uitslag, w.home).join(' – '),
				true
			);
		} else {
			zetKop('Blaadje', '/app', text.common.toStart, null, true);
		}
	});

	function tikPlek(plekId: string) {
		if (!w) return;
		if (doelpuntKiezen) {
			const id = w.lineup[plekId];
			if (id) {
				app.goal(id);
				maker = id;
				doelpuntKiezen = false;
				assistVragen = true;
			}
			return;
		}
		if (assistVragen) {
			const id = w.lineup[plekId];
			if (id && id !== maker) {
				app.setAssist(id);
				assistVragen = false;
			}
			return;
		}
		if (!app.chosenPosition) {
			app.chosenPosition = plekId;
			return;
		}
		if (app.chosenPosition === plekId) {
			app.chosenPosition = null;
			return;
		}
		/* Two positions in a row: then they swap. That is not a substitution, nobody
		   comes off the bench; think of the keeper going outfield after half-time. */
		app.swapDuringMatch(app.chosenPosition, plekId);
	}

	function afsluiten() {
		if (!confirm(text.match.confirmFinish)) return;
		app.finish();
		goto('/app/afloop');
	}

	/* Houdt iemand anders deze wedstrijd al bij? Twee toestellen die tegelijk
	   tikken duwen om beurten hun eigen versie naar de server, en dan raakt de
	   helft van de wissels zoek. Zichtbaar maken is genoeg; onderling regelen ze
	   het zelf. */
	const anderTikt = $derived(w?.keptBy && sync.sessie?.email && w.keptBy !== sync.sessie.email ? w.keptBy : null);

	/* Het wisselplan: alleen na de aftrap, en alleen als er een plan is. Zonder
	   plan ziet dit scherm er precies zo uit als altijd. */
	const eerstvolgende = $derived(app.kickedOff ? volgendeStap(w, app.nu) : null);
	/* Pas in beeld als hij dichtbij komt: in minuut 10 hoef je nog niet over de rust te lezen. */
	const volgende = $derived(eerstvolgende?.inZicht ? eerstvolgende : null);
	const planRest = $derived(volgende ? nogOpen(w, app.nu) - 1 : 0);
	const planNaam = (id: string) => app.playerById(id)?.name ?? '?';
	/* Waar iemand nú staat. De volgende stap kan altijd, dus de plek klopt. */
	const planPlek = (id: string) => {
		if (!w) return null;
		const plek = Object.entries(w.lineup).find(([, p]) => p === id)?.[0];
		return plek ? positionLabel(plek, w.formation) : null;
	};

	const uit = $derived(app.chosenPosition && w ? app.playerById(w.lineup[app.chosenPosition]) : null);
	const keeperMin = $derived(uit ? Math.round((keeperTimes(w, app.nu)[uit.id] ?? 0) / 60) : 0);
</script>

{#if !app.toestand.players.length}
	<main>
		<div class="pad">
			<h2>{text.match.noSquadHeading}</h2>
			<p class="uitleg">{text.common.noSquadHint}</p>
			<div class="knoprij" style="padding-left: 0">
				<a class="knop prim" href="/app/opzetten">{text.common.getStarted}</a>
			</div>
		</div>
	</main>
{:else if !w || !Object.keys(w.lineup).length}
	<main>
		<div class="pad">
			<h2>{text.match.noMatchHeading}</h2>
			<p class="uitleg">{text.match.noMatchHint}</p>
			<div class="knoprij" style="padding-left: 0"><a class="knop prim" href="/app">{text.common.toStart}</a></div>
		</div>
	</main>
{:else if w.finished}
	<main>
		<div class="pad">
			<h2>{text.match.finishedHeading}</h2>
			<div class="knoprij" style="padding-left: 0">
				<a class="knop prim" href="/app/afloop">{text.match.toOverview}</a>
			</div>
		</div>
	</main>
{:else}
	{#if anderTikt}
		<!-- Met een uitweg: bij een lege telefoon moet je hem juist wél overnemen,
		     en dan hoort de waarschuwing weg te gaan. -->
		<div class="waarschuwing">
			<span>{text.match.keptBy(anderTikt)}</span>
			<button
				class="klein"
				onclick={() => {
					if (confirm(text.match.confirmTakeOver)) app.takeOverMatch();
				}}>{text.match.takeOver}</button
			>
		</div>
	{/if}
	<div class="klokbalk">
		<button type="button" class="kloktik" onclick={() => (klokBijstellen = !klokBijstellen)}>
			<div class="klok">{mmss(elapsed(w, app.nu))}</div>
			<div class="helft">
				{w.inBreak
					? text.match.clockInBreak(breakName(w.part, w.parts), partName(w.part, w.parts))
					: text.match.clockRunning(partName(w.part, w.parts))}
			</div>
		</button>
		<div style="flex: 1"></div>
		<!-- Per moment alleen wat dan zin heeft. Vóór de aftrap één knop; in de rust
		     alleen het volgende deel beginnen, want de klok laten lopen terwijl het
		     nog rust is kan niet goed zijn; in het laatste deel geen deelknop, want
		     afsluiten staat hieronder. -->
		{#if !app.kickedOff}
			<button class="prim" onclick={() => app.toggleRunning()}>{text.match.kickOff}</button>
		{:else if w.inBreak}
			<button class="prim" onclick={() => app.togglePart()}
				>{text.match.startPart(partName(w.part + 1, w.parts))}</button
			>
		{:else}
			<button onclick={() => app.toggleRunning()}>{w.running ? text.match.pause : text.match.start}</button>
			{#if app.canStartNextPart}
				<button onclick={() => app.togglePart()}>{text.match.endPart(partName(w.part, w.parts))}</button>
			{/if}
		{/if}
	</div>

	{#if klokBijstellen}
		<!-- Its own row: alongside the clock and two buttons this did not fit on a
		     phone, and the bar ran off the edge. -->
		<div class="klokzetrij">
			<label class="klokzet">
				<span>{text.match.minuteLabel}</span>
				<input
					type="number"
					min="0"
					max="200"
					inputmode="numeric"
					aria-label={text.match.minuteLabel}
					value={Math.floor(elapsed(w, app.nu) / 60)}
					onchange={(e) => app.setClock(Number(e.currentTarget.value))}
				/>
			</label>
			<button onclick={() => app.shiftClock(-60)}>{text.match.minuteBack}</button>
			<button onclick={() => app.shiftClock(60)}>{text.match.minuteForward}</button>
			<button class="klein" onclick={() => (klokBijstellen = false)}>{text.common.done}</button>
		</div>
	{/if}

	<main>
		<div class="veldscherm">
			<div class="veldrij">
				<Veld formation={w.formation} lineup={w.lineup} gekozen={app.chosenPosition} {tijden} onplek={tikPlek} />
				<BankKolom
					bench={w.bench}
					formation={w.formation}
					gekozen={app.chosenPosition}
					{tijden}
					ontik={(id) => app.putOnPosition(id)}
				/>
			</div>

			<div class="knoprij">
				<button
					class="prim"
					onclick={() => {
						assistVragen = false;
						doelpuntKiezen = !doelpuntKiezen;
					}}>{text.match.goal}</button
				>
				<button
					onclick={() => {
						assistVragen = false;
						app.concede();
					}}>{text.match.conceded}</button
				>
				{#if app.undoable()}
					<button onclick={() => app.undoLast()}>{text.match.undo(app.undoable()!)}</button>
				{/if}
				<!-- Only while the clock is stopped. After that this would be a mis-tap during
				     coaching, and there is nothing left to change anyway. At the end, so
				     Doelpunt and Tegen do not shift when you press Start. -->
				{#if !app.kickedOff}
					<a class="knop" href="/app/aanwezig">{text.match.whoIsThere}</a>
				{/if}
				<button class="uit" onclick={afsluiten}>{text.match.finish}</button>
			</div>

			{#if doelpuntKiezen}
				<div class="melding">
					<span><b>{text.match.goal}.</b> {text.match.goalPrompt}</span>
					<button
						class="klein"
						onclick={() => {
							app.goal(null);
							doelpuntKiezen = false;
						}}>{text.match.goalUnknown}</button
					>
					<button class="klein" onclick={() => (doelpuntKiezen = false)}>{text.common.cancel}</button>
				</div>
			{:else if assistVragen}
				<div class="melding">
					<span>
						<b>{app.playerById(maker)?.name ?? text.match.goal}</b>
						{text.match.assistPrompt}
					</span>
					<button class="klein" onclick={() => (assistVragen = false)}>{text.match.noAssist}</button>
				</div>
			{:else if app.chosenPosition}
				<div class="melding">
					<span>
						<b>{uit ? uit.name : text.match.emptyPosition}</b> ·
						{text.match.substitutePrompt(LINES[positionLine(app.chosenPosition, w.formation)].toLowerCase())}
						{#if keeperMin > 0 && positionLine(app.chosenPosition, w.formation) !== 'K'}
							{text.match.alreadyKept(keeperMin)}
						{/if}
					</span>
					<!-- At the touchline your hand goes to the player first and only then to what
					     he did. Start that way and you are in a substitution; this makes that one
					     tap back, and lets the order work both ways round. -->
					{#if uit}
						<button
							class="klein"
							onclick={() => {
								const id = uit.id;
								app.chosenPosition = null;
								app.goal(id);
								maker = id;
								assistVragen = true;
							}}>{text.match.scored(uit.name)}</button
						>
					{/if}
					<button class="klein" onclick={() => (app.chosenPosition = null)}>{text.common.cancel}</button>
				</div>
			{:else if volgende}
				<!-- Een spiekbriefje, geen wekker: grijs tot de minuut voorbij is, dan
				     oranje. Nooit een melding; het moment kiest de trainer. -->
				<div class="melding plan" class:aandebeurt={volgende.aanDeBeurt}>
					<span>
						<a href="/app/wisselplan"
							><b
								>{text.plan.lineHead(
									volgende.stap.naDeel ? wanneer(volgende.stap, w.parts).toLowerCase() : wanneer(volgende.stap, w.parts)
								)}</b
							></a
						>
						{stapTekst(volgende.stap, planNaam, planPlek)}
						<!-- Kan wel, maar is vreemd na wissels die niet gepland waren. Zeggen,
						     niet tegenhouden. -->
						{#if volgende.pasErin}
							· <em>{text.plan.justOn(planNaam(volgende.stap.off), volgende.pasErin)}</em>
						{/if}
						{#if volgende.pasEruit}
							· <em>{text.plan.justOff(planNaam(volgende.stap.on), volgende.pasEruit)}</em>
						{/if}
						{#if planRest > 0}<small>{text.plan.more(planRest)}</small>{/if}
					</span>
					<button class="klein prim" onclick={() => app.planDo(volgende.stap.id)}
						>{volgende.stap.soort === 'ruil' ? text.plan.doSwap : text.plan.doIt}</button
					>
					<button class="klein" onclick={() => app.planSkip(volgende.stap.id)}>{text.plan.skip}</button>
				</div>
			{/if}
		</div>
	</main>
{/if}

<style>
	/* Nog niet aan de beurt: rustig grijs. Oranje pas als de minuut voorbij is. */
	.melding.plan:not(.aandebeurt) {
		background: var(--bank);
		border-top-color: var(--lijn);
		color: inherit;
	}
	.melding.plan:not(.aandebeurt) b {
		color: inherit;
	}
	.melding.plan a {
		color: inherit;
	}
	.melding.plan small {
		margin-left: 6px;
		opacity: 0.7;
	}
</style>
