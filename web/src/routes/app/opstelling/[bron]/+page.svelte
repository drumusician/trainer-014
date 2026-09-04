<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import Veld from '$lib/componenten/Veld.svelte';
	import BankKolom from '$lib/componenten/BankKolom.svelte';
	import { aantalPlekken, groepVan, liniesIn, LINIES, plekLinie, SPEELVORMEN } from '$lib/domein/formaties';
	import { mager, presentie } from '$lib/domein/presentie';
	import { opstellingTekst } from '$lib/domein/opstelling';
	import { app } from '$lib/toestand.svelte';
	import { zetKop } from '$lib/kop.svelte';

	const bron = $derived(page.params.bron === 'standaard' ? 'standaard' : 'wedstrijd');
	const doel = $derived(bron === 'standaard' ? app.toestand.standaard : app.wedstrijd);

	$effect(() => {
		zetKop(bron === 'standaard' ? 'Standaardopstelling' : 'Opstelling', '/app', 'Terug');
	});

	/* Rechtstreeks hierheen komen moet ook werken, bijvoorbeeld vanaf een kaart
	   op het startscherm. Bestaat er nog geen standaardopstelling, dan maken we
	   hem hier aan in plaats van een doodlopend scherm te tonen. */
	$effect(() => {
		if (bron === 'standaard' && !app.toestand.standaard && app.toestand.spelers.length) {
			app.zorgVoorStandaard();
		}
	});

	/* Pas ná de aftrap hoort schuiven hier niet meer: vanaf dan wordt de speeltijd
	   teruggerekend uit de wissels, en ongemerkt ruilen zet die op scherp.
	   Zolang de klok nog niet gelopen heeft mag je alles nog verzetten. */
	$effect(() => {
		if (bron === 'wedstrijd' && app.gestart) goto('/app/wedstrijd');
	});

	const bezet = $derived(doel ? Object.values(doel.opstelling).filter(Boolean).length : 0);
	const nodig = $derived(doel ? aantalPlekken(doel.formatie) : 0);
	const gekozenSpeler = $derived(
		doel && app.gekozenPlek ? app.spelerVan(doel.opstelling[app.gekozenPlek]) : undefined
	);

	/* Eerste tik kiest een plek. Tweede tik op een andere plek ruilt ze om; staat
	   daar niemand, dan verhuist hij ernaartoe. */
	function tikPlek(plekId: string) {
		if (!app.gekozenPlek) {
			app.gekozenPlek = plekId;
			return;
		}
		if (app.gekozenPlek === plekId) {
			app.gekozenPlek = null;
			return;
		}
		app.ruilPlekken(bron, app.gekozenPlek, plekId);
	}

	/* Linies zonder wissel: dat is een verrassing die je liever nu hebt. */
	const zonderWissel = $derived.by(() => {
		if (!doel) return [];
		const bank = doel.bank.map((id) => app.spelerVan(id)).filter(Boolean);
		/* alleen de linies die in deze formatie voorkomen: bij 4 tegen 4 geen keeper */
		return liniesIn(doel.formatie)
			.filter((code) => !bank.some((p) => p && groepVan(p) === code))
			.map((code) => LINIES[code].toLowerCase());
	});

	const mageren = $derived(
		app.toestand.spelers.filter((p) => mager(presentie(app.toestand.trainingen, p.id, 4)))
	);

	let gedeeld = $state('');
	let gekopieerd = $state(false);
	let toonTekst = $state(false);

	async function kopieer() {
		if (!doel) return;
		gedeeld = opstellingTekst(doel.formatie, doel.opstelling, doel.bank, app.toestand.spelers);
		try {
			await navigator.clipboard.writeText(gedeeld);
			gekopieerd = true;
			toonTekst = false;
		} catch {
			/* geen klembord: dan maar met de hand uit het vak */
			gekopieerd = false;
			toonTekst = true;
		}
	}

	function klaar() {
		if (bron === 'standaard') {
			app.bewaar();
			goto('/app');
			return;
		}
		if (bezet < nodig && !confirm('Er staan er ' + bezet + ' op het veld in plaats van ' + nodig + '. Toch doorgaan?')) return;
		app.gekozenPlek = null;
		goto('/app/wedstrijd');
	}

	function wissen() {
		if (!confirm('De standaardopstelling weggooien?')) return;
		app.wisStandaard();
		goto('/app');
	}
</script>

