<script lang="ts">
	import { verloopRegels } from '$lib/domein/verslag';
	import { mmss } from '$lib/domein/tijd';
	import { app } from '$lib/toestand.svelte';
	import type { Gebeurtenis } from '$lib/domein/types';

	let {
		gebeurtenissen,
		namen,
		delen = 2,
		formatie
	}: {
		gebeurtenissen: Gebeurtenis[];
		namen?: Record<string, string>;
		delen?: 2 | 4;
		/** om een plek zijn leesbare naam te geven: CVl heet CV, TIEN heet 10 */
		formatie?: string;
	} = $props();
</script>

<ul class="log">
	{#each verloopRegels(gebeurtenissen, app.toestand.spelers, namen, delen, formatie) as r (r.index)}
		<li><b>{mmss(r.t)}</b><span>{r.tekst}</span></li>
	{/each}
</ul>
