<script lang="ts">
	import { timelineRows } from '$lib/domain/report';
	import { mmss } from '$lib/domain/time';
	import { app } from '$lib/store.svelte';
	import type { MatchEvent } from '$lib/domain/types';

	let {
		events,
		names,
		parts = 2,
		formation
	}: {
		events: MatchEvent[];
		names?: Record<string, string>;
		parts?: 2 | 4;
		/** om een plek zijn leesbare naam te geven: CVl heet CV, TIEN heet 10 */
		formation?: string;
	} = $props();

	const regels = $derived(timelineRows(events, app.toestand.players, names, parts, formation));
</script>

<ul class="log">
	{#each regels as r (r.index)}
		<li><b>{mmss(r.t)}</b><span>{r.tekst}</span></li>
	{/each}
</ul>
