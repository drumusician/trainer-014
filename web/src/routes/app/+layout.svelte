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
	import { text } from '$lib/text/nl';

	/* The tab bar is always there, except where the pitch needs the height. That
	   is one rule you can also see: on those screens the pitch is bigger. On the
	   match screen it only applies once play has kicked off; before that it is
	   just another tab. */
	/* How often you navigated inside the app. At least once, and "back" is the
	   previous page; otherwise (deep link, fresh start) it falls back to the
	   screen's fixed destination. */
	let stappen = $state(0);
	afterNavigate((nav) => {
		if (nav.from) stappen++;
	});

	function terug(e: MouseEvent) {
		if (stappen === 0 || !kop.terug || kop.vast) return; /* then the link does its own work */
		e.preventDefault();
		history.back();
	}

	const inTaak = $derived(
		page.url.pathname.startsWith('/app/opstelling') ||
			(page.url.pathname.startsWith('/app/wedstrijd') && app.kickedOff && !app.match?.finished)
	);

	let { children } = $props();

	loadIssues();
	app.load();
	sync.load();
	/* Local wins; the server gets it as soon as there is signal. */
	app.afterSave = () => sync.merkVies();

	/* Wie er tikt. De winkel weet niets van inloggen, dus de schil vertelt het.
	   Bij de aftrap wordt dit op de wedstrijd gezet, zodat een tweede trainer ziet
	   dat hij niet ook moet gaan tikken. */
	$effect(() => {
		app.whoIsKeeping = sync.sessie?.email ?? null;
	});

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

		/* One clock for the whole app: screens showing time update by themselves. */
		const tik = setInterval(() => {
			if (app.match?.running) app.nu = Date.now();
		}, 1000);

		/* Het scherm mag niet uitvallen terwijl de klok loopt. */
		const terug = () => {
			if (document.visibilityState !== 'visible') return;
			if (app.match?.running) pakWakeLock();
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
		if (app.match?.running) pakWakeLock();
		else losWakeLock();
	});
</script>

<svelte:head>
	<title>{kop.titel === 'Blaadje' ? 'Blaadje' : kop.titel + ' · Blaadje'}</title>
</svelte:head>

<div class="app" class:zonderbalk={inTaak}>
	<!-- Heavier than a conflict: from here on everything is lost. -->
	{#if issues.savingFails}
		<div class="waarschuwing ernstig">
			<span>{text.shell.savingFails}</span>
		</div>
	{/if}
	{#if sync.botsing}
		<div class="waarschuwing">
			<span>{text.shell.conflict}</span>
			<button class="klein" onclick={() => sync.ophalen()}>{text.shell.conflictPull}</button>
			<button class="klein" onclick={() => sync.opsturen(true)}>{text.shell.conflictPush}</button>
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
