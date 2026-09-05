<script lang="ts">
	import { onMount } from 'svelte';
	import { bepaalToestel, staatOpBeginscherm, type Toestel } from '$lib/domein/toestel';

	/** Chrome biedt zelf aan om te installeren; die gelegenheid vangen we op. */
	interface InstallVraag extends Event {
		prompt: () => Promise<void>;
	}

	let toestel = $state<Toestel>('desktop');
	let alGeinstalleerd = $state(false);
	let vraag = $state<InstallVraag | null>(null);
	let gekozen = $state<Toestel | null>(null);

	const tonen = $derived(gekozen ?? toestel);

	onMount(() => {
		toestel = bepaalToestel(navigator.userAgent, navigator.maxTouchPoints);
		alGeinstalleerd = staatOpBeginscherm();
		const opvangen = (e: Event) => {
			e.preventDefault();
			vraag = e as InstallVraag;
		};
		window.addEventListener('beforeinstallprompt', opvangen);
		return () => window.removeEventListener('beforeinstallprompt', opvangen);
	});

	async function installeren() {
		if (!vraag) return;
		await vraag.prompt();
		vraag = null;
	}

	const TABS: { code: Toestel; naam: string }[] = [
		{ code: 'ios', naam: 'iPhone of iPad' },
		{ code: 'android', naam: 'Android' },
		{ code: 'desktop', naam: 'Laptop' }
	];
</script>

<h2>Op je beginscherm zetten</h2>

{#if alGeinstalleerd}
	<p>Blaadje staat al op je beginscherm. Dat is precies goed.</p>
{:else}
	<p>
		Blaadje staat niet in de App Store, maar je zet hem er wel gewoon op. Dat is het waard: hij opent dan zonder
		browserbalk, het scherm blijft vanzelf aan zolang de klok loopt, en je gegevens zijn er beter beschermd.
	</p>

	<div class="keuze sorteer" style="margin: 14px 0">
		{#each TABS as tab (tab.code)}
			<button class:aan={tonen === tab.code} onclick={() => (gekozen = tab.code)}>{tab.naam}</button>
		{/each}
	</div>

	{#if tonen === 'ios'}
		<ol class="stappen">
			<li>Open <b>blaadje.app</b> in Safari of Chrome.</li>
			<li>
				Tik op de deelknop: het vierkantje met het pijltje omhoog. In Safari staat die onderin, in Chrome in de
				adresbalk.
			</li>
			<li>Scrol naar <b>Zet op beginscherm</b> en tik op <b>Voeg toe</b>.</li>
		</ol>
	{:else if tonen === 'android'}
		{#if vraag}
			<p>Je browser kan het meteen doen:</p>
			<div class="knoprij" style="padding: 0 0 12px">
				<button class="prim" onclick={installeren}>Op mijn beginscherm zetten</button>
			</div>
		{/if}
		<ol class="stappen">
			<li>Open <b>blaadje.app</b> in Chrome.</li>
			<li>Tik rechtsboven op de drie puntjes.</li>
			<li>Kies <b>App installeren</b> of <b>Toevoegen aan startscherm</b>.</li>
		</ol>
	{:else}
		{#if vraag}
			<div class="knoprij" style="padding: 0 0 12px">
				<button class="prim" onclick={installeren}>Blaadje installeren</button>
			</div>
		{/if}
		<ol class="stappen">
			<li>In Chrome of Edge staat rechts in de adresbalk een installatie-icoon.</li>
			<li>Op een Mac in Safari: <b>Archief</b> → <b>Voeg toe aan Dock</b>.</li>
			<li>Werkt ook prima zonder: op een laptop bereid je vooral voor, en dat gaat net zo goed in een tabblad.</li>
		</ol>
	{/if}

	<p class="klein">
		Wat je al hebt ingevuld blijft staan. Je hoeft Blaadje daarna alleen niet meer op te zoeken.
	</p>
{/if}
