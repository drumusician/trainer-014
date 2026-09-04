<script lang="ts">
	import { goto } from '$app/navigation';
	import { aantalPlekken, speelvormVan, SPEELVORMEN } from '$lib/domein/formaties';
	import { mmss, verstreken } from '$lib/domein/tijd';
	import { deelNaam, pauzeNaam } from '$lib/domein/delen';
	import { app } from '$lib/toestand.svelte';
	import { zetKop } from '$lib/kop.svelte';

	$effect(() => zetKop('Blaadje'));

	const t = $derived(app.toestand);
	const w = $derived(app.wedstrijd);
	const staatKlaar = $derived(!!w && !w.afgelopen && Object.values(w.opstelling).some(Boolean));
	const bezig = $derived(staatKlaar && app.gestart);
	const opgezet = $derived(!!w && !w.afgelopen && !Object.values(w.opstelling).some(Boolean));

	let tegenstander = $state('');
	let thuis = $state('thuis');

	function opstellingMaken() {
		if (!t.spelers.length) {
			alert('Zet eerst je selectie erin, bij Team.');
			return;
		}
		app.nieuweWedstrijd(tegenstander, thuis === 'thuis');
		goto('/app/aanwezig');
	}

	function standaard() {
		if (!t.spelers.length) {
			alert('Zet eerst je selectie erin, bij Team.');
			return;
		}
		app.zorgVoorStandaard();
		app.gekozenPlek = null;
		goto('/app/opstelling/standaard');
	}

	function weggooien() {
		if (!confirm('Deze wedstrijd tegen ' + w!.tegenstander + ' weggooien?\n\nAlles van deze wedstrijd is dan weg. Wat je in het archief bewaarde blijft staan.'))
			return;
		app.gooiWedstrijdWeg();
	}
</script>

<main>
	<div class="pad">
		{#if staatKlaar || opgezet}
			<h2>{bezig ? 'Bezig' : 'Klaarstaan'}</h2>
			<p style="font-size: 22px; font-weight: 700; margin: 0 0 4px">
				{w!.thuis ? t.teamnaam + ' – ' + w!.tegenstander : w!.tegenstander + ' – ' + t.teamnaam}
			</p>
			<p class="uitleg">
				{#if bezig}
					{mmss(verstreken(w, app.nu))} ·
					{w!.pauze ? pauzeNaam(w!.deel, w!.delen).toLowerCase() : deelNaam(w!.deel, w!.delen)} ·
					{w!.loopt ? 'klok loopt' : 'klok staat stil'}
				{:else if staatKlaar}
					De opstelling staat. De klok begint pas als je op Start drukt.
				{:else}
					De opstelling staat nog niet.
				{/if}
			</p>
			<div class="knoprij" style="padding-left: 0">
				{#if opgezet}
					<a class="knop prim" href="/app/opstelling/wedstrijd">Opstelling maken</a>
				{:else}
					<a class="knop prim" href="/app/wedstrijd">{bezig ? 'Verder met de wedstrijd' : 'Naar de wedstrijd'}</a>
					{#if !bezig}
						<a class="knop" href="/app/opstelling/wedstrijd">Opstelling wijzigen</a>
					{/if}
				{/if}
				<a class="knop" href="/app/aanwezig">Wie is er?</a>
				<button class="uit" onclick={weggooien}>Weggooien</button>
			</div>
		{:else if w?.afgelopen && !w.bewaard}
			<h2>Net gespeeld</h2>
			<p class="uitleg">De wedstrijd tegen {w.tegenstander} is afgelopen maar nog niet bewaard.</p>
			<div class="knoprij" style="padding-left: 0">
				<a class="knop prim" href="/app/afloop">Naar het overzicht</a>
			</div>
		{:else}
			<h2>Nieuwe wedstrijd</h2>
			{#if t.teamnaam === 'Ons team' && t.spelers.length}
				<p class="uitleg">
					<b class="mager">Je team heet nog "Ons team".</b> Zet bij
					<a href="/app/team">Team</a> even je eigen naam erin, dan staat die goed in je verslag.
				</p>
			{/if}
			<div class="tweekolom">
				<label class="vak">
					Tegenstander
					<input bind:value={tegenstander} placeholder="bijv. Sparta JO11-2" />
				</label>
				<label class="vak">
					Thuis of uit
					<select bind:value={thuis}><option value="thuis">Thuis</option><option value="uit">Uit</option></select>
				</label>
			</div>
			<div class="tweekolom">
				<label class="vak">
					Formatie
					<select value={t.formatie} onchange={(e) => app.kiesFormatie(e.currentTarget.value)}>
						{#each SPEELVORMEN as vorm (vorm.naam)}
							<optgroup label={vorm.naam + (vorm.uitleg ? ' · ' + vorm.uitleg : '')}>
								{#each vorm.formaties as f (f.sleutel)}
									<option value={f.sleutel}>{f.sleutel}{f.uitleg ? ' · ' + f.uitleg : ''}</option>
								{/each}
							</optgroup>
						{/each}
					</select>
				</label>
				<label class="vak">
					Speelwijze
					<select bind:value={t.delen} onchange={() => app.bewaar()}>
						<option value={2}>2 helften</option>
						<option value={4}>4 kwarten</option>
					</select>
				</label>
			</div>
			<div class="tweekolom">
				<label class="vak">
					Minuten per {t.delen === 4 ? 'kwart' : 'helft'}
					<input type="number" inputmode="numeric" bind:value={t.helftMinuten} onchange={() => app.bewaar()} />
				</label>
				<label class="vak">
					Speelduur
					<input value={t.helftMinuten * t.delen + ' minuten'} readonly />
				</label>
			</div>
			<div class="knoprij" style="padding-left: 0">
				<button class="prim" onclick={opstellingMaken}>Beginnen</button>
			</div>
		{/if}

		<h2>Standaardopstelling</h2>
		<p class="uitleg">
			{#if t.standaard && t.standaard.formatie !== t.formatie}
				<b class="mager">Je standaardopstelling staat in {t.standaard.formatie}, je speelt nu {t.formatie}.</b>
				Open hem, dan zet ik hem om: wie past blijft staan, de rest gaat naar de bank.
			{:else if t.standaard}
				Elke nieuwe wedstrijd begint hiermee. Langs de lijn hoef je dan alleen nog te wisselen.
			{:else}
				Nog geen standaardopstelling. Maak er een, dan begint elke wedstrijd met je vaste team.
			{/if}
		</p>
		<div class="knoprij" style="padding-left: 0">
			<button onclick={standaard}>{t.standaard ? 'Standaardopstelling wijzigen' : 'Standaardopstelling maken'}</button>
		</div>
	</div>
</main>
