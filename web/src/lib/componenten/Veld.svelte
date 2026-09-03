<script lang="ts">
	import { plekken } from '$lib/domein/formaties';
	import { app } from '$lib/toestand.svelte';
	import type { Opstelling } from '$lib/domein/types';

	let {
		formatie,
		opstelling,
		gekozen = null,
		tijden = null,
		onplek
	}: {
		formatie: string;
		opstelling: Opstelling;
		gekozen?: string | null;
		/** speelminuten per speler; tijdens een wedstrijd staan die onder de naam */
		tijden?: Record<string, number> | null;
		onplek?: (plekId: string) => void;
	} = $props();
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

	{#each plekken(formatie) as [plekId, label, x, y] (plekId)}
		{@const p = app.spelerVan(opstelling[plekId])}
		<div
			class="plek"
			class:leeg={!p}
			class:gekozen={gekozen === plekId}
			style="left: {x}%; top: {y}%"
			role="button"
			tabindex="0"
			onclick={() => onplek?.(plekId)}
			onkeydown={(e) => e.key === 'Enter' && onplek?.(plekId)}
		>
			<div class="bol">{p ? p.naam : '+'}</div>
			<div class="pos">
				{label}{#if p && tijden}<span class="min">{Math.round((tijden[p.id] ?? 0) / 60)}′</span>{/if}
			</div>
		</div>
	{/each}
</div>
