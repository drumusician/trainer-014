<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import Veld from '$lib/components/Veld.svelte';
	import BankKolom from '$lib/components/BankKolom.svelte';
	import { positionCount, groupOf, linesIn, LINES, positionLine, FORMATS } from '$lib/domain/formations';
	import { thinAttendance, attendanceOf } from '$lib/domain/attendance';
	import { app } from '$lib/store.svelte';
	import { zetKop } from '$lib/header.svelte';

	const bron = $derived(page.params.bron === 'standaard' ? 'standaard' : 'wedstrijd');
	const doel = $derived(bron === 'standaard' ? app.toestand.defaultLineup : app.match);

	$effect(() => {
		zetKop(bron === 'standaard' ? 'Standaardopstelling' : 'Opstelling', '/app', 'Terug');
	});

	/* Rechtstreeks hierheen komen moet ook werken, bijvoorbeeld vanaf een kaart
	   op het startscherm. Bestaat er nog geen standaardopstelling, dan maken we
	   hem hier aan in plaats van een doodlopend scherm te tonen. */
	$effect(() => {
		if (bron === 'standaard' && !app.toestand.defaultLineup && app.toestand.players.length) {
			app.ensureDefaultLineup();
		}
	});

	/* Pas ná de aftrap hoort schuiven hier niet meer: vanaf dan wordt de speeltijd
	   teruggerekend uit de wissels, en ongemerkt ruilen zet die op scherp.
	   Zolang de klok nog niet gelopen heeft mag je alles nog verzetten. */
	$effect(() => {
		if (bron === 'wedstrijd' && app.kickedOff) goto('/app/wedstrijd');
	});

	const bezet = $derived(doel ? Object.values(doel.lineup).filter(Boolean).length : 0);
	const nodig = $derived(doel ? positionCount(doel.formation) : 0);
	const gekozenSpeler = $derived(
		doel && app.chosenPosition ? app.playerById(doel.lineup[app.chosenPosition]) : undefined
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
		const bench = doel.bench.map((id) => app.playerById(id)).filter(Boolean);
		/* alleen de linies die in deze formatie voorkomen: bij 4 tegen 4 geen keeper */
		return linesIn(doel.formation)
			.filter((code) => !bench.some((p) => p && groupOf(p) === code))
			.map((code) => LINES[code].toLowerCase());
	});

	const mageren = $derived(
		app.toestand.players.filter((p) => thinAttendance(attendanceOf(app.toestand.trainings, p.id, 4)))
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
				{#if !app.toestand.players.length}
					Zet eerst je selectie on, dan valt er what op te stellen.
				{:else}
					Er is geen match om op te stellen. Begin er een op het startscherm.
				{/if}
			</p>
			<div class="knoprij" style="padding-left: 0">
				<a class="knop prim" href={app.toestand.players.length ? '/app' : '/app/opzetten'}>
					{app.toestand.players.length ? 'Naar start' : 'Aan de slag'}
				</a>
			</div>
		</div>
	</main>
{:else}
	<main>
		<div class="veldscherm zonderklok">
			<div class="veldrij">
				<Veld formation={doel.formation} lineup={doel.lineup} gekozen={app.chosenPosition} onplek={tikPlek} />
				<BankKolom
					bench={doel.bench}
					formation={doel.formation}
					gekozen={app.chosenPosition}
					leegtekst="Niemand over."
					ontik={(id) => app.putOnPositionWhileSettingUp(bron, id)}
				/>
			</div>

			{#if app.chosenPosition}
				<div class="melding">
					<span>
						{#if gekozenSpeler}
							<b>{gekozenSpeler.name}</b> · {LINES[positionLine(app.chosenPosition, doel.formation)].toLowerCase()}. Tik
							een andere position om te ruilen, of iemand van de bench.
						{:else}
							<b>Lege position</b> · {LINES[positionLine(app.chosenPosition, doel.formation)].toLowerCase()}. Tik wie
							hier komt te staan.
						{/if}
					</span>
					{#if gekozenSpeler}
						<button class="klein" onclick={() => app.takeOffPitch(bron, app.chosenPosition!)}>Naar de bench</button>
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
						{@const r = attendanceOf(app.toestand.trainings, p.id, 4)}
						<b class="mager">{p.name} {r.er}/{r.totaal}</b>{i < mageren.length - 1 ? ', ' : ''}
					{/each}
				</p>
			{/if}

			<div class="knoprij">
				{#if bron === 'standaard'}
					<label class="formatiekeuze">
						Formatie
						<select value={doel.formation} onchange={(e) => app.chooseFormation(e.currentTarget.value)}>
							{#each FORMATS as vorm (vorm.name)}
								<optgroup label={vorm.name + (vorm.uitleg ? ' · ' + vorm.uitleg : '')}>
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
