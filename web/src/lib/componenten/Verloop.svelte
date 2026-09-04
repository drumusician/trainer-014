<script lang="ts">
	import { gebeurtenisTekst } from '$lib/domein/verslag';
	import { mmss } from '$lib/domein/tijd';
	import { app } from '$lib/toestand.svelte';
	import type { Gebeurtenis } from '$lib/domein/types';

	let {
		gebeurtenissen,
		namen,
		delen = 2
	}: { gebeurtenissen: Gebeurtenis[]; namen?: Record<string, string>; delen?: 2 | 4 } = $props();
</script>

<ul class="log">
	{#each gebeurtenissen as g, i (i)}
		<li><b>{mmss(g.t)}</b><span>{gebeurtenisTekst(g, app.toestand.spelers, namen, delen)}</span></li>
	{/each}
</ul>
