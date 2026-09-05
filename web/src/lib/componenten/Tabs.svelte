<script lang="ts">
	import { page } from '$app/state';

	/* Vier plekken, meer heeft deze app niet nodig. Tijdens een wedstrijd en bij
	   het opstellen is de balk weg: daar telt elke pixel en ben je met één ding
	   bezig. */
	/* Vijf plekken, gekozen op hoe vaak je er bent: zaterdag de wedstrijd, twee
	   keer per week de training, af en toe de rest. Wat verder weg ligt staat op
	   het beginscherm als kaart. */
	/* Vier plekken, elk een eigen onderwerp. De wedstrijd die nu loopt en de
	   wedstrijden die je gespeeld hebt horen bij elkaar, dus die staan samen. */
	const TABS = [
		{ pad: '/app', naam: 'Wedstrijden', icoon: 'bal' },
		{ pad: '/app/trainingen', naam: 'Training', icoon: 'fluit' },
		{ pad: '/app/team', naam: 'Team', icoon: 'team' },
		{ pad: '/app/meer', naam: 'Gegevens', icoon: 'gegevens' }
	];

	/* Alles wat met een wedstrijd te maken heeft telt mee voor het eerste tabblad. */
	const BIJ_WEDSTRIJDEN = ['/app/wedstrijd', '/app/archief', '/app/afloop', '/app/aanwezig', '/app/opstelling'];

	/* De echte hoogte van de balk doorgeven, inclusief de veilige zone eronder.
	   Schatten gaat mis op toestellen die ik niet in handen heb. */
	let hoogte = $state(0);
	$effect(() => {
		document.documentElement.style.setProperty('--balk', hoogte + 'px');
		return () => document.documentElement.style.removeProperty('--balk');
	});

	function actief(pad: string): boolean {
		const nu = page.url.pathname.replace(/\/$/, '') || '/app';
		if (pad === '/app') return nu === '/app' || BIJ_WEDSTRIJDEN.some((p) => nu.startsWith(p));
		return nu === pad || nu.startsWith(pad + '/');
	}
</script>

<nav class="tabs" bind:clientHeight={hoogte}>
	{#each TABS as tab (tab.pad)}
		<a href={tab.pad} class:aan={actief(tab.pad)} aria-current={actief(tab.pad) ? 'page' : undefined}>
			<svg viewBox="0 0 24 24" aria-hidden="true">
				{#if tab.icoon === 'start'}
					<path d="M4 11.2L12 4.5l8 6.7" />
					<path d="M6 10.4V19h12v-8.6" />
				{:else if tab.icoon === 'fluit'}
					<circle cx="9.5" cy="13" r="4.5" />
					<path d="M14 13h6.5M14 10.4h4.5" />
					<path d="M9.5 8.5V5.5h4" />
				{:else if tab.icoon === 'bal'}
					<!-- een veldje: dat is waar dit tabblad over gaat -->
					<rect x="3.5" y="4.5" width="17" height="15" rx="1.6" />
					<path d="M3.5 12h17" />
					<circle cx="12" cy="12" r="2.6" />
					<path d="M8 4.5v2.6h8V4.5M8 19.5v-2.6h8v2.6" />
				{:else if tab.icoon === 'team'}
					<circle cx="9" cy="9" r="3.2" />
					<circle cx="17" cy="10" r="2.4" />
					<path d="M3.5 18.5c0-3 2.5-4.6 5.5-4.6s5.5 1.6 5.5 4.6" />
					<path d="M16 14.2c2.5.2 4.5 1.6 4.5 4.3" />
				{:else if tab.icoon === 'archief'}
					<rect x="4" y="4.5" width="16" height="15" rx="2" />
					<path d="M8 9h8M8 12.5h8M8 16h4" />
				{:else}
					<!-- een schijf met een pijl omhoog: bewaren en versturen -->
					<ellipse cx="12" cy="6.8" rx="6.8" ry="2.6" />
					<path d="M5.2 6.8v5.4c0 1.4 3 2.6 6.8 2.6" />
					<path d="M18.8 6.8v4.2" />
					<path d="M15.6 18.2h5.2M18.2 15.6v5.2" />
				{/if}
			</svg>
			<span>{tab.naam}</span>
		</a>
	{/each}
</nav>