{#if !doel}
	<main>
		<div class="pad">
			<p class="uitleg">
				{#if !app.toestand.spelers.length}
					Zet eerst je selectie erin, dan valt er wat op te stellen.
				{:else}
					Er is geen wedstrijd om op te stellen. Begin er een op het startscherm.
				{/if}
			</p>
			<div class="knoprij" style="padding-left: 0">
				<a class="knop prim" href={app.toestand.spelers.length ? '/app' : '/app/opzetten'}>
					{app.toestand.spelers.length ? 'Naar start' : 'Aan de slag'}
				</a>
			</div>
		</div>
	</main>
{:else}
	<main>
		<div class="veldscherm zonderklok">
			<div class="veldrij">
				<Veld formatie={doel.formatie} opstelling={doel.opstelling} gekozen={app.gekozenPlek} onplek={tikPlek} />
				<BankKolom
					bank={doel.bank}
					formatie={doel.formatie}
					gekozen={app.gekozenPlek}
					leegtekst="Niemand over."
					ontik={(id) => app.zetInOpzet(bron, id)}
				/>
			</div>

			{#if app.gekozenPlek}
				<div class="melding">
					<span>
						{#if gekozenSpeler}
							<b>{gekozenSpeler.naam}</b> · {LINIES[plekLinie(app.gekozenPlek, doel.formatie)].toLowerCase()}.
							Tik een andere plek om te ruilen, of iemand van de bank.
						{:else}
							<b>Lege plek</b> · {LINIES[plekLinie(app.gekozenPlek, doel.formatie)].toLowerCase()}. Tik wie hier komt te
							staan.
						{/if}
					</span>
					{#if gekozenSpeler}
						<button class="klein" onclick={() => app.haalVanVeld(bron, app.gekozenPlek!)}>Naar de bank</button>
					{/if}
					<button class="klein" onclick={() => (app.gekozenPlek = null)}>Annuleren</button>
				</div>
			{/if}

			{#if !app.gekozenPlek && zonderWissel.length}
				<p class="uitleg" style="padding: 0 12px; margin: 0 0 8px">
					<b class="mager">Geen wissel voor {zonderWissel.join(', ')}.</b>
				</p>
			{/if}
			{#if !app.gekozenPlek && mageren.length}
				<p class="uitleg" style="padding: 0 12px">
					Weinig getraind:
					{#each mageren as p, i (p.id)}
						{@const r = presentie(app.toestand.trainingen, p.id, 4)}
						<b class="mager">{p.naam} {r.er}/{r.totaal}</b>{i < mageren.length - 1 ? ', ' : ''}
					{/each}
				</p>
			{/if}

			<div class="knoprij">
				{#if bron === 'standaard'}
					<label class="formatiekeuze">
						Formatie
						<select value={doel.formatie} onchange={(e) => app.kiesFormatie(e.currentTarget.value)}>
							{#each SPEELVORMEN as vorm (vorm.naam)}
								<optgroup label={vorm.naam + (vorm.uitleg ? ' · ' + vorm.uitleg : '')}>
									{#each vorm.formaties as f (f.sleutel)}
										<option value={f.sleutel}>{f.sleutel}{f.uitleg ? ' · ' + f.uitleg : ''}</option>
									{/each}
								</optgroup>
							{/each}
						</select>
					</label>
				{/if}
				<button class="prim" onclick={klaar}>
					{bron === 'standaard' ? 'Bewaren' : 'Klaar — naar de wedstrijd'}
				</button>
				{#if bron === 'wedstrijd'}
					<a class="knop" href="/app/aanwezig">Wie is er?</a>
				{/if}
				<button onclick={kopieer}>Kopiëren</button>
				{#if bron === 'standaard'}
					<button class="uit" onclick={wissen}>Wissen</button>
				{/if}
				<span class="uitleg" style="align-self: center; margin: 0">{bezet} van de {nodig} ingevuld</span>
			</div>
			{#if gedeeld}
				<p class="uitleg" style="padding: 0 12px; margin: 0 0 8px">
					{#if gekopieerd}Gekopieerd.{:else}Kopiëren lukte niet, pak hem uit het vak.{/if}
					<button class="klein" style="margin-left: 6px" onclick={() => (toonTekst = !toonTekst)}>
						{toonTekst ? 'Tekst verbergen' : 'Tekst tonen'}
					</button>
				</p>
				{#if toonTekst}
					<div style="padding: 0 12px 12px">
						<textarea readonly value={gedeeld} style="min-height: 120px"></textarea>
					</div>
				{/if}
			{/if}
		</div>
	</main>
{/if}
