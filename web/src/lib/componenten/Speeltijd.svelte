<script lang="ts">
	/** Eén tabel voor na afloop, in het archief en bij het seizoen. */
	export interface Regel {
		naam: string;
		seconden: number;
		sub?: string;
	}
	let { rijen }: { rijen: Regel[] } = $props();
	const langst = $derived(Math.max(1, ...rijen.map((r) => r.seconden)));
	const gesorteerd = $derived([...rijen].sort((a, b) => b.seconden - a.seconden));
</script>

<table class="uitslag">
	<tbody>
		{#each gesorteerd as r (r.naam)}
			<tr>
				<td>{r.naam}{#if r.sub}<span class="sub">{r.sub}</span>{/if}</td>
				<td class="balk"><div class="staaf"><i style="width: {Math.round((r.seconden / langst) * 100)}%"></i></div></td>
				<td class="m">{Math.round(r.seconden / 60)} min</td>
			</tr>
		{/each}
	</tbody>
</table>
