<script lang="ts">
	import { groepVan, kanKeepen, LINIES, LINIEVOLGORDE, plekLinie } from '$lib/domein/formaties';
	import { mager, presentie } from '$lib/domein/presentie';
	import { app } from '$lib/toestand.svelte';
	import type { Linie, Speler } from '$lib/domein/types';

	let {
		bank,
		formatie,
		gekozen = null,
		tijden = null,
		leegtekst = 'Iedereen speelt.',
		ontik
	}: {
		bank: string[];
		formatie: string;
		gekozen?: string | null;
		/** speelminuten per speler; weglaten in het opstelscherm */
		tijden?: Record<string, number> | null;
		leegtekst?: string;
		ontik: (spelerId: string) => void;
	} = $props();

	const spelers = $derived(bank.map((id) => app.spelerVan(id)).filter(Boolean) as Speler[]);
	const doelLinie = $derived(gekozen ? plekLinie(gekozen, formatie) : null);

	function pastBij(p: Speler): boolean {
		if (!doelLinie) return false;
		return doelLinie === 'K' ? kanKeepen(p) : p.linie === doelLinie;
	}

	function groep(code: Linie): Speler[] {
		return spelers
			.filter((p) => groepVan(p) === code)
			.sort((a, b) => (tijden ? (tijden[a.id] ?? 0) - (tijden[b.id] ?? 0) : a.naam.localeCompare(b.naam)));
	}
</script>

<div class="banknaast">
	<div class="bankkop">Bank</div>
	<div class="groepen">
		{#if !spelers.length}
			<p class="uitleg" style="margin: 0; font-size: 13px">{leegtekst}</p>
		{/if}
		{#each LINIEVOLGORDE as code (code)}
			{@const groepje = groep(code)}
			{#if groepje.length}
				<div class="groepkop" class:past={gekozen && groepje.some(pastBij)}>
					<b>{LINIES[code]}</b><span>{groepje.length}</span>
				</div>
				<div class="rij">
					{#each groepje as p (p.id)}
						{@const recent = presentie(app.toestand.trainingen, p.id, 4)}
						<div
							class="chip"
							class:doel={gekozen && pastBij(p)}
							class:andere={gekozen && !pastBij(p)}
							role="button"
							tabindex="0"
							onclick={() => ontik(p.id)}
							onkeydown={(e) => e.key === 'Enter' && ontik(p.id)}
						>
							<span>{p.naam}</span>
							{#if tijden}
								<span class="min">{Math.round((tijden[p.id] ?? 0) / 60)}′</span>
							{:else if mager(recent)}
								<span class="min mager">{recent.er}/{recent.totaal}</span>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		{/each}
	</div>
</div>
