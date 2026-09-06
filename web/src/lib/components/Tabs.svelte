<script lang="ts">
	import { page } from '$app/state';
	import { text } from '$lib/text/nl';

	/* Four places; this app needs no more. During a match and while picking a
	   lineup the bar is gone: there every pixel counts and you are doing one
	   thing. */
	/* Five places, chosen by how often you are there: the match on Saturday,
	   training twice a week, the rest now and then. What lies further away sits on
	   the start screen as a card. */
	/* Four places, each its own subject. The match running now and the matches you
	   have played belong together, so they sit together. */
	const TABS = [
		{ pad: '/app', name: text.shell.tabs.matches, icoon: 'bal' },
		{ pad: '/app/trainingen', name: text.shell.tabs.training, icoon: 'fluit' },
		{ pad: '/app/team', name: text.shell.tabs.team, icoon: 'team' },
		{ pad: '/app/meer', name: text.shell.tabs.data, icoon: 'gegevens' }
	];

	/* Anything to do with a match counts towards the first tab. */
	const BIJ_WEDSTRIJDEN = ['/app/wedstrijd', '/app/archief', '/app/afloop', '/app/aanwezig', '/app/opstelling'];

	/* Pass on the real height of the bar, safe area below it included. Guessing
	   goes wrong on devices I do not have in my hands. */
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
					<!-- a little pitch: that is what this tab is about -->
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
					<!-- a disk with an arrow up: saving and sending -->
					<ellipse cx="12" cy="6.8" rx="6.8" ry="2.6" />
					<path d="M5.2 6.8v5.4c0 1.4 3 2.6 6.8 2.6" />
					<path d="M18.8 6.8v4.2" />
					<path d="M15.6 18.2h5.2M18.2 15.6v5.2" />
				{/if}
			</svg>
			<span>{tab.name}</span>
		</a>
	{/each}
</nav>

<style>
	/* The bar itself. The space the bar claims does live in app.css, because that
	   is padding on main, which sits outside this component. */
	/* Pinned to the bottom of the screen, whatever the browser thinks of the page
	   height. The space below it belongs to the home indicator; it must stay empty
	   but does take the bar's background. */
	.tabs {
		position: fixed;
		bottom: 0;
		left: 50%;
		transform: translateX(-50%);
		width: 100%;
		max-width: 900px;
		z-index: 5;
		display: flex;
		border-top: 1px solid var(--lijn);
		/* Translucent with a blur behind it, the way iOS does it. Below the labels
		   lies the home indicator strip, which we cannot use: that is the device's
		   swipe area. White on white made that strip read as empty app space. This
		   way you see the page slide underneath and it reads as one bar. */
		background: rgba(255, 255, 255, 0.82);
		backdrop-filter: saturate(180%) blur(16px);
		-webkit-backdrop-filter: saturate(180%) blur(16px);
		padding-bottom: env(safe-area-inset-bottom);
	}
	/* If the device cannot blur, opaque beats murky. */
	@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
		.tabs {
			background: #fff;
		}
	}
	.tabs a {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
		padding: 6px 2px 4px;
		text-decoration: none;
		color: var(--grijs);
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.01em;
	}
	.tabs a span {
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.tabs a svg {
		width: 23px;
		height: 23px;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.6;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.tabs a.aan {
		color: var(--groen);
	}
	.tabs a.aan svg {
		stroke-width: 2;
	}
	.tabs a:active {
		background: var(--groen-licht);
	}
</style>
