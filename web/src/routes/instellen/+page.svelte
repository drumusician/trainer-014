<script lang="ts">
	import { goto } from '$app/navigation';
	import { FORMATIES } from '$lib/domein/formaties';
	import { leesCode, maakCode } from '$lib/domein/overzetten';
	import { app } from '$lib/toestand.svelte';
	import { sync } from '$lib/supabase/sync.svelte';
	import { zetKop } from '$lib/kop.svelte';
	import type { Speler, Veldlinie } from '$lib/domein/types';

	$effect(() => zetKop('Instellen', '/', 'Terug'));

	const t = $derived(app.toestand);
	const w = $derived(app.wedstrijd);
	const loopt = $derived(!!w && !w.afgelopen && Object.keys(w.opstelling).length > 0);

	let tegenstander = $state('');
	let thuis = $state('thuis');
	let namenVak = $state('');
	let overzet = $state<'geen' | 'maken' | 'invoeren'>('geen');
	let code = $state('');
	let inlogcode = $state('');

	function opstellingMaken() {
		if (!t.spelers.length) {
			alert('Zet eerst je selectie erin.');
			return;
		}
		app.nieuweWedstrijd(tegenstander, thuis === 'thuis');
		goto('/opstelling/wedstrijd');
	}

	function standaard() {
		if (!t.spelers.length) {
			alert('Zet eerst je selectie erin.');
			return;
		}
		app.zorgVoorStandaard();
		app.gekozenPlek = null;
		goto('/opstelling/standaard');
	}

	function wijzig(p: Speler) {
		const naam = prompt('Naam wijzigen. Laat leeg om deze speler te verwijderen.', p.naam);
		if (naam === null) return;
		if (!naam.trim()) {
			if (confirm(p.naam + ' verwijderen uit de selectie?')) app.verwijderSpeler(p);
		} else {
			app.hernoem(p, naam);
		}
	}

	async function codeMaken() {
		code = maakCode({ v: 1, spelers: t.spelers, formatie: t.formatie, helftMinuten: t.helftMinuten, standaard: t.standaard });
		overzet = 'maken';
		try {
			await navigator.clipboard.writeText(code);
		} catch {
			/* dan met de hand */
		}
	}

	function codeOvernemen() {
		try {
			const pakket = leesCode(code);
			if (!confirm('De selectie op dit toestel vervangen door ' + pakket.spelers.length + ' spelers uit de code?\n\nJe bewaarde wedstrijden blijven staan.'))
				return;
			app.neemOver(pakket);
			overzet = 'geen';
			code = '';
			alert('Overgenomen.');
		} catch (e) {
			alert('Deze code kon ik niet lezen: ' + (e as Error).message);
		}
	}

	const LINIEKNOPPEN: Veldlinie[] = ['V', 'M', 'A'];
</script>

