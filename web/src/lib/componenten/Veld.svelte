<script lang="ts">
	import { positionsOf } from '$lib/domein/formaties';
	import { app } from '$lib/toestand.svelte';
	import type { Lineup } from '$lib/domein/types';

	let {
		formatie,
		opstelling,
		gekozen = null,
		tijden = null,
		onplek
	}: {
		formatie: string;
		opstelling: Lineup;
		gekozen?: string | null;
		/** speelminuten per speler; tijdens een wedstrijd staan die onder de naam */
		tijden?: Record<string, number> | null;
		onplek?: (plekId: string) => void;
	} = $props();

	/* Afgeleid in plaats van in de template aangeroepen: anders rekent hij bij
	   elke render opnieuw, en tijdens een wedstrijd is dat elke seconde. */
	const vakken = $derived(positionsOf(formatie));
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
		{@const p = app.playerById(opstelling[plekId])}
		<!-- Een echte knop, geen div die zich als knop voordoet: spatiebalk, focus en
		     schermlezer zijn dan meteen goed en het scheelt handwerk. -->
		<button
			type="button"
			class="plek"
			class:leeg={!p}
			class:gekozen={gekozen === plekId}
			style="left: {x}%; top: {y}%"
			aria-label="{label}{p ? ': ' + p.naam : ': leeg'}"
			onclick={() => onplek?.(plekId)}
		>
			<span class="bol">{p ? p.naam : '+'}</span>
			<span class="pos">
				{label}{#if p && tijden}<span class="min">{Math.round((tijden[p.id] ?? 0) / 60)}′</span>{/if}
			</span>
		</button>
	{/each}
</div>
