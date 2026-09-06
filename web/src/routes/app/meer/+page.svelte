<script lang="ts">
	import { backupName, readBackup, makeBackup } from '$lib/domain/backup';
	import { describePackage, readTransferCode, makeTransferCode } from '$lib/domain/transfer';
	import { app } from '$lib/store.svelte';
	import { sync } from '$lib/supabase/sync.svelte';
	import { zetKop } from '$lib/header.svelte';
	import { opslagstand } from '$lib/storage.svelte';
	import { issues, clearIssues } from '$lib/issues.svelte';
	import { text } from '$lib/text/nl';

	$effect(() => zetKop(text.data.title));

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
		<h2>{text.data.syncHeading}</h2>
		{#if !sync.sessie}
			<p class="uitleg">
				{text.data.signInHint}
			</p>
			{#if opLokaal}
				<p class="uitleg">
					<b class="mager">{text.data.localWarningLead}</b>
					{text.data.localWarning(location.host)}
				</p>
			{/if}
			{#if sync.fase === 'email'}
				<label class="vak">
					{text.data.emailLabel}
					<input
						type="email"
						inputmode="email"
						autocomplete="email"
						bind:value={sync.email}
						placeholder={text.data.emailPlaceholder}
					/>
				</label>
				<div class="knoprij" style="padding-left: 0">
					<button class="prim" disabled={sync.bezig} onclick={() => sync.stuurCode(sync.email)}
						>{text.data.sendCode}</button
					>
				</div>
			{:else}
				<p class="uitleg">
					{text.data.codeHintBefore} <b>{text.data.codeHintWord}</b>
					{text.data.codeHintMiddle} <b>{text.data.codeHintLinkWord}</b>
					{text.data.codeHintAfter}
				</p>
				<label class="vak">
					{text.data.codeLabel}
					<input
						type="text"
						inputmode="numeric"
						autocomplete="one-time-code"
						bind:value={inlogcode}
						placeholder={text.data.codePlaceholder}
					/>
				</label>
				<div class="knoprij" style="padding-left: 0">
					<button class="prim" disabled={sync.bezig} onclick={() => sync.controleerCode(inlogcode)}
						>{text.data.signIn}</button
					>
					<button onclick={() => sync.opnieuw()}>{text.data.otherAddress}</button>
				</div>
			{/if}
		{:else}
			<p class="uitleg">
				{text.data.signedInAs} <b>{sync.sessie.email ?? text.data.unknownEmail}</b>. {text.data.signedInHint}
			</p>
			<p class="uitleg">
				<b>
					{#if sync.botsing}
						{text.data.statusConflict}
					{:else if sync.vies && sync.hapert}
						{text.data.statusOffline}
					{:else if sync.vies}
						{text.data.statusPending}
					{:else if sync.sessie.laatst}
						{text.data.statusUpdated(new Date(sync.sessie.laatst).toLocaleString('nl-NL'))}
					{:else}
						{text.data.statusNever}
					{/if}
				</b>
			</p>
			<div class="knoprij" style="padding-left: 0">
				<button class="prim" disabled={sync.bezig} onclick={() => sync.opsturen()}>{text.data.pushNow}</button>
				<button disabled={sync.bezig} onclick={() => sync.ophalen()}>{text.data.pull}</button>
				<button onclick={() => sync.uitloggen()}>{text.data.signOut}</button>
			</div>
			{#if sync.botsingOpen}
				<div class="knoprij" style="padding-left: 0">
					<button class="uit" onclick={() => sync.opsturen(true)}>{text.data.forcePush}</button>
				</div>
			{/if}
		{/if}
		{#if sync.message}<p class="uitleg" style="margin-top: 8px">{sync.message}</p>{/if}

		<h2>{text.data.transferHeading}</h2>
		{#if !sync.sessie}
			<p class="uitleg">
				<b class="mager">{text.data.onlyHereLead}</b>
				{text.data.onlyHere}
			</p>
		{/if}
		<p class="uitleg">
			{text.data.transferHint}
		</p>
		<div class="knoprij" style="padding-left: 0">
			<button onclick={backupMaken}>{text.data.saveFile}</button>
			<label class="knop">
				{text.data.openFile}
				<input type="file" accept="application/json,.json" onchange={bestandInlezen} />
			</label>
			<button onclick={codeMaken}>{text.data.makeCode}</button>
			<button
				onclick={() => {
					overzet = 'invoeren';
					backup = 'geen';
					code = '';
				}}>{text.data.enter}</button
			>
		</div>
		{#if backup === 'maken'}
			<p class="uitleg" style="margin-top: 12px">{text.data.savedAndCopied}</p>
			<textarea readonly value={backuptekst} style="min-height: 120px"></textarea>
		{:else if overzet === 'maken'}
			<p class="uitleg" style="margin-top: 12px">
				{text.data.copiedBefore} <b>{text.data.enter}</b>{text.data.copiedAfter}
			</p>
			<textarea readonly value={code}></textarea>
		{:else if overzet === 'invoeren'}
			<p class="uitleg" style="margin-top: 12px">{text.data.pasteHint}</p>
			<textarea bind:value={code} placeholder={text.data.pastePlaceholder} style="min-height: 120px"></textarea>
			<div class="knoprij" style="padding-left: 0; margin-top: 10px">
				<button class="prim" onclick={overnemen}>{text.data.adopt}</button>
			</div>
		{/if}

		{#if opslagstand.ondersteund && opslagstand.blijvend === false}
			<p class="uitleg" style="margin-top: 12px">
				<b class="mager">{text.data.mayCleanLead}</b>
				{text.data.mayClean}
			</p>
		{/if}

		{#if issues.lijst.length}
			<h2>{text.data.issuesHeading}</h2>
			<p class="uitleg">
				{text.data.issuesHint}
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
