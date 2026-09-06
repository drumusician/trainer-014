<script lang="ts">
	/** Eén tabel voor na afloop, in het archief en bij het seizoen. */
	export interface Regel {
		name: string;
		seconds: number;
		sub?: string;
	}
	let { rijen }: { rijen: Regel[] } = $props();
	const langst = $derived(Math.max(1, ...rijen.map((r) => r.seconds)));
	const gesorteerd = $derived([...rijen].sort((a, b) => b.seconds - a.seconds));
</script>

<table class="uitslag">
	<tbody>
		{#each gesorteerd as r (r.name)}
			<tr>
				<td
					>{r.name}{#if r.sub}<span class="sub">{r.sub}</span>{/if}</td
				>
				<td class="balk"><div class="staaf"><i style="width: {Math.round((r.seconds / langst) * 100)}%"></i></div></td>
				<td class="m">{Math.round(r.seconds / 60)} min</td>
			</tr>
		{/each}
	</tbody>
</table>
