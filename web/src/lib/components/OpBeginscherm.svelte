<script lang="ts">
	import { onMount } from 'svelte';
	import { detectDevice, isInstalled, type Device } from '$lib/domain/device';

	/** Chrome offers to install by itself; we catch that opportunity. */
	interface InstallVraag extends Event {
		prompt: () => Promise<void>;
	}

	let toestel = $state<Device>('desktop');
	let alGeinstalleerd = $state(false);
	let vraag = $state<InstallVraag | null>(null);
	let gekozen = $state<Device | null>(null);

	onMount(() => {
		toestel = detectDevice(navigator.userAgent, navigator.maxTouchPoints);
		alGeinstalleerd = isInstalled();
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

	/* Only the two devices you use at the touchline. On a laptop you prepare, and
	   a browser tab does that just as well. */
	const TABS: { code: Device; name: string }[] = [
		{ code: 'ios', name: 'iPhone of iPad' },
		{ code: 'android', name: 'Android' }
	];
	/* If someone is on a laptop we show the iPhone instructions; they are looking
	   these up for their phone anyway. */
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
			<button class:aan={tonen === tab.code} onclick={() => (gekozen = tab.code)}>{tab.name}</button>
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
{/if}

<style>
	/* The numbered steps for putting the app on your home screen. */
	ol.stappen {
		margin: 0 0 14px;
		padding-left: 22px;
		color: var(--grijs);
		max-width: 36em;
	}
	ol.stappen li {
		margin-bottom: 8px;
	}
	ol.stappen b {
		color: var(--inkt);
	}
</style>
