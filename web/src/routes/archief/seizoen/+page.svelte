<script lang="ts">
	import Speeltijd from '$lib/componenten/Speeltijd.svelte';
	import { mager, presentie } from '$lib/domein/presentie';
	import { seizoenStand, seizoenTotalen, topscorers } from '$lib/domein/seizoen';
	import { app } from '$lib/toestand.svelte';
	import { zetKop } from '$lib/kop.svelte';

	$effect(() => zetKop('Seizoen', '/archief', 'Terug'));

	const t = $derived(app.toestand);
	const st = $derived(seizoenStand(t.archief));
	const rijen = $derived(seizoenTotalen(t.archief, t.spelers));
	const makers = $derived(topscorers(rijen));

	const presentieRijen = $derived(
		t.spelers
			.map((p) => ({
				naam: p.naam,
				alles: presentie(t.trainingen, p.id, 0),
				recent: presentie(t.trainingen, p.id, 4)
			}))
			.filter((r) => r.alles.totaal > 0)
			.sort(
				(a, b) =>
					a.recent.er / Math.max(1, a.recent.totaal) - b.recent.er / Math.max(1, b.recent.totaal) ||
					a.naam.localeCompare(b.naam)
			)
	);
</script>

<main>
	<div class="pad">
		<h2>Seizoen</h2>
		{#if !t.archief.length && !t.trainingen.length}
			<p class="uitleg">
				Nog geen bewaarde wedstrijden en geen trainingen. Sluit een wedstrijd af en bewaar hem, dan telt hij hier mee.
			</p>
		{:else if t.archief.length}
			<p style="font-size: 22px; font-weight: 700; margin: 0 0 4px">
				{st.wedstrijden}
				{st.wedstrijden === 1 ? 'wedstrijd' : 'wedstrijden'} · {st.gewonnen}W {st.gelijk}G {st.verloren}V
			</p>
			<p class="uitleg">
				{st.voor} voor, {st.tegen} tegen · {Math.round(st.seconden / 60)} minuten voetbal
			</p>

			{#if makers.length}
				<h2>Topscorers</h2>
				<ul class="log">
					{#each makers as r (r.naam)}
						<li><b>{r.doelpunten}×</b><span>{r.naam}</span></li>
					{/each}
				</ul>
			{/if}

			<h2>Speeltijd totaal</h2>
			<Speeltijd
				rijen={rijen.map((r) => ({
					naam: r.naam,
					seconden: r.seconden,
					sub:
						r.wedstrijden +
						(r.wedstrijden === 1 ? ' wedstrijd' : ' wedstrijden') +
						' · gem. ' +
						Math.round(r.seconden / 60 / Math.max(1, r.wedstrijden)) +
						' min' +
						(r.keeper ? ' · ' + Math.round(r.keeper / 60) + ' min in het doel' : '')
				}))}
			/>
			<p class="uitleg" style="margin-top: 12px">
				Opgeteld over alles wat in het archief staat. Een wedstrijd waarin iemand niet in het veld kwam, telt bij hem
				niet als wedstrijd mee.
			</p>
		{:else}
			<p class="uitleg">Nog geen bewaarde wedstrijden.</p>
		{/if}

		{#if presentieRijen.length}
			<h2>Presentie training</h2>
			<p class="uitleg">Bovenaan wie de laatste vier keer het minst kwam. Rechts staat die laatste vier.</p>
			<table class="uitslag">
				<tbody>
					{#each presentieRijen as r (r.naam)}
						<tr>
							<td>{r.naam}<span class="sub">{r.alles.er} van de {r.alles.totaal} dit seizoen</span></td>
							<td class="m" class:mager={mager(r.recent)}>{r.recent.er}/{r.recent.totaal}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}

		<div class="knoprij" style="padding-left: 0; margin-top: 16px">
			<a class="knop prim" href="/archief">Terug naar de wedstrijden</a>
		</div>
	</div>
</main>
