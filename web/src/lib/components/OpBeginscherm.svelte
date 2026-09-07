<script lang="ts">
	import { onMount } from 'svelte';
	import { text } from '$lib/text/nl';
	import { detectDevice, isInstalled, type Device } from '$lib/domain/device';

	/** Chrome offers to install by itself; we catch that opportunity. */
	interface InstallVraag extends Event {
		prompt: () => Promise<void>;
	}

	let toestel = $state<Device>('desktop');
	let alGeinstalleerd = $state(false);
	/* Staat er hier al een seizoen? Dan moet dat mee, want de app op het
	   beginscherm begint met een lege opslag. */
	let alGegevens = $state(false);
	let vraag = $state<InstallVraag | null>(null);
	let gekozen = $state<Device | null>(null);

	onMount(() => {
		toestel = detectDevice(navigator.userAgent, navigator.maxTouchPoints);
		alGeinstalleerd = isInstalled();
		try {
			alGegevens = !!localStorage.getItem('o14-app-v1');
		} catch {
			alGegevens = false;
		}
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
		{ code: 'ios', name: text.install.deviceIos },
		{ code: 'android', name: text.install.deviceAndroid }
	];
	/* If someone is on a laptop we show the iPhone instructions; they are looking
	   these up for their phone anyway. */
	const tonen = $derived(gekozen ?? (toestel === 'desktop' ? 'ios' : toestel));
</script>

<h2>{text.install.heading}</h2>

{#if alGeinstalleerd}
	<p>{text.install.already}</p>
{:else}
	<p>{text.install.intro}</p>

	{#if alGegevens}
		<!-- Wie hier al werkt vindt straks een lege app, en denkt dat hij alles kwijt
		     is. Dat is precies het moment waarop iemand stopt met de app. -->
		<p><b class="mager">{text.install.movePrompt}</b></p>
	{/if}

	<div class="keuze sorteer" style="margin: 14px 0">
		{#each TABS as tab (tab.code)}
			<button class:aan={tonen === tab.code} onclick={() => (gekozen = tab.code)}>{tab.name}</button>
		{/each}
	</div>

	{#if tonen === 'ios'}
		<ol class="stappen">
			<li>{text.install.iosStep1.before} <b>{text.install.iosStep1.bold}</b> {text.install.iosStep1.after}</li>
			<li>{text.install.iosStep2}</li>
			<li>
				{text.install.iosStep3.before} <b>{text.install.iosStep3.bold}</b>
				{text.install.iosStep3.middle}
				<b>{text.install.iosStep3.bold2}</b>{text.install.iosStep3.after}
			</li>
		</ol>
	{:else if tonen === 'android'}
		{#if vraag}
			<p>{text.install.androidOffer}</p>
			<div class="knoprij" style="padding: 0 0 12px">
				<button class="prim" onclick={installeren}>{text.install.androidButton}</button>
			</div>
		{/if}
		<ol class="stappen">
			<li>
				{text.install.androidStep1.before} <b>{text.install.androidStep1.bold}</b>
				{text.install.androidStep1.after}
			</li>
			<li>{text.install.androidStep2}</li>
			<li>
				{text.install.androidStep3.before} <b>{text.install.androidStep3.bold}</b>
				{text.install.androidStep3.middle}
				<b>{text.install.androidStep3.bold2}</b>{text.install.androidStep3.after}
			</li>
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
