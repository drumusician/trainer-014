<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { app } from '$lib/toestand.svelte';
	import { sync } from '$lib/supabase/sync.svelte';
	import { kop } from '$lib/kop.svelte';

	let { children } = $props();

	app.laad();
	sync.laad();

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

		/* Eén klok voor de hele app: schermen die tijd tonen werken vanzelf bij. */
		const tik = setInterval(() => {
			if (app.wedstrijd?.loopt) app.nu = Date.now();
		}, 1000);

		/* Het scherm mag niet uitvallen terwijl de klok loopt. */
		const terug = () => {
			if (document.visibilityState === 'visible' && app.wedstrijd?.loopt) pakWakeLock();
		};
		document.addEventListener('visibilitychange', terug);

		return () => {
			clearInterval(tik);
			document.removeEventListener('visibilitychange', terug);
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

<div class="app">
	<header>
		<h1>{kop.titel}</h1>
		{#if kop.stand}<span class="stand">{kop.stand}</span>{/if}
		<a class="knop klein" href={kop.terug}>{kop.terugTekst}</a>
	</header>
	{@render children()}
</div>
