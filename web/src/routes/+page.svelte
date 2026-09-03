<script lang="ts">
	import { goto } from '$app/navigation';
	import { FORMATIES } from '$lib/domein/formaties';
	import { mmss, verstreken } from '$lib/domein/tijd';
	import { app } from '$lib/toestand.svelte';
	import { zetKop } from '$lib/kop.svelte';

	$effect(() => zetKop('Blaadje'));

	const t = $derived(app.toestand);
	const w = $derived(app.wedstrijd);
	const loopt = $derived(!!w && !w.afgelopen && Object.keys(w.opstelling).length > 0);
	const opgezet = $derived(!!w && !w.afgelopen && !Object.keys(w.opstelling).length);

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
		{#if loopt || opgezet}
			<h2>Bezig</h2>
			<p style="font-size: 22px; font-weight: 700; margin: 0 0 4px">
				{w!.thuis ? 'O14 – ' + w!.tegenstander : w!.tegenstander + ' – O14'}
			</p>
			<p class="uitleg">
				{#if loopt}
					{mmss(verstreken(w, app.nu))} · {w!.helft === 1 ? '1e helft' : '2e helft'} · {w!.loopt ? 'klok loopt' : 'klok staat stil'}
				{:else}
					De opstelling staat nog niet.
				{/if}
			</p>
			<div class="knoprij" style="padding-left: 0">
				<a class="knop prim" href={loopt ? '/wedstrijd' : '/opstelling/wedstrijd'}>
					{loopt ? 'Verder met de wedstrijd' : 'Opstelling maken'}
				</a>
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
						{#each Object.keys(FORMATIES) as f (f)}<option>{f}</option>{/each}
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
			{t.standaard
				? 'Elke nieuwe wedstrijd begint hiermee. Langs de lijn hoef je dan alleen nog te wisselen.'
				: 'Nog geen standaardopstelling. Maak er een, dan begint elke wedstrijd met je vaste elftal.'}
		</p>
		<div class="knoprij" style="padding-left: 0">
			<button onclick={standaard}>{t.standaard ? 'Standaardopstelling wijzigen' : 'Standaardopstelling maken'}</button>
		</div>
	</div>
</main>
