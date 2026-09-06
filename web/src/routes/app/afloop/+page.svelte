<script lang="ts">
	import { goto } from '$app/navigation';
	import Speeltijd from '$lib/components/Speeltijd.svelte';
	import Verloop from '$lib/components/Verloop.svelte';
	import Verslag from '$lib/components/Verslag.svelte';
	import { endTime, mmss, positionText, positionTimes, playingTimes, score } from '$lib/domain/time';
	import { bronVanWedstrijd } from '$lib/domain/report';
	import { app } from '$lib/store.svelte';
	import { zetKop } from '$lib/header.svelte';
	import { datumMetJaar } from '$lib/domain/dates';

	const w = $derived(app.match);
	const tijden = $derived(playingTimes(w, app.toestand.players, app.nu));
	const positions = $derived(positionTimes(w, app.nu));

	/* Not a back button but an exit: walking back into the finished match screen
	   helps nobody. */
	$effect(() => zetKop('Uitslag', '/app', 'Naar start', null, true));

	function bewaren() {
		if (app.archiveMatch()) goto('/app');
	}
</script>

<main>
	<div class="pad">
		{#if !w}
			<p class="uitleg">Nog geen wedstrijd.</p>
		{:else}
			{@const [v, t] = score(w)}
			<h2>Uitslag</h2>
			<p style="font-size: 22px; font-weight: 700; margin: 0 0 4px">
				{w.home ? app.toestand.teamName : w.opponent}
				{v} – {t}
				{w.home ? w.opponent : app.toestand.teamName}
			</p>
			<p class="uitleg">{datumMetJaar(w.date)} · {mmss(endTime(w))} gespeeld · {w.formation}</p>

			<h2>Speeltijd</h2>
			<Speeltijd
				rijen={app.toestand.players
					.filter((p) => tijden[p.id] !== undefined)
					.map((p) => ({
						name: p.name,
						seconds: tijden[p.id] ?? 0,
						sub: positionText(positions[p.id], w!.formation)
					}))}
			/>

			<h2>Verloop</h2>
			<Verloop events={w.events} parts={w.parts} formation={w.formation} />

			<h2>Hoe ging het</h2>
			<p class="uitleg">Een paar regels voor jezelf of voor de groepsapp. Gaat mee in het verslag.</p>
			<textarea
				value={w.note ?? ''}
				placeholder="Sterk begin, na rust wegge&#10;zakt. Achterin stond het goed."
				oninput={(e) => app.setNote(e.currentTarget.value)}></textarea>

			<h2>Delen</h2>
			<p class="uitleg">Voor de groepsapp. De wissels laat ik er standaard uit.</p>
			<Verslag bron={bronVanWedstrijd(w, app.toestand.teamName)} />

			<div class="knoprij" style="padding-left: 0; margin-top: 16px">
				{#if w.archived}
					<button disabled>Bewaard in archief</button>
				{:else}
					<button class="prim" onclick={bewaren}>Bewaren in archief</button>
				{/if}
				<a class="knop" href="/app">Nieuwe wedstrijd</a>
			</div>
		{/if}
	</div>
</main>
