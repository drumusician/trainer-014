<script lang="ts">
	import { backupName, readBackup, makeBackup } from '$lib/domain/backup';
	import { describePackage, readTransferCode, makeTransferCode } from '$lib/domain/transfer';
	import { app } from '$lib/store.svelte';
	import { sync } from '$lib/supabase/sync.svelte';
	import { zetKop } from '$lib/header.svelte';
	import { opslagstand } from '$lib/storage.svelte';
	import { issues, clearIssues } from '$lib/issues.svelte';
	import { text } from '$lib/text/nl';

	$effect(() => zetKop('Gegevens'));

	const t = $derived(app.toestand);
	let inlogcode = $state('');
	let overzet = $state<'geen' | 'maken' | 'invoeren'>('geen');
	let code = $state('');
	let backup = $state<'geen' | 'maken'>('geen');
	/* The link from the mail returns to wherever you requested it. On your own
	   machine that is localhost, which is a different store from the real site. */
	const opLokaal = $derived(typeof location !== 'undefined' && /^(localhost|127\.|\[::1\])/.test(location.hostname));
	let backuptekst = $state('');

	async function codeMaken() {
		code = makeTransferCode(t);
		overzet = 'maken';
		try {
			await navigator.clipboard.writeText(code);
		} catch {
			/* then by hand */
		}
	}

	async function backupMaken() {
		const gemaakt = new Date().toISOString();
		backuptekst = makeBackup(t, gemaakt);
		backup = 'maken';
		try {
			await navigator.clipboard.writeText(backuptekst);
		} catch {
			/* then via the file */
		}
		const blob = new Blob([backuptekst], { type: 'application/json' });
		const a = document.createElement('a');
		a.href = URL.createObjectURL(blob);
		a.download = backupName(gemaakt);
		a.click();
		URL.revokeObjectURL(a.href);
	}

	/**
	 * Restore a saved file.
	 *
	 * This was missing while 'Bestand opslaan' was not. So the only way to restore
	 * a backup was to open it, select everything and paste — not something you do
	 * on a phone with a hundred-kilobyte file.
	 */
	async function bestandInlezen(e: Event) {
		const invoer = e.currentTarget as HTMLInputElement;
		const bestand = invoer.files?.[0];
		if (!bestand) return;
		try {
			const pakket = readBackup(await bestand.text());
			if (confirm(text.data.confirmRestore(describePackage(pakket)))) {
				app.adoptPackage(pakket);
				backup = 'geen';
				overzet = 'geen';
				alert(text.data.restored);
			}
		} catch (fout) {
			alert(text.data.unreadableFile((fout as Error).message));
		}
		/* Clear it, otherwise you cannot pick the same file twice. */
		invoer.value = '';
	}

	/** One button for both: a code and a backup hold the same thing. */
	function overnemen() {
		try {
			const pakket = readTransferCode(code);
			if (!confirm(text.data.confirmAdopt(describePackage(pakket)))) return;
			app.adoptPackage(pakket);
			overzet = 'geen';
			code = '';
			alert(text.data.adopted);
		} catch (e) {
			alert(text.data.unreadable((e as Error).message));
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
					<input
						type="email"
						inputmode="email"
						autocomplete="email"
						bind:value={sync.email}
						placeholder="jij@voorbeeld.nl"
					/>
				</label>
				<div class="knoprij" style="padding-left: 0">
					<button class="prim" disabled={sync.bezig} onclick={() => sync.stuurCode(sync.email)}>Stuur inlog</button>
				</div>
			{:else}
				<p class="uitleg">
					Op een telefoon: vul de <b>code</b> uit de mail hieronder in. Je mag gerust even naar je mail-app; dit scherm
					staat er straks nog. Op een laptop kun je ook gewoon de <b>link</b> in de mail aanklikken.
				</p>
				<label class="vak">
					Code uit de mail
					<input
						type="text"
						inputmode="numeric"
						autocomplete="one-time-code"
						bind:value={inlogcode}
						placeholder="123456"
					/>
				</label>
				<div class="knoprij" style="padding-left: 0">
					<button class="prim" disabled={sync.bezig} onclick={() => sync.controleerCode(inlogcode)}>Inloggen</button>
					<button onclick={() => sync.opnieuw()}>Ander adres</button>
				</div>
			{/if}
		{:else}
			<p class="uitleg">
				Ingelogd als <b>{sync.sessie.email ?? 'onbekend'}</b>. De app werkt gewoon zonder bereik en stuurt vanzelf op
				zodra er weer internet is. Een wedstrijd die je klaarzet gaat mee, dus je stelt thuis op en pakt hem op het veld
				op je telefoon op. Een wedstrijd die al loopt wordt wel opgestuurd, maar nooit overschreven door een ander
				toestel.
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
		{#if sync.message}<p class="uitleg" style="margin-top: 8px">{sync.message}</p>{/if}

		<h2>Overzetten en back-up</h2>
		{#if !sync.sessie}
			<p class="uitleg">
				<b class="mager">Alles staat alleen op dit toestel.</b> Raakt het kwijt of gaat het stuk, dan is je seizoen weg. Maak
				af en toe een back-up, of log hierboven in en het gaat vanzelf.
			</p>
		{/if}
		<p class="uitleg">
			Alles wat de app onthoudt: selectie, standaardopstelling, trainingen en het hele archief. Als bestand om te
			bewaren, of als code om op je andere toestel in te voeren. Een wedstrijd die nu loopt gaat nooit mee.
		</p>
		<div class="knoprij" style="padding-left: 0">
			<button onclick={backupMaken}>Bestand opslaan</button>
			<label class="knop">
				Bestand openen
				<input type="file" accept="application/json,.json" onchange={bestandInlezen} />
			</label>
			<button onclick={codeMaken}>Code maken</button>
			<button
				onclick={() => {
					overzet = 'invoeren';
					backup = 'geen';
					code = '';
				}}>Invoeren</button
			>
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
				<b class="mager">Deze browser mag je gegevens opruimen</b> als hij plaats nodig heeft. Zet de app op je beginscherm
				en log in, of maak af en toe een back-up.
			</p>
		{/if}

		{#if issues.lijst.length}
			<h2>Wat er misging</h2>
			<p class="uitleg">
				De app gaat door als er iets hapert — een volle opslag mag de klok niet stoppen. Maar dan moet je het achteraf
				wel kunnen zien. Dit blijft op je toestel.
			</p>
			<div class="problemen">
				{#each issues.lijst as probleem (probleem.when + probleem.what)}
					<div>
						<b>{new Date(probleem.when).toLocaleString('nl-NL')}</b>
						<span>{probleem.what}</span>
						{#if probleem.message}<code>{probleem.message}</code>{/if}
					</div>
				{/each}
			</div>
			<div class="knoprij" style="padding-left: 0; margin-top: 12px">
				<button class="klein" onclick={clearIssues}>{text.data.clearIssues}</button>
			</div>
		{/if}

		<p class="uitleg" style="margin-top: 24px; font-size: 11px; opacity: 0.75">
			{text.data.footer}
		</p>
	</div>
</main>
