<script lang="ts">
	import { goto } from '$app/navigation';
	import Veld from '$lib/componenten/Veld.svelte';
	import BankKolom from '$lib/componenten/BankKolom.svelte';
	import { LINIES, plekLinie, plekken } from '$lib/domein/formaties';
	import { keepertijden, mmss, speeltijden, stand, verstreken } from '$lib/domein/tijd';
	import { app } from '$lib/toestand.svelte';
	import { zetKop } from '$lib/kop.svelte';

	const w = $derived(app.wedstrijd);
	const klaar = $derived(!!w && !w.afgelopen && Object.keys(w.opstelling).length > 0);
	const tijden = $derived(speeltijden(w, app.toestand.spelers, app.nu));
	const uitslag = $derived(stand(w));

	/* Wie scoorde? Dan wordt het veld even een keuzelijst. */
	let doelpuntKiezen = $state(false);
	/* De klok bijstellen hoeft bijna nooit, dus staat het weg tot je erop tikt. */
	let klokBijstellen = $state(false);

	$effect(() => {
		if (w && klaar) {
			zetKop(w.thuis ? 'O14 – ' + w.tegenstander : w.tegenstander + ' – O14', '/instellen', 'Instellen',
				uitslag[0] + ' – ' + uitslag[1]);
		} else {
			zetKop('Blaadje', '/instellen', 'Instellen');
		}
	});

	function tikPlek(plekId: string) {
		if (!w) return;
		if (doelpuntKiezen) {
			const id = w.opstelling[plekId];
			if (id) {
				app.doelpunt(id);
				doelpuntKiezen = false;
			}
			return;
		}
		app.gekozenPlek = app.gekozenPlek === plekId ? null : plekId;
	}

	function afsluiten() {
		if (!confirm('Wedstrijd afsluiten?\n\nDe klok stopt en je krijgt het overzicht met de speeltijden.')) return;
		app.beeindig();
		goto('/afloop');
	}

	const uit = $derived(app.gekozenPlek && w ? app.spelerVan(w.opstelling[app.gekozenPlek]) : null);
	const keeperMin = $derived(uit ? Math.round((keepertijden(w, app.nu)[uit.id] ?? 0) / 60) : 0);
</script>

{#if !app.toestand.spelers.length}
	<main>
		<div class="pad">
			<h2>Nog geen spelers</h2>
			<p class="uitleg">Ga naar <b>Instellen</b> en zet je selectie erin. De namen blijven op dit toestel staan.</p>
			<div class="knoprij" style="padding-left: 0"><a class="knop prim" href="/instellen">Instellen</a></div>
		</div>
	</main>
{:else if !w || !Object.keys(w.opstelling).length}
	<main>
		<div class="pad">
			<h2>Nog geen opstelling</h2>
			<p class="uitleg">Maak een wedstrijd aan en zet je basiself op het veld.</p>
			<div class="knoprij" style="padding-left: 0"><a class="knop prim" href="/instellen">Wedstrijd opzetten</a></div>
		</div>
	</main>
{:else if w.afgelopen}
	<main>
		<div class="pad">
			<h2>Wedstrijd afgelopen</h2>
			<div class="knoprij" style="padding-left: 0"><a class="knop prim" href="/afloop">Naar het overzicht</a></div>
		</div>
	</main>
{:else}
	<div class="klokbalk">
		<div
			role="button"
			tabindex="0"
			onclick={() => (klokBijstellen = !klokBijstellen)}
			onkeydown={(e) => e.key === 'Enter' && (klokBijstellen = !klokBijstellen)}
		>
			<div class="klok">{mmss(verstreken(w, app.nu))}</div>
			<div class="helft">{w.helft === 1 ? '1e helft' : '2e helft'} · tik om bij te stellen</div>
		</div>
		<div style="flex: 1"></div>
		{#if klokBijstellen}
			<button onclick={() => app.verschuifKlok(-60)}>−1′</button>
			<button onclick={() => app.verschuifKlok(60)}>+1′</button>
		{/if}
		<button onclick={() => app.loopToggle()}>{w.loopt ? 'Pauze' : 'Start'}</button>
		<button onclick={() => app.rustToggle()} disabled={w.helft === 2 && w.loopt}>
			{w.helft === 1 ? 'Rust' : '2e helft'}
		</button>
	</div>

	<main>
		<div class="veldscherm">
			<div class="veldrij">
				<Veld
					formatie={w.formatie}
					opstelling={w.opstelling}
					gekozen={app.gekozenPlek}
					{tijden}
					onplek={tikPlek}
				/>
				<BankKolom
					bank={w.bank}
					formatie={w.formatie}
					gekozen={app.gekozenPlek}
					{tijden}
					ontik={(id) => app.zetOpPlek(id)}
				/>
			</div>

			<div class="knoprij">
				<button class="prim" onclick={() => (doelpuntKiezen = !doelpuntKiezen)}>Doelpunt</button>
				<button onclick={() => app.tegendoelpunt()}>Tegen</button>
				{#if app.herstelbaar()}
					<button onclick={() => app.herstelLaatste()}>↶ {app.herstelbaar()} terug</button>
				{/if}
				<button class="uit" onclick={afsluiten}>Wedstrijd afsluiten</button>
			</div>

			{#if doelpuntKiezen}
				<div class="melding">
					<span><b>Doelpunt.</b> Tik op het veld wie hem maakte.</span>
					<button class="klein" onclick={() => { app.doelpunt(null); doelpuntKiezen = false; }}>Weet ik niet</button>
					<button class="klein" onclick={() => (doelpuntKiezen = false)}>Annuleren</button>
				</div>
			{:else if app.gekozenPlek}
				<div class="melding">
					<span>
						<b>{uit ? uit.naam : 'Lege plek'}</b> ·
						{LINIES[plekLinie(app.gekozenPlek, w.formatie)].toLowerCase()}. Tik wie erin komt.
						{#if keeperMin > 0 && plekLinie(app.gekozenPlek, w.formatie) !== 'K'}
							Hij keepte deze wedstrijd al {keeperMin} minuten.
						{/if}
					</span>
					<button class="klein" onclick={() => (app.gekozenPlek = null)}>Annuleren</button>
				</div>
			{/if}
		</div>
	</main>
{/if}
