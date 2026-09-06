<script lang="ts">
	import { positionsOf } from '$lib/domain/formations';
	import { app } from '$lib/store.svelte';
	import type { Lineup } from '$lib/domain/types';

	let {
		formation,
		lineup,
		gekozen = null,
		tijden = null,
		onplek
	}: {
		formation: string;
		lineup: Lineup;
		gekozen?: string | null;
		/** minutes played per player; during a match these sit under the name */
		tijden?: Record<string, number> | null;
		onplek?: (plekId: string) => void;
	} = $props();

	/* Derived rather than called in the template: otherwise it recalculates on
	   every render, which during a match means every second. */
	const vakken = $derived(positionsOf(formation));
</script>

<div class="veld">
	<svg class="strepen" viewBox="0 0 300 400" preserveAspectRatio="none">
		<g fill="none" stroke="rgba(255,255,255,.35)" stroke-width="2">
			<rect x="8" y="8" width="284" height="384" />
			<line x1="8" y1="200" x2="292" y2="200" />
			<circle cx="150" cy="200" r="46" />
			<rect x="72" y="8" width="156" height="58" />
			<rect x="72" y="334" width="156" height="58" />
			<rect x="115" y="8" width="70" height="22" />
			<rect x="115" y="370" width="70" height="22" />
		</g>
	</svg>

	{#each vakken as [plekId, label, x, y] (plekId)}
		{@const p = app.playerById(lineup[plekId])}
		<!-- A real button, not a div pretending to be one: space bar, focus and screen
		     reader are then correct straight away, and it saves hand-written code. -->
		<button
			type="button"
			class="plek"
			class:leeg={!p}
			class:gekozen={gekozen === plekId}
			style="left: {x}%; top: {y}%"
			aria-label="{label}{p ? ': ' + p.name : ': leeg'}"
			onclick={() => onplek?.(plekId)}
		>
			<span class="bol">{p ? p.name : '+'}</span>
			<span class="pos">
				{label}{#if p && tijden}<span class="min">{Math.round((tijden[p.id] ?? 0) / 60)}′</span>{/if}
			</span>
		</button>
	{/each}
</div>
