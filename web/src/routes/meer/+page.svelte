<script lang="ts">
	import { backupNaam, leesBackup, maakBackup } from '$lib/domein/backup';
	import { leesCode, maakCode } from '$lib/domein/overzetten';
	import { app } from '$lib/toestand.svelte';
	import { sync } from '$lib/supabase/sync.svelte';
	import { zetKop } from '$lib/kop.svelte';

	$effect(() => zetKop('Meer'));

	const t = $derived(app.toestand);
	let inlogcode = $state('');
	let overzet = $state<'geen' | 'maken' | 'invoeren'>('geen');
	let code = $state('');
	let backup = $state<'geen' | 'maken' | 'terugzetten'>('geen');
	let backuptekst = $state('');

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

	async function backupMaken() {
		const gemaakt = new Date().toISOString();
		backuptekst = maakBackup(t, gemaakt);
		backup = 'maken';
		try {
			await navigator.clipboard.writeText(backuptekst);
		} catch {
			/* dan via het bestand */
		}
		const blob = new Blob([backuptekst], { type: 'application/json' });
		const a = document.createElement('a');
		a.href = URL.createObjectURL(blob);
		a.download = backupNaam(gemaakt);
		a.click();
		URL.revokeObjectURL(a.href);
	}

	function backupTerugzetten() {
		try {
			const d = leesBackup(backuptekst);
			if (!confirm('Alles op dit toestel vervangen door de back-up?\n\n' + d.spelers.length + ' spelers, ' + d.archief.length + ' bewaarde wedstrijden, ' + d.trainingen.length + ' trainingen.'))
				return;
			app.zetBackupTerug(d);
			backup = 'geen';
			backuptekst = '';
			alert('Teruggezet.');
		} catch (e) {
			alert('Deze back-up kon ik niet lezen: ' + (e as Error).message);
		}
	}
</script>

<main>
	<div class="pad">
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

		<h2>Back-up</h2>
		<p class="uitleg">
			Alles wat de app onthoudt als tekst: selectie, standaardopstelling, trainingen en het hele archief. Je krijgt hem
			als bestand én op je klembord. Een wedstrijd die nu loopt gaat niet mee.
		</p>
		<div class="knoprij" style="padding-left: 0">
			<button onclick={backupMaken}>Back-up maken</button>
			<button onclick={() => { backup = 'terugzetten'; backuptekst = ''; }}>Back-up terugzetten</button>
		</div>
		{#if backup === 'maken'}
			<p class="uitleg" style="margin-top: 12px">Bewaard als bestand, en gekopieerd. Zet hem ergens waar je hem terugvindt.</p>
			<textarea readonly value={backuptekst} style="min-height: 120px"></textarea>
		{:else if backup === 'terugzetten'}
			<p class="uitleg" style="margin-top: 12px">Plak hier de inhoud van een back-up.</p>
			<textarea bind:value={backuptekst} placeholder="Plak de back-up" style="min-height: 120px"></textarea>
			<div class="knoprij" style="padding-left: 0; margin-top: 10px">
				<button class="prim" onclick={backupTerugzetten}>Terugzetten</button>
			</div>
		{/if}

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
			Blaadje · alles staat op dit toestel · het scherm blijft wakker zolang de klok loopt
		</p>
	</div>
</main>
