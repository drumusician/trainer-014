<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import Speeltijd from '$lib/componenten/Speeltijd.svelte';
	import Verloop from '$lib/componenten/Verloop.svelte';
	import Verslag from '$lib/componenten/Verslag.svelte';
	import { mmss } from '$lib/domein/tijd';
	import { bronVanArchief } from '$lib/domein/verslag';
	import { app } from '$lib/toestand.svelte';
	import { zetKop } from '$lib/kop.svelte';

	const i = $derived(Number(page.params.i));
	const a = $derived(app.toestand.archief[i]);

	$effect(() => zetKop(a ? a.datum + ' · ' + a.tegenstander : 'Archief', '/instellen', 'Terug'));

	/** De naam van nu, ook als iemand na de wedstrijd hernoemd is. */
	function naamNu(r: { id?: string; naam: string }) {
		return (r.id && app.spelerVan(r.id)?.naam) || r.naam;
	}

	function verwijder() {
		if (!confirm('De wedstrijd tegen ' + a.tegenstander + ' van ' + a.datum + ' uit het archief verwijderen?')) return;
		app.verwijderUitArchief(i);
		goto('/instellen');
	}
</script>

<main>
	<div class="pad">
		{#if !a}
			<p class="uitleg">Deze wedstrijd staat er niet meer.</p>
			<div class="knoprij" style="padding-left: 0"><a class="knop prim" href="/instellen">Terug</a></div>
		{:else}
			{@const thuis = a.thuis !== false}
			<h2>Uitslag</h2>
			<p style="font-size: 22px; font-weight: 700; margin: 0 0 4px">
				{thuis ? 'O14' : a.tegenstander} {a.stand[0]} – {a.stand[1]} {thuis ? a.tegenstander : 'O14'}
			</p>
			<p class="uitleg">{a.datum} · {mmss(a.duur ?? 0)} gespeeld · {a.formatie}</p>

			<h2>Speeltijd</h2>
			<Speeltijd
				rijen={(a.speeltijd ?? []).map((r) => ({
					naam: naamNu(r),
					seconden: r.seconden ?? 0,
					sub: r.keeper ? Math.round(r.keeper / 60) + ' min in het doel' : undefined
				}))}
			/>

			<h2>Verloop</h2>
			<Verloop gebeurtenissen={a.gebeurtenissen ?? []} namen={a.namen} />

			<h2>Delen</h2>
			<Verslag bron={bronVanArchief(a)} />

			<div class="knoprij" style="padding-left: 0; margin-top: 16px">
				<a class="knop prim" href="/instellen">Terug</a>
				<button class="uit" onclick={verwijder}>Verwijderen</button>
			</div>
		{/if}
	</div>
</main>
