<script lang="ts">
	/* Tijdelijk. Staat er alleen om te zien wat het toestel zelf zegt over de
	   veilige zone onderin; op een schermafdruk was dat niet uit te rekenen. */
	import { onMount } from 'svelte';

	let regels = $state<[string, string][]>([]);

	function meet() {
		const proef = document.createElement('div');
		proef.style.cssText =
			'position:fixed;left:-9999px;bottom:0;height:env(safe-area-inset-bottom);width:1px';
		document.body.appendChild(proef);
		const onder = proef.getBoundingClientRect().height;
		proef.style.height = 'env(safe-area-inset-top)';
		const boven = proef.getBoundingClientRect().height;
		proef.remove();

		const balk = document.querySelector('.tabs') as HTMLElement | null;
		const r = balk?.getBoundingClientRect();
		const vv = window.visualViewport;

		regels = [
			['veilige zone onder', onder + ' px'],
			['veilige zone boven', boven + ' px'],
			['als app op beginscherm', window.matchMedia('(display-mode: standalone)').matches ? 'ja' : 'nee'],
			['navigator.standalone', String((navigator as { standalone?: boolean }).standalone)],
			['innerHeight', window.innerHeight + ' px'],
			['visualViewport hoogte', vv ? Math.round(vv.height) + ' px' : 'onbekend'],
			['visualViewport offsetTop', vv ? Math.round(vv.offsetTop) + ' px' : 'onbekend'],
			['documentElement clientHeight', document.documentElement.clientHeight + ' px'],
			['screen.height', screen.height + ' px'],
			['pixelverhouding', String(devicePixelRatio)],
			['balk hoogte', r ? Math.round(r.height) + ' px' : 'geen balk'],
			['balk onderkant', r ? Math.round(r.bottom) + ' px' : '—'],
			['ruimte onder de balk', r ? Math.round(window.innerHeight - r.bottom) + ' px' : '—'],
			['--balk', getComputedStyle(document.documentElement).getPropertyValue('--balk').trim() || 'leeg']
		];
	}

	onMount(() => {
		meet();
		const opnieuw = () => meet();
		window.visualViewport?.addEventListener('resize', opnieuw);
		window.addEventListener('resize', opnieuw);
		return () => {
			window.visualViewport?.removeEventListener('resize', opnieuw);
			window.removeEventListener('resize', opnieuw);
		};
	});
</script>

<h2>Meting</h2>
<p class="uitleg">Even om te zien wat dit toestel zelf zegt. Verdwijnt weer.</p>
<div class="meting">
	{#each regels as [naam, waarde] (naam)}
		<div><span>{naam}</span><b>{waarde}</b></div>
	{/each}
</div>

<style>
	.meting {
		font-size: 13px;
		border: 1px solid var(--lijn);
		border-radius: 9px;
		overflow: hidden;
	}
	.meting div {
		display: flex;
		justify-content: space-between;
		gap: 10px;
		padding: 6px 10px;
		border-top: 1px solid var(--lijn);
	}
	.meting div:first-child {
		border-top: 0;
	}
	.meting span {
		color: var(--grijs);
	}
	.meting b {
		font-variant-numeric: tabular-nums;
	}
</style>
