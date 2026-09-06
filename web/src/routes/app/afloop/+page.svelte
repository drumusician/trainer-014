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
	import { text } from '$lib/text/nl';

	const w = $derived(app.match);
	const tijden = $derived(playingTimes(w, app.toestand.players, app.nu));
	const positions = $derived(positionTimes(w, app.nu));

	/* Not a back button but an exit: walking back into the finished match screen
	   helps nobody. */
	$effect(() => zetKop(text.afterMatch.title, '/app', text.afterMatch.toStart, null, true));

	function bewaren() {
		if (app.archiveMatch()) goto('/app');
	}
</script>

<main>
	<div class="pad">
		{#if !w}
			<p class="uitleg">{text.afterMatch.noMatch}</p>
		{:else}
			{@const [v, t] = score(w)}
			<h2>{text.afterMatch.resultHeading}</h2>
			<p style="font-size: 22px; font-weight: 700; margin: 0 0 4px">
				{w.home ? app.toestand.teamName : w.opponent}
				{v} – {t}
				{w.home ? w.opponent : app.toestand.teamName}
			</p>
			<p class="uitleg">{text.afterMatch.details(datumMetJaar(w.date), mmss(endTime(w)), w.formation)}</p>

			<h2>{text.afterMatch.playingTimeHeading}</h2>
			<Speeltijd
				rijen={app.toestand.players
					.filter((p) => tijden[p.id] !== undefined)
					.map((p) => ({
						name: p.name,
						seconds: tijden[p.id] ?? 0,
						sub: positionText(positions[p.id], w!.formation)
					}))}
			/>

			<h2>{text.afterMatch.timelineHeading}</h2>
			<Verloop events={w.events} parts={w.parts} formation={w.formation} />

			<h2>{text.afterMatch.noteHeading}</h2>
			<p class="uitleg">{text.afterMatch.noteHint}</p>
			<textarea
				value={w.note ?? ''}
				placeholder={text.afterMatch.notePlaceholder}
				oninput={(e) => app.setNote(e.currentTarget.value)}></textarea>

			<h2>{text.afterMatch.shareHeading}</h2>
			<p class="uitleg">{text.afterMatch.shareHint}</p>
			<Verslag bron={bronVanWedstrijd(w, app.toestand.teamName)} />

			<div class="knoprij" style="padding-left: 0; margin-top: 16px">
				{#if w.archived}
					<button disabled>{text.afterMatch.archived}</button>
				{:else}
					<button class="prim" onclick={bewaren}>{text.afterMatch.archive}</button>
				{/if}
				<a class="knop" href="/app">{text.afterMatch.newMatch}</a>
			</div>
		{/if}
	</div>
</main>
