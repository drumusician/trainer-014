<script lang="ts">
	import { goto } from '$app/navigation';
	import { aantalPlekken, speelvormVan, SPEELVORMEN } from '$lib/domein/formaties';
	import { mmss, verstreken } from '$lib/domein/tijd';
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
		goto('/aanwezig');
	}

	function standaard() {
		if (!t.spelers.length) {
			alert('Zet eerst je selectie erin, bij Team.');
			return;
		}
		app.zorgVoorStandaard();
		app.gekozenPlek = null;
		goto('/opstelling/standaard');
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
				{w!.thuis ? 'O14 – ' + w!.tegenstander : w!.tegenstander + ' – O14'}
			</p>
			<p class="uitleg">
				{#if bezig}
					{mmss(verstreken(w, app.nu))} · {w!.helft === 1 ? '1e helft' : '2e helft'} · {w!.loopt
						? 'klok loopt'
						: 'klok staat stil'}
				{:else if staatKlaar}
					De opstelling staat. De klok begint pas als je op Start drukt.
				{:else}
					De opstelling staat nog niet.
				{/if}
			</p>
			<div class="knoprij" style="padding-left: 0">
				{#if opgezet}
					<a class="knop prim" href="/opstelling/wedstrijd">Opstelling maken</a>
				{:else}
					<a class="knop prim" href="/wedstrijd">{bezig ? 'Verder met de wedstrijd' : 'Naar de wedstrijd'}</a>
					{#if !bezig}
						<a class="knop" href="/opstelling/wedstrijd">Opstelling wijzigen</a>
					{/if}
				{/if}
				<a class="knop" href="/aanwezig">Wie is er?</a>
				<button class="uit" onclick={weggooien}>Weggooien</button>
			</div>
		{:else if w?.afgelopen && !w.bewaard}
			<h2>Net gespeeld</h2>
			<p class="uitleg">De wedstrijd tegen {w.tegenstander} is afgelopen maar nog niet bewaard.</p>
			<div class="knoprij" style="padding-left: 0">
				<a class="knop prim" href="/afloop">Naar het overzicht</a>
			</div>
		{:else}
			<h2>Nieuwe wedstrijd</h2>
			<div class="tweekolom">
				<label class="vak">
					Tegenstander
					<input bind:value={tegenstander} placeholder="bijv. Sparta O14" />
				</label>
				<label class="vak">
					Thuis of uit
					<select bind:value={thuis}><option value="thuis">Thuis</option><option value="uit">Uit</option></select>
				</label>
			</div>
			<div class="tweekolom">
				<label class="vak">
					Formatie
					<select bind:value={t.formatie} onchange={() => app.bewaar()}>
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
					Minuten per helft
					<input type="number" inputmode="numeric" bind:value={t.helftMinuten} onchange={() => app.bewaar()} />
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
				Daardoor begint een nieuwe wedstrijd met een leeg veld. Maak hem opnieuw in de formatie die je speelt.
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
