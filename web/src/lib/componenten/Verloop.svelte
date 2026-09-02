<script lang="ts">
	import { gebeurtenisTekst } from '$lib/domein/verslag';
	import { mmss } from '$lib/domein/tijd';
	import { app } from '$lib/toestand.svelte';
	import type { Gebeurtenis } from '$lib/domein/types';

	let { gebeurtenissen, namen }: { gebeurtenissen: Gebeurtenis[]; namen?: Record<string, string> } = $props();
</script>

<ul class="log">
	{#each gebeurtenissen as g, i (i)}
		<li><b>{mmss(g.t)}</b><span>{gebeurtenisTekst(g, app.toestand.spelers, namen)}</span></li>
	{/each}
</ul>
