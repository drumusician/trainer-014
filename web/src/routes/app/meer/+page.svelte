<script lang="ts">
	import { backupNaam, leesBackup, maakBackup } from '$lib/domein/backup';
	import { beschrijf, leesCode, maakCode } from '$lib/domein/overzetten';
	import { app } from '$lib/toestand.svelte';
	import { sync } from '$lib/supabase/sync.svelte';
	import { zetKop } from '$lib/kop.svelte';
	import { opslagstand } from '$lib/opslag.svelte';

	$effect(() => zetKop('Gegevens'));

	const t = $derived(app.toestand);
	let inlogcode = $state('');
	let overzet = $state<'geen' | 'maken' | 'invoeren'>('geen');
	let code = $state('');
	let backup = $state<'geen' | 'maken'>('geen');
	/* De link uit de mail komt terug waar je hem opvroeg. Op je eigen machine is
	   dat localhost, en dat is een andere opslag dan de echte site. */
	const opLokaal = $derived(
		typeof location !== 'undefined' && /^(localhost|127\.|\[::1\])/.test(location.hostname)
	);
	let backuptekst = $state('');

	async function codeMaken() {
		code = maakCode(t);
		overzet = 'maken';
		try {
			await navigator.clipboard.writeText(code);
		} catch {
			/* dan met de hand */
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

	/** Eén knop voor allebei: een code en een back-up bevatten hetzelfde. */
	function overnemen() {
		try {
			const pakket = leesCode(code);
			if (!confirm('Dit overnemen op dit toestel?\n\n' + beschrijf(pakket) + '.\n\nWat hierin zit vervangt wat je nu hebt. Een wedstrijd die nu loopt blijft staan.'))
				return;
			app.neemOver(pakket);
			overzet = 'geen';
			code = '';
			alert('Overgenomen.');
		} catch (e) {
			alert('Dit kon ik niet lezen: ' + (e as Error).message);
		}
	}

</script>

<main>
	<div class="pad">
		<h2>Synchroniseren</h2>
		{#if !sync.sessie}
			<p class="uitleg">
				Log in met je e-mailadres, dan staat je seizoen veilig en heb je het op al je toestellen. Je krijgt een mail met
				een link en een code; geen wachtwoord om te onthouden.
			</p>
			{#if opLokaal}
				<p class="uitleg">
					<b class="mager">Let op:</b> je draait dit op {location.host}. De link in de mail komt hier terug, niet op de
					echte site, en dit is een aparte opslag. Wil je inloggen voor je telefoon, doe dat dan op de echte site.
				</p>
			{/if}
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
					Op een telefoon: vul de <b>code</b> uit de mail hieronder in. Je mag gerust even naar je mail-app; dit
					scherm staat er straks nog. Op een laptop kun je ook gewoon de <b>link</b> in de mail aanklikken.
				</p>
				<label class="vak">
					Code uit de mail
					<input type="text" inputmode="numeric" autocomplete="one-time-code" bind:value={inlogcode} placeholder="123456" />
				</label>
				<div class="knoprij" style="padding-left: 0">
					<button class="prim" disabled={sync.bezig} onclick={() => sync.controleerCode(inlogcode)}>Inloggen</button>
					<button onclick={() => sync.opnieuw()}>Ander adres</button>
				</div>
			{/if}
		{:else}
			<p class="uitleg">
				Ingelogd als <b>{sync.sessie.email ?? 'onbekend'}</b>. De app werkt gewoon zonder bereik en stuurt vanzelf op
				zodra er weer internet is. Een wedstrijd die je klaarzet gaat mee, dus je stelt thuis op en pakt hem op het
				veld op je telefoon op. Een wedstrijd die al loopt wordt wel opgestuurd, maar nooit overschreven door een
				ander toestel.
			</p>
			<p class="uitleg">
				<b>
					{#if sync.botsing}
						Er staat iets nieuwers op de server.
					{:else if sync.vies && sync.hapert}
						Nog niet opgestuurd, geen verbinding.
					{:else if sync.vies}
						Nog niet opgestuurd.
					{:else if sync.sessie.laatst}
						Bijgewerkt {new Date(sync.sessie.laatst).toLocaleString('nl-NL')}.
					{:else}
						Nog niets uitgewisseld.
					{/if}
				</b>
			</p>
			<div class="knoprij" style="padding-left: 0">
				<button class="prim" disabled={sync.bezig} onclick={() => sync.opsturen()}>Nu opsturen</button>
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

		<h2>Overzetten en back-up</h2>
		{#if !sync.sessie}
			<p class="uitleg">
				<b class="mager">Alles staat alleen op dit toestel.</b> Raakt het kwijt of gaat het stuk, dan is je seizoen weg.
				Maak af en toe een back-up, of log hierboven in en het gaat vanzelf.
			</p>
		{/if}
		<p class="uitleg">
			Alles wat de app onthoudt: selectie, standaardopstelling, trainingen en het hele archief. Als bestand om te
			bewaren, of als code om op je andere toestel in te voeren. Een wedstrijd die nu loopt gaat nooit mee.
		</p>
		<div class="knoprij" style="padding-left: 0">
			<button onclick={backupMaken}>Bestand opslaan</button>
			<button onclick={codeMaken}>Code maken</button>
			<button onclick={() => { overzet = 'invoeren'; backup = 'geen'; code = ''; }}>Invoeren</button>
		</div>
		{#if backup === 'maken'}
			<p class="uitleg" style="margin-top: 12px">Opgeslagen als bestand, en gekopieerd.</p>
			<textarea readonly value={backuptekst} style="min-height: 120px"></textarea>
		{:else if overzet === 'maken'}
			<p class="uitleg" style="margin-top: 12px">
				Gekopieerd. Stuur hem naar je andere toestel en tik daar op <b>Invoeren</b>.
			</p>
			<textarea readonly value={code}></textarea>
		{:else if overzet === 'invoeren'}
			<p class="uitleg" style="margin-top: 12px">Plak hier een code of de inhoud van een bestand; allebei werkt.</p>
			<textarea bind:value={code} placeholder="Plak de code of de back-up" style="min-height: 120px"></textarea>
			<div class="knoprij" style="padding-left: 0; margin-top: 10px">
				<button class="prim" onclick={overnemen}>Overnemen</button>
			</div>
		{/if}

		{#if opslagstand.ondersteund && opslagstand.blijvend === false}
			<p class="uitleg" style="margin-top: 12px">
				<b class="mager">Deze browser mag je gegevens opruimen</b> als hij plaats nodig heeft. Zet de app op je
				beginscherm en log in, of maak af en toe een back-up.
			</p>
		{/if}

		<p class="uitleg" style="margin-top: 24px; font-size: 11px; opacity: 0.75">
			Blaadje · het scherm blijft wakker zolang de klok loopt
		</p>
	</div>
</main>
