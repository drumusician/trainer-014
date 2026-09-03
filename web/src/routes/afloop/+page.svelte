<script lang="ts">
	import { goto } from '$app/navigation';
	import Speeltijd from '$lib/componenten/Speeltijd.svelte';
	import Verloop from '$lib/componenten/Verloop.svelte';
	import Verslag from '$lib/componenten/Verslag.svelte';
	import { eindTijd, mmss, speeltijden, stand } from '$lib/domein/tijd';
	import { bronVanWedstrijd } from '$lib/domein/verslag';
	import { app } from '$lib/toestand.svelte';
	import { zetKop } from '$lib/kop.svelte';

	const w = $derived(app.wedstrijd);
	const tijden = $derived(speeltijden(w, app.toestand.spelers, app.nu));

	$effect(() => zetKop('Uitslag', '/', 'Menu'));

	function bewaren() {
		if (app.bewaarInArchief()) goto('/archief');
	}
</script>

<main>
	<div class="pad">
		{#if !w}
			<p class="uitleg">Nog geen wedstrijd.</p>
		{:else}
			{@const [v, t] = stand(w)}
			<h2>Uitslag</h2>
			<p style="font-size: 22px; font-weight: 700; margin: 0 0 4px">
				{w.thuis ? 'O14' : w.tegenstander} {v} – {t} {w.thuis ? w.tegenstander : 'O14'}
			</p>
			<p class="uitleg">{w.datum} · {mmss(eindTijd(w))} gespeeld · {w.formatie}</p>

			<h2>Speeltijd</h2>
			<Speeltijd
				rijen={app.toestand.spelers
					.filter((p) => tijden[p.id] !== undefined)
					.map((p) => ({ naam: p.naam, seconden: tijden[p.id] ?? 0 }))}
			/>

			<h2>Verloop</h2>
			<Verloop gebeurtenissen={w.gebeurtenissen} />

			<h2>Delen</h2>
			<p class="uitleg">Voor de groepsapp. De wissels laat ik er standaard uit.</p>
			<Verslag bron={bronVanWedstrijd(w)} />

			<div class="knoprij" style="padding-left: 0; margin-top: 16px">
				{#if w.bewaard}
					<button disabled>Bewaard in archief</button>
				{:else}
					<button class="prim" onclick={bewaren}>Bewaren in archief</button>
				{/if}
				<a class="knop" href="/">Nieuwe wedstrijd</a>
			</div>
		{/if}
	</div>
</main>
