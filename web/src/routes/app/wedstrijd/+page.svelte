<script lang="ts">
	import { goto } from '$app/navigation';
	import Veld from '$lib/componenten/Veld.svelte';
	import BankKolom from '$lib/componenten/BankKolom.svelte';
	import { LINES, positionLine } from '$lib/domein/formaties';
	import { partName, breakName } from '$lib/domein/delen';
	import { keeperTimes, mmss, playingTimes, score, elapsed } from '$lib/domein/tijd';
	import { app } from '$lib/toestand.svelte';
	import { zetKop } from '$lib/kop.svelte';

	const w = $derived(app.wedstrijd);
	const klaar = $derived(!!w && !w.afgelopen && Object.keys(w.opstelling).length > 0);
	const tijden = $derived(playingTimes(w, app.toestand.spelers, app.nu));
	const uitslag = $derived(score(w));

	/* Wie scoorde? Dan wordt het veld even een keuzelijst. */
	let doelpuntKiezen = $state(false);
	/* De klok bijstellen hoeft bijna nooit, dus staat het weg tot je erop tikt. */
	let klokBijstellen = $state(false);
	/* Na een doelpunt: wie legde hem klaar? Overslaan mag, het spel gaat door. */
	let assistVragen = $state(false);
	let maker = $state<string | null>(null);

	$effect(() => {
		if (w && klaar) {
			const ons = app.toestand.teamnaam;
			zetKop(
				w.thuis ? ons + ' – ' + w.tegenstander : w.tegenstander + ' – ' + ons,
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
			const id = w.opstelling[plekId];
			if (id) {
				app.goal(id);
				maker = id;
				doelpuntKiezen = false;
				assistVragen = true;
			}
			return;
		}
		if (assistVragen) {
			const id = w.opstelling[plekId];
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
		/* Twee plekken achter elkaar: dan ruilen ze. Dat is geen wissel, er komt
		   niemand van de bank; denk aan de keeper die na rust het veld in gaat. */
		app.swapDuringMatch(app.chosenPosition, plekId);
	}

	function afsluiten() {
		if (!confirm('Wedstrijd afsluiten?\n\nDe klok stopt en je krijgt het overzicht met de speeltijden.')) return;
		app.finish();
		goto('/app/afloop');
	}

	const uit = $derived(app.chosenPosition && w ? app.playerById(w.opstelling[app.chosenPosition]) : null);
	const keeperMin = $derived(uit ? Math.round((keeperTimes(w, app.nu)[uit.id] ?? 0) / 60) : 0);
</script>

{#if !app.toestand.spelers.length}
	<main>
		<div class="pad">
			<h2>Nog geen spelers</h2>
			<p class="uitleg">Zet eerst je selectie erin, dan valt er wat op te stellen.</p>
			<div class="knoprij" style="padding-left: 0"><a class="knop prim" href="/app/opzetten">Aan de slag</a></div>
		</div>
	</main>
{:else if !w || !Object.keys(w.opstelling).length}
	<main>
		<div class="pad">
			<h2>Nog geen wedstrijd</h2>
			<p class="uitleg">Begin er een op het startscherm, dan zet je hier je opstelling neer.</p>
			<div class="knoprij" style="padding-left: 0"><a class="knop prim" href="/app">Naar start</a></div>
		</div>
	</main>
{:else if w.afgelopen}
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
				{#if w.pauze}
					{breakName(w.deel, w.delen)} · {partName(w.deel, w.delen)} voorbij
				{:else}
					{partName(w.deel, w.delen)} · tik om de tijd te zetten
				{/if}
			</div>
		</button>
		<div style="flex: 1"></div>
		<button onclick={() => app.toggleRunning()}>{w.loopt ? 'Pauze' : 'Start'}</button>
		<button onclick={() => app.togglePart()} disabled={!app.canStartNextPart}>
			{w.pauze ? partName(w.deel + 1, w.delen) : breakName(w.deel, w.delen)}
		</button>
	</div>

	{#if klokBijstellen}
		<!-- Eigen rij: naast de klok en twee knoppen paste dit niet op een telefoon,
		     en dan liep de balk over de rand heen. -->
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
				<Veld formatie={w.formatie} opstelling={w.opstelling} gekozen={app.chosenPosition} {tijden} onplek={tikPlek} />
				<BankKolom
					bank={w.bank}
					formatie={w.formatie}
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
				<!-- Alleen zolang de klok stilstaat. Daarna zou dit een mistik zijn tijdens
				     het coachen, en ligt er toch niets meer te wijzigen. Achteraan, zodat
				     Doelpunt en Tegen niet verspringen als je op Start drukt. -->
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
						<b>{app.playerById(maker)?.naam ?? 'Doelpunt'}</b> scoorde. Wie legde hem klaar? Tik hem aan, of sla dit over.
					</span>
					<button class="klein" onclick={() => (assistVragen = false)}>Geen assist</button>
				</div>
			{:else if app.chosenPosition}
				<div class="melding">
					<span>
						<b>{uit ? uit.naam : 'Lege plek'}</b> ·
						{LINES[positionLine(app.chosenPosition, w.formatie)].toLowerCase()}. Tik wie erin komt, of een andere plek
						om te ruilen.
						{#if keeperMin > 0 && positionLine(app.chosenPosition, w.formatie) !== 'K'}
							Hij keepte deze wedstrijd al {keeperMin} minuten.
						{/if}
					</span>
					<!-- Langs de lijn gaat je hand eerst naar de speler en pas dan naar wat hij
					     deed. Wie zo begint zit nu in een wissel; hiermee is dat één tik terug,
					     en werkt de volgorde allebei de kanten op. -->
					{#if uit}
						<button
							class="klein"
							onclick={() => {
								const id = uit.id;
								app.chosenPosition = null;
								app.goal(id);
								maker = id;
								assistVragen = true;
							}}>{uit.naam} scoorde</button
						>
					{/if}
					<button class="klein" onclick={() => (app.chosenPosition = null)}>Annuleren</button>
				</div>
			{/if}
		</div>
	</main>
{/if}