<main>
	<div class="pad">
		<h2>Wedstrijd</h2>
		{#if loopt}
			<p class="uitleg">Er loopt een wedstrijd tegen <b>{w!.tegenstander}</b>.</p>
			<div class="knoprij" style="padding-left: 0">
				<a class="knop prim" href="/">Terug naar de wedstrijd</a>
			</div>
			<div class="knoprij" style="padding-left: 0">
				<button onclick={standaard}>Standaardopstelling</button>
			</div>
		{:else}
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
					<select bind:value={t.formatie}>
						{#each Object.keys(FORMATIES) as f (f)}<option>{f}</option>{/each}
					</select>
				</label>
				<label class="vak">
					Minuten per helft
					<input type="number" inputmode="numeric" bind:value={t.helftMinuten} />
				</label>
			</div>
			<div class="knoprij" style="padding-left: 0">
				<button class="prim" onclick={opstellingMaken}>Opstelling maken</button>
				<button onclick={standaard}>Standaardopstelling</button>
			</div>
			<p class="uitleg">
				{t.standaard
					? 'Elke nieuwe wedstrijd begint met je standaardopstelling.'
					: 'Nog geen standaardopstelling. Maak er een, dan hoef je langs de lijn alleen nog te wisselen.'}
			</p>
		{/if}

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
				keepen, ook als hij verder in het veld speelt. Tik een naam aan om te wijzigen of te verwijderen.
			</p>
			{#each t.spelers as p (p.id)}
				<div class="sregel">
					<span class="naam" role="button" tabindex="0" onclick={() => wijzig(p)} onkeydown={(e) => e.key === 'Enter' && wijzig(p)}>
						{p.naam}
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
		<div class="knoprij" style="padding-left: 0; margin-top: 12px">
			<a class="knop prim" href="/trainingen">Presentie bijhouden</a>
		</div>

		<h2>Archief</h2>
		{#if !t.archief.length}
			<p class="uitleg">Nog geen bewaarde wedstrijden.</p>
		{:else}
			<p class="uitleg">Tik een wedstrijd aan om hem terug te kijken.</p>
			<ul class="log">
				{#each t.archief as a, i (a)}
					<li class="klikbaar">
						<a href="/archief/{i}">
							<b>{a.datum}</b>
							<span>{a.tegenstander} — {a.stand?.[0] ?? 0}–{a.stand?.[1] ?? 0}</span>
							<em>›</em>
						</a>
					</li>
				{/each}
			</ul>
		{/if}
		<div class="knoprij" style="padding-left: 0; margin-top: 12px">
			<a class="knop prim" href="/seizoen">Seizoenstotaal</a>
		</div>

		<h2>Synchroniseren</h2>
		{#if !sync.sessie}
			<p class="uitleg">
				Log in met je e-mailadres, dan staan je laptop en je telefoon gelijk. Je krijgt een mail met een link en een
				code; geen wachtwoord om te onthouden.
			</p>
			{#if sync.fase === 'email'}
				<label class="vak">
					E-mailadres
					<input type="email" inputmode="email" autocomplete="email" bind:value={sync.email} placeholder="jij@voorbeeld.nl" />
				</label>
				<div class="knoprij" style="padding-left: 0">
					<button class="prim" disabled={sync.bezig} onclick={() => sync.stuurCode(sync.email)}>Stuur inlog</button>
				</div>
			{:else}
				<p class="uitleg">
					Staat er een <b>link</b> in de mail? Klik die op dit toestel. Staat er een <b>code</b> in, vul hem hieronder in.
				</p>
				<label class="vak">
					Code uit de mail
					<input type="text" inputmode="numeric" autocomplete="one-time-code" bind:value={inlogcode} placeholder="123456" />
				</label>
				<div class="knoprij" style="padding-left: 0">
					<button class="prim" disabled={sync.bezig} onclick={() => sync.controleerCode(inlogcode)}>Inloggen</button>
					<button onclick={() => (sync.fase = 'email')}>Ander adres</button>
				</div>
			{/if}
		{:else}
			<p class="uitleg">
				Ingelogd als <b>{sync.sessie.email ?? 'onbekend'}</b>.
				{#if sync.sessie.laatst}Laatst gelijkgezet {new Date(sync.sessie.laatst).toLocaleString('nl-NL')}.{/if}
				Een lopende wedstrijd gaat nooit mee; die blijft op dit toestel.
			</p>
			<div class="knoprij" style="padding-left: 0">
				<button class="prim" disabled={sync.bezig} onclick={() => sync.opsturen()}>Opsturen</button>
				<button disabled={sync.bezig} onclick={() => sync.ophalen()}>Ophalen</button>
				<button onclick={() => sync.uitloggen()}>Uitloggen</button>
			</div>
			{#if sync.botsingOpen}
				<div class="knoprij" style="padding-left: 0">
					<button class="uit" onclick={() => sync.opsturen(true)}>Toch dit toestel opsturen</button>
				</div>
			{/if}
		{/if}
		{#if sync.melding}<p class="uitleg" style="margin-top: 8px">{sync.melding}</p>{/if}

		<h2>Overzetten zonder account</h2>
		<p class="uitleg">
			Kan ook zonder inloggen: maak op het ene toestel een code, voer hem op het andere in. Alleen de selectie en de
			standaardopstelling gaan mee.
		</p>
		<div class="knoprij" style="padding-left: 0">
			<button onclick={codeMaken}>Code maken</button>
			<button onclick={() => { overzet = 'invoeren'; code = ''; }}>Code invoeren</button>
		</div>
		{#if overzet === 'maken'}
			<p class="uitleg" style="margin-top: 12px">
				Kopieer deze code en stuur hem naar je andere toestel. Daar op <b>Code invoeren</b> tikken en plakken.
			</p>
			<textarea readonly value={code}></textarea>
		{:else if overzet === 'invoeren'}
			<p class="uitleg" style="margin-top: 12px">Plak hier de code van je andere toestel.</p>
			<textarea bind:value={code} placeholder="Plak de code"></textarea>
			<div class="knoprij" style="padding-left: 0; margin-top: 10px">
				<button class="prim" onclick={codeOvernemen}>Overnemen</button>
			</div>
		{/if}

		<p class="uitleg" style="margin-top: 24px; font-size: 11px; opacity: 0.75">
			Het scherm blijft vanzelf wakker zolang de klok loopt.
		</p>
	</div>
</main>
