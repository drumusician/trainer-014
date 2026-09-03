<script lang="ts">
	import { page } from '$app/state';

	/* Vier plekken, meer heeft deze app niet nodig. Tijdens een wedstrijd en bij
	   het opstellen is de balk weg: daar telt elke pixel en ben je met één ding
	   bezig. */
	const TABS = [
		{ pad: '/', naam: 'Wedstrijd', icoon: 'bal' },
		{ pad: '/team', naam: 'Team', icoon: 'team' },
		{ pad: '/archief', naam: 'Archief', icoon: 'archief' },
		{ pad: '/meer', naam: 'Meer', icoon: 'meer' }
	];

	function actief(pad: string): boolean {
		const nu = page.url.pathname;
		if (pad === '/') return nu === '/';
		return nu === pad || nu.startsWith(pad + '/');
	}
</script>

<nav class="tabs">
	{#each TABS as tab (tab.pad)}
		<a href={tab.pad} class:aan={actief(tab.pad)} aria-current={actief(tab.pad) ? 'page' : undefined}>
			<svg viewBox="0 0 24 24" aria-hidden="true">
				{#if tab.icoon === 'bal'}
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
					<circle cx="6" cy="12" r="1.4" />
					<circle cx="12" cy="12" r="1.4" />
					<circle cx="18" cy="12" r="1.4" />
				{/if}
			</svg>
			<span>{tab.naam}</span>
		</a>
	{/each}
</nav>
