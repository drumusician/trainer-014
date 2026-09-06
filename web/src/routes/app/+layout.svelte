<script lang="ts">
	import { onMount } from 'svelte';
	import { afterNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import { app } from '$lib/store.svelte';
	import { sync } from '$lib/supabase/sync.svelte';
	import { loadIssues, issues } from '$lib/issues.svelte';
	import { kop } from '$lib/header.svelte';
	import { vraagBlijvendeOpslag } from '$lib/storage.svelte';
	import Tabs from '$lib/components/Tabs.svelte';

	/* De tabbalk staat er altijd, behalve waar het veld de hoogte nodig heeft.
	   Dat is één regel die je ook ziet: op die schermen is het veld groter. Op
	   het wedstrijdscherm geldt het pas zodra er is afgetrapt; daarvoor is het
	   gewoon een tabblad. */
	/* Hoe vaak je binnen de app genavigeerd hebt. Is dat minstens één keer, dan
	   is "terug" de vorige pagina; anders (diepe link, verse start) valt hij
	   terug op de vaste bestemming van het scherm. */
	let stappen = $state(0);
	afterNavigate((nav) => {
		if (nav.from) stappen++;
	});

	function terug(e: MouseEvent) {
		if (stappen === 0 || !kop.terug || kop.vast) return; /* dan doet de link zelf zijn werk */
		e.preventDefault();
		history.back();
	}

	const inTaak = $derived(
		page.url.pathname.startsWith('/app/opstelling') ||
			(page.url.pathname.startsWith('/app/wedstrijd') && app.kickedOff && !app.wedstrijd?.afgelopen)
	);

	let { children } = $props();

	loadIssues();
	app.load();
	sync.load();
	/* Lokaal is leidend; de server krijgt het zodra er bereik is. */
	app.afterSave = () => sync.merkVies();

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
	<!-- Zwaarder dan een botsing: hier gaat vanaf nu alles verloren. -->
	{#if issues.savingFails}
		<div class="waarschuwing ernstig">
			<span>Opslaan lukt niet. Wat je nu doet is weg zodra je de app sluit — maak ruimte op je toestel.</span>
		</div>
	{/if}
	{#if sync.botsing}
		<div class="waarschuwing">
			<span>Op de server staat iets nieuwers, van een ander toestel.</span>
			<button class="klein" onclick={() => sync.ophalen()}>Ophalen</button>
			<button class="klein" onclick={() => sync.opsturen(true)}>Dit toestel</button>
		</div>
	{/if}
	<header>
		<h1>{kop.titel}</h1>
		{#if kop.score}<span class="stand">{kop.score}</span>{/if}
		{#if kop.terug}
			<a class="knop klein" href={kop.terug} onclick={terug}>{kop.terugTekst}</a>
		{/if}
	</header>
	{@render children()}
	{#if !inTaak}<Tabs />{/if}
</div>
