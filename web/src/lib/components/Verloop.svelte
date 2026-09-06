<script lang="ts">
	import { timelineRows } from '$lib/domain/report';
	import { mmss } from '$lib/domain/time';
	import { app } from '$lib/store.svelte';
	import type { MatchEvent } from '$lib/domain/types';

	let {
		gebeurtenissen,
		namen,
		delen = 2,
		formatie
	}: {
		gebeurtenissen: MatchEvent[];
		namen?: Record<string, string>;
		delen?: 2 | 4;
		/** om een plek zijn leesbare naam te geven: CVl heet CV, TIEN heet 10 */
		formatie?: string;
	} = $props();

	const regels = $derived(timelineRows(gebeurtenissen, app.toestand.spelers, namen, delen, formatie));
</script>

<ul class="log">
	{#each regels as r (r.index)}
		<li><b>{mmss(r.t)}</b><span>{r.tekst}</span></li>
	{/each}
</ul>
