<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import Veld from '$lib/componenten/Veld.svelte';
	import BankKolom from '$lib/componenten/BankKolom.svelte';
	import { positionCount, groupOf, linesIn, LINES, positionLine, FORMATS } from '$lib/domein/formaties';
	import { thinAttendance, attendanceOf } from '$lib/domein/presentie';
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
			app.ensureDefaultLineup();
		}
	});

	/* Pas ná de aftrap hoort schuiven hier niet meer: vanaf dan wordt de speeltijd
	   teruggerekend uit de wissels, en ongemerkt ruilen zet die op scherp.
	   Zolang de klok nog niet gelopen heeft mag je alles nog verzetten. */
	$effect(() => {
		if (bron === 'wedstrijd' && app.kickedOff) goto('/app/wedstrijd');
	});

	const bezet = $derived(doel ? Object.values(doel.opstelling).filter(Boolean).length : 0);
	const nodig = $derived(doel ? positionCount(doel.formatie) : 0);
	const gekozenSpeler = $derived(
		doel && app.chosenPosition ? app.playerById(doel.opstelling[app.chosenPosition]) : undefined
	);

	/* Eerste tik kiest een plek. Tweede tik op een andere plek ruilt ze om; staat
	   daar niemand, dan verhuist hij ernaartoe. */
	function tikPlek(plekId: string) {
		if (!app.chosenPosition) {
			app.chosenPosition = plekId;
			return;
		}
		if (app.chosenPosition === plekId) {
			app.chosenPosition = null;
			return;
		}
		app.swapPositions(bron, app.chosenPosition, plekId);
	}

	/* Linies zonder wissel: dat is een verrassing die je liever nu hebt. */
	const zonderWissel = $derived.by(() => {
		if (!doel) return [];
		const bank = doel.bank.map((id) => app.playerById(id)).filter(Boolean);
		/* alleen de linies die in deze formatie voorkomen: bij 4 tegen 4 geen keeper */
		return linesIn(doel.formatie)
			.filter((code) => !bank.some((p) => p && groupOf(p) === code))
			.map((code) => LINES[code].toLowerCase());
	});

	const mageren = $derived(
		app.toestand.spelers.filter((p) => thinAttendance(attendanceOf(app.toestand.trainingen, p.id, 4)))
	);

	function klaar() {
		if (bron === 'standaard') {
			app.save();
			goto('/app');
			return;
		}
		if (bezet < nodig && !confirm('Er staan er ' + bezet + ' op het veld in plaats van ' + nodig + '. Toch doorgaan?'))
			return;
		app.chosenPosition = null;
		goto('/app/wedstrijd');
	}

	function wissen() {
		if (!confirm('De standaardopstelling weggooien?')) return;
		app.clearDefaultLineup();
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
				<Veld formatie={doel.formatie} opstelling={doel.opstelling} gekozen={app.chosenPosition} onplek={tikPlek} />
				<BankKolom
					bank={doel.bank}
					formatie={doel.formatie}
					gekozen={app.chosenPosition}
					leegtekst="Niemand over."
					ontik={(id) => app.putOnPositionWhileSettingUp(bron, id)}
				/>
			</div>

			{#if app.chosenPosition}
				<div class="melding">
					<span>
						{#if gekozenSpeler}
							<b>{gekozenSpeler.naam}</b> · {LINES[positionLine(app.chosenPosition, doel.formatie)].toLowerCase()}. Tik
							een andere plek om te ruilen, of iemand van de bank.
						{:else}
							<b>Lege plek</b> · {LINES[positionLine(app.chosenPosition, doel.formatie)].toLowerCase()}. Tik wie hier
							komt te staan.
						{/if}
					</span>
					{#if gekozenSpeler}
						<button class="klein" onclick={() => app.takeOffPitch(bron, app.chosenPosition!)}>Naar de bank</button>
					{/if}
					<button class="klein" onclick={() => (app.chosenPosition = null)}>Annuleren</button>
				</div>
			{/if}

			{#if !app.chosenPosition && zonderWissel.length}
				<p class="uitleg" style="padding: 0 12px; margin: 0 0 8px">
					<b class="mager">Geen wissel voor {zonderWissel.join(', ')}.</b>
				</p>
			{/if}
			{#if !app.chosenPosition && mageren.length}
				<p class="uitleg" style="padding: 0 12px">
					Weinig getraind:
					{#each mageren as p, i (p.id)}
						{@const r = attendanceOf(app.toestand.trainingen, p.id, 4)}
						<b class="mager">{p.naam} {r.er}/{r.totaal}</b>{i < mageren.length - 1 ? ', ' : ''}
					{/each}
				</p>
			{/if}

			<div class="knoprij">
				{#if bron === 'standaard'}
					<label class="formatiekeuze">
						Formatie
						<select value={doel.formatie} onchange={(e) => app.chooseFormation(e.currentTarget.value)}>
							{#each FORMATS as vorm (vorm.naam)}
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
				{#if bron === 'standaard'}
					<button class="uit" onclick={wissen}>Wissen</button>
				{/if}
				<span class="uitleg" style="align-self: center; margin: 0">{bezet} van de {nodig} ingevuld</span>
			</div>
		</div>
	</main>
{/if}
