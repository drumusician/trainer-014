<script lang="ts">
	import { goto } from '$app/navigation';
	import Veld from '$lib/components/Veld.svelte';
	import BankKolom from '$lib/components/BankKolom.svelte';
	import { LINES, positionLine } from '$lib/domain/formations';
	import { partName, breakName } from '$lib/domain/parts';
	import { keeperTimes, mmss, playingTimes, score, elapsed } from '$lib/domain/time';
	import { app } from '$lib/store.svelte';
	import { zetKop } from '$lib/header.svelte';

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
				'Naar start',
				uitslag[0] + ' – ' + uitslag[1],
				true
			);
		} else {
			zetKop('Blaadje', '/app', 'Naar start', null, true);
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
		if (!confirm('Wedstrijd afsluiten?\n\nDe klok stopt en je krijgt het overzicht met de speeltijden.')) return;
		app.finish();
		goto('/app/afloop');
	}

	const uit = $derived(app.chosenPosition && w ? app.playerById(w.lineup[app.chosenPosition]) : null);
	const keeperMin = $derived(uit ? Math.round((keeperTimes(w, app.nu)[uit.id] ?? 0) / 60) : 0);
</script>

{#if !app.toestand.players.length}
	<main>
		<div class="pad">
			<h2>Nog geen spelers</h2>
			<p class="uitleg">Zet eerst je selectie erin, dan valt er wat op te stellen.</p>
			<div class="knoprij" style="padding-left: 0"><a class="knop prim" href="/app/opzetten">Aan de slag</a></div>
		</div>
	</main>
{:else if !w || !Object.keys(w.lineup).length}
	<main>
		<div class="pad">
			<h2>Nog geen wedstrijd</h2>
			<p class="uitleg">Begin er een op het startscherm, dan zet je hier je opstelling neer.</p>
			<div class="knoprij" style="padding-left: 0"><a class="knop prim" href="/app">Naar start</a></div>
		</div>
	</main>
{:else if w.finished}
	<main>
		<div class="pad">
			<h2>Wedstrijd afgelopen</h2>
			<div class="knoprij" style="padding-left: 0"><a class="knop prim" href="/app/afloop">Naar het overzicht</a></div>
		</div>
	</main>
{:else}
	<div class="klokbalk">
		<button type="button" class="kloktik" onclick={() => (klokBijstellen = !klokBijstellen)}>
			<div class="klok">{mmss(elapsed(w, app.nu))}</div>
			<div class="helft">
				{#if w.inBreak}
					{breakName(w.part, w.parts)} · {partName(w.part, w.parts)} voorbij
				{:else}
					{partName(w.part, w.parts)} · tik om de tijd te zetten
				{/if}
			</div>
		</button>
		<div style="flex: 1"></div>
		<button onclick={() => app.toggleRunning()}>{w.running ? 'Pauze' : 'Start'}</button>
		<button onclick={() => app.togglePart()} disabled={!app.canStartNextPart}>
			{w.inBreak ? partName(w.part + 1, w.parts) : breakName(w.part, w.parts)}
		</button>
	</div>

	{#if klokBijstellen}
		<!-- Its own row: alongside the clock and two buttons this did not fit on a
		     phone, and the bar ran off the edge. -->
		<div class="klokzetrij">
			<label class="klokzet">
				<span>Minuut</span>
				<input
					type="number"
					min="0"
					max="200"
					inputmode="numeric"
					aria-label="Minuut"
					value={Math.floor(elapsed(w, app.nu) / 60)}
					onchange={(e) => app.setClock(Number(e.currentTarget.value))}
				/>
			</label>
			<button onclick={() => app.shiftClock(-60)}>−1′</button>
			<button onclick={() => app.shiftClock(60)}>+1′</button>
			<button class="klein" onclick={() => (klokBijstellen = false)}>Klaar</button>
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
					}}>Doelpunt</button
				>
				<button
					onclick={() => {
						assistVragen = false;
						app.concede();
					}}>Tegen</button
				>
				{#if app.undoable()}
					<button onclick={() => app.undoLast()}>↶ {app.undoable()} terug</button>
				{/if}
				<!-- Only while the clock is stopped. After that this would be a mis-tap during
				     coaching, and there is nothing left to change anyway. At the end, so
				     Doelpunt and Tegen do not shift when you press Start. -->
				{#if !app.kickedOff}
					<a class="knop" href="/app/aanwezig">Wie is er?</a>
				{/if}
				<button class="uit" onclick={afsluiten}>Wedstrijd afsluiten</button>
			</div>

			{#if doelpuntKiezen}
				<div class="melding">
					<span><b>Doelpunt.</b> Tik op het veld wie hem maakte.</span>
					<button
						class="klein"
						onclick={() => {
							app.goal(null);
							doelpuntKiezen = false;
						}}>Weet ik niet</button
					>
					<button class="klein" onclick={() => (doelpuntKiezen = false)}>Annuleren</button>
				</div>
			{:else if assistVragen}
				<div class="melding">
					<span>
						<b>{app.playerById(maker)?.name ?? 'Doelpunt'}</b> scoorde. Wie legde hem klaar? Tik hem aan, of sla dit over.
					</span>
					<button class="klein" onclick={() => (assistVragen = false)}>Geen assist</button>
				</div>
			{:else if app.chosenPosition}
				<div class="melding">
					<span>
						<b>{uit ? uit.name : 'Lege plek'}</b> ·
						{LINES[positionLine(app.chosenPosition, w.formation)].toLowerCase()}. Tik wie erin komt, of een andere plek
						om te ruilen.
						{#if keeperMin > 0 && positionLine(app.chosenPosition, w.formation) !== 'K'}
							Hij keepte deze wedstrijd al {keeperMin} minuten.
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
							}}>{uit.name} scoorde</button
						>
					{/if}
					<button class="klein" onclick={() => (app.chosenPosition = null)}>Annuleren</button>
				</div>
			{/if}
		</div>
	</main>
{/if}
