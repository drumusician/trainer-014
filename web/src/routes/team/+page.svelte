<script lang="ts">
	import { app } from '$lib/toestand.svelte';
	import { zetKop } from '$lib/kop.svelte';
	import { mager, presentie } from '$lib/domein/presentie';
	import { bezetting, dunneKeepersbezetting, gedrang, tekort } from '$lib/domein/bezetting';
	import type { Speler, Veldlinie } from '$lib/domein/types';

	$effect(() => zetKop('Team'));

	const t = $derived(app.toestand);
	const verdeling = $derived(bezetting(t.spelers, t.formatie));
	let namenVak = $state('');
	const LINIEKNOPPEN: Veldlinie[] = ['V', 'M', 'A'];

	function wijzig(p: Speler) {
		const naam = prompt('Naam wijzigen. Laat leeg om deze speler te verwijderen.', p.naam);
		if (naam === null) return;
		if (!naam.trim()) {
			if (confirm(p.naam + ' verwijderen uit de selectie?')) app.verwijderSpeler(p);
		} else {
			app.hernoem(p, naam);
		}
	}
</script>

<main>
	<div class="pad">
		<h2>Spelers</h2>
		<p class="uitleg">Wie hoeveel speelde en hoe vaak hij op de training stond, alles op één rij.</p>
		<div class="knoprij" style="padding-left: 0">
			<a class="knop prim" href="/team/spelers">Spelersoverzicht</a>
		</div>

		<h2>Selectie</h2>
		{#if !t.spelers.length}
			<p class="uitleg">Plak hier de namen, één per regel. Ze blijven op dit toestel en komen nergens anders terecht.</p>
			<textarea bind:value={namenVak} placeholder="Casper&#10;Maher&#10;Daan"></textarea>
			<div class="knoprij" style="padding-left: 0; margin-top: 10px">
				<button class="prim" onclick={() => { app.namenErbij(namenVak); namenVak = ''; }}>Toevoegen</button>
			</div>
		{:else}
			<p class="uitleg">
				Zet per speler de linie: V verdediging, M middenveld, A aanval. <b>K</b> staat los: dat is iedereen die kan
				keepen, ook als hij verder in het veld speelt. Alleen K aan en de rest uit betekent: keeper en verder niets.
				Tik een naam aan om te wijzigen of te verwijderen.
			</p>
			{#each t.spelers as p (p.id)}
				{@const recent = presentie(t.trainingen, p.id, 4)}
				<div class="sregel">
					<span class="naam" role="button" tabindex="0" onclick={() => wijzig(p)} onkeydown={(e) => e.key === 'Enter' && wijzig(p)}>
						{p.naam}{#if mager(recent)}<span class="min mager"> {recent.er}/{recent.totaal}</span>{/if}
					</span>
					<div class="keuze">
						<button class:aan={p.keept} onclick={() => app.zetKeept(p)}>K</button>
						{#each LINIEKNOPPEN as code (code)}
							<button class:aan={p.linie === code} onclick={() => app.zetLinie(p, code)}>{code}</button>
						{/each}
					</div>
				</div>
			{/each}
			<div class="knoprij" style="padding-left: 0; margin-top: 12px">
				<button
					onclick={() => {
						const naam = prompt('Naam van de speler');
						if (naam?.trim()) app.namenErbij(naam);
					}}>Speler toevoegen</button
				>
			</div>

			<h2>Verdeling in {t.formatie}</h2>
			<table class="uitslag">
				<tbody>
					{#each verdeling as b (b.linie)}
						<tr>
							<td>{b.naam}</td>
							<td class="m" class:mager={tekort(b) || gedrang(b)}>
								{#if b.linie === 'K'}
									{b.spelers}
									{b.spelers === 1 ? 'kan keepen' : 'kunnen keepen'}
								{:else}
									{b.spelers} voor {b.plekken}
									{b.plekken === 1 ? 'plek' : 'plekken'}
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
			<p class="uitleg" style="margin-top: 8px">
				{#if verdeling.some(tekort)}
					Een linie is niet vol te krijgen met de spelers die je zo gemarkeerd hebt.
				{:else if dunneKeepersbezetting(verdeling)}
					Er kan er maar één keepen. Is hij er niet, dan moet je ter plekke iemand aanwijzen.
				{:else if verdeling.some(gedrang)}
					Waar meer dan twee keer zoveel spelers als plekken staan, zit er elke wedstrijd iemand op de bank die
					zichzelf daar ziet. Een andere formatie kan schelen.
				{:else}
					De letters zijn een hint bij het wisselen, geen regel: je kunt altijd iedereen kiezen.
				{/if}
			</p>
		{/if}

		<h2>Trainingen</h2>
		{#if !t.trainingen.length}
			<p class="uitleg">Nog niets bijgehouden. Wie vaak niet komt trainen zie je hier straks meteen.</p>
		{:else}
			<p class="uitleg">
				{t.trainingen.length}
				{t.trainingen.length === 1 ? 'training' : 'trainingen'} bijgehouden. Laatste: {t.trainingen[0].datum}.
			</p>
		{/if}
		<div class="knoprij" style="padding-left: 0">
			<a class="knop prim" href="/trainingen">Presentie bijhouden</a>
		</div>
	</div>
</main>
