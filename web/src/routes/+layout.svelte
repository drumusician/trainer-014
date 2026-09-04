<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { app } from '$lib/toestand.svelte';
	import { sync } from '$lib/supabase/sync.svelte';
	import { kop } from '$lib/kop.svelte';
	import { vraagBlijvendeOpslag } from '$lib/opslag.svelte';
	import Tabs from '$lib/componenten/Tabs.svelte';

	/* Schermen waar je met één ding bezig bent: daar gaat de balk weg. */
	const VOLLEDIG = ['/wedstrijd', '/opstelling', '/aanwezig', '/afloop'];
	const inTaak = $derived(VOLLEDIG.some((p) => page.url.pathname.startsWith(p)));

	let { children } = $props();

	app.laad();
	sync.laad();
	/* Lokaal is leidend; de server krijgt het zodra er bereik is. */
	app.naBewaren = () => sync.merkVies();

	let wakeLock: WakeLockSentinel | null = null;

	async function pakWakeLock() {
		if (!('wakeLock' in navigator)) return;
		try {
			wakeLock = await navigator.wakeLock.request('screen');
		} catch {
			wakeLock = null;
		}
	}

	function losWakeLock() {
		try {
			wakeLock?.release();
		} catch {
			/* stil */
		}
		wakeLock = null;
	}

	onMount(() => {
		sync.pakInlogUitLink();
		window.addEventListener('hashchange', () => sync.pakInlogUitLink());
		sync.kijkEven();
		vraagBlijvendeOpslag();
		const weerOnline = () => sync.duwAlsNodig();
		window.addEventListener('online', weerOnline);

		/* Eén klok voor de hele app: schermen die tijd tonen werken vanzelf bij. */
		const tik = setInterval(() => {
			if (app.wedstrijd?.loopt) app.nu = Date.now();
		}, 1000);

		/* Het scherm mag niet uitvallen terwijl de klok loopt. */
		const terug = () => {
			if (document.visibilityState !== 'visible') return;
			if (app.wedstrijd?.loopt) pakWakeLock();
			sync.kijkEven();
		};
		document.addEventListener('visibilitychange', terug);

		return () => {
			clearInterval(tik);
			document.removeEventListener('visibilitychange', terug);
			window.removeEventListener('online', weerOnline);
			losWakeLock();
		};
	});

	$effect(() => {
		if (app.wedstrijd?.loopt) pakWakeLock();
		else losWakeLock();
	});
</script>

<svelte:head>
	<title>{kop.titel === 'Blaadje' ? 'Blaadje' : kop.titel + ' · Blaadje'}</title>
</svelte:head>

<div class="app" class:zonderbalk={inTaak}>
	{#if sync.botsing}
		<div class="waarschuwing">
			<span>Op de server staat iets nieuwers, van een ander toestel.</span>
			<button class="klein" onclick={() => sync.ophalen()}>Ophalen</button>
			<button class="klein" onclick={() => sync.opsturen(true)}>Dit toestel</button>
		</div>
	{/if}
	<header>
		<h1>{kop.titel}</h1>
		{#if kop.stand}<span class="stand">{kop.stand}</span>{/if}
		{#if kop.terug}<a class="knop klein" href={kop.terug}>{kop.terugTekst}</a>{/if}
	</header>
	{@render children()}
	{#if !inTaak}<Tabs />{/if}
</div>
