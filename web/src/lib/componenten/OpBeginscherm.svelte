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

	/* Alleen de twee toestellen waar je hem langs de lijn op gebruikt. Op een
	   laptop bereid je voor, en dat gaat in een tabblad net zo goed. */
	const TABS: { code: Toestel; naam: string }[] = [
		{ code: 'ios', naam: 'iPhone of iPad' },
		{ code: 'android', naam: 'Android' }
	];
	/* Zit iemand op een laptop, dan tonen we de iPhone-uitleg; die zoekt hij hier
	   toch voor zijn telefoon op. */
	const tonen = $derived(gekozen ?? (toestel === 'desktop' ? 'ios' : toestel));
</script>

<h2>Op je beginscherm zetten</h2>

{#if alGeinstalleerd}
	<p>Blaadje staat al op je beginscherm. Dat is precies goed.</p>
{:else}
	<p>
		Blaadje is een website, geen download uit de App Store. Zet hem op je beginscherm en hij werkt als een gewone app:
		geen browserbalk meer, en het scherm blijft aan zolang de klok loopt.
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
	{/if}

	<p class="klein">Je begint niet opnieuw: je selectie en je wedstrijden staan er straks gewoon nog.</p>
{/if}
