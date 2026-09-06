<script lang="ts">
	import { groupOf, canKeep, LINES, LINE_ORDER, positionLine } from '$lib/domain/formations';
	import { thinAttendance, attendanceOf } from '$lib/domain/attendance';
	import { app } from '$lib/store.svelte';
	import type { Line, Player } from '$lib/domain/types';

	let {
		bench,
		formation,
		gekozen = null,
		tijden = null,
		leegtekst = 'Iedereen speelt.',
		ontik
	}: {
		bench: string[];
		formation: string;
		gekozen?: string | null;
		/** speelminuten per speler; weglaten in het opstelscherm */
		tijden?: Record<string, number> | null;
		leegtekst?: string;
		ontik: (spelerId: string) => void;
	} = $props();

	const players = $derived(bench.map((id) => app.playerById(id)).filter(Boolean) as Player[]);
	const doelLinie = $derived(gekozen ? positionLine(gekozen, formation) : null);

	function pastBij(p: Player): boolean {
		if (!doelLinie) return false;
		return doelLinie === 'K' ? canKeep(p) : p.line === doelLinie;
	}

	function groep(code: Line): Player[] {
		return players
			.filter((p) => groupOf(p) === code)
			.sort((a, b) => (tijden ? (tijden[a.id] ?? 0) - (tijden[b.id] ?? 0) : a.name.localeCompare(b.name)));
	}
</script>

<div class="banknaast">
	<div class="bankkop">Bank</div>
	<div class="groepen">
		{#if !players.length}
			<p class="uitleg" style="margin: 0; font-size: 13px">{leegtekst}</p>
		{/if}
		{#each LINE_ORDER as code (code)}
			{@const groepje = groep(code)}
			{#if groepje.length}
				<div class="groepkop" class:past={gekozen && groepje.some(pastBij)}>
					<b>{LINES[code]}</b><span>{groepje.length}</span>
				</div>
				<div class="rij">
					{#each groepje as p (p.id)}
						{@const recent = attendanceOf(app.toestand.trainings, p.id, 4)}
						<button
							type="button"
							class="chip"
							class:doel={gekozen && pastBij(p)}
							class:andere={gekozen && !pastBij(p)}
							onclick={() => ontik(p.id)}
						>
							<span>{p.name}</span>
							{#if tijden}
								<span class="min">{Math.round((tijden[p.id] ?? 0) / 60)}′</span>
							{:else if thinAttendance(recent)}
								<span class="min mager">{recent.er}/{recent.totaal}</span>
							{/if}
						</button>
					{/each}
				</div>
			{/if}
		{/each}
	</div>
</div>
