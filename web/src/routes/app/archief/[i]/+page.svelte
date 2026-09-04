<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import Speeltijd from '$lib/componenten/Speeltijd.svelte';
	import Verloop from '$lib/componenten/Verloop.svelte';
	import Verslag from '$lib/componenten/Verslag.svelte';
	import { mmss, positieTekst } from '$lib/domein/tijd';
	import { datumKort, datumMetJaar } from '$lib/domein/datum';
	import { gebeurtenisTekst } from '$lib/domein/verslag';
	import { bronVanArchief } from '$lib/domein/verslag';
	import { app } from '$lib/toestand.svelte';
	import { zetKop } from '$lib/kop.svelte';

	const i = $derived(Number(page.params.i));
	const a = $derived(app.toestand.archief[i]);

	$effect(() => zetKop(a ? datumKort(a.datum) + ' · ' + a.tegenstander : 'Archief', '/app/archief', 'Terug'));

	/** De naam van nu, ook als iemand na de wedstrijd hernoemd is. */
	function naamNu(r: { id?: string; naam: string }) {
		return (r.id && app.spelerVan(r.id)?.naam) || r.naam;
	}

	let bewerken = $state(false);
	let nieuwMinuut = $state('');
	let nieuwMaker = $state('');
	let nieuwTegen = $state(false);

	/* Wie er die wedstrijd speelde, voor het lijstje makers. */
	const makers = $derived(
		(a?.speeltijd ?? [])
			.filter((r) => (r.seconden ?? 0) > 0)
			.map((r) => ({ id: r.id ?? '', naam: naamNu(r) }))
			.filter((r) => r.id)
	);

	function doelpuntErbij() {
		const m = Number(nieuwMinuut);
		if (!Number.isFinite(m) || m < 0) {
			alert('Vul een minuut in.');
			return;
		}
		app.voegDoelpuntToe(i, m, nieuwTegen ? null : nieuwMaker || null, nieuwTegen);
		nieuwMinuut = '';
		nieuwMaker = '';
	}

	function verwijder() {
		if (!confirm('De wedstrijd tegen ' + a.tegenstander + ' van ' + a.datum + ' uit het archief verwijderen?')) return;
		app.verwijderUitArchief(i);
		goto('/app/archief');
	}
</script>

<main>
	<div class="pad">
		{#if !a}
			<p class="uitleg">Deze wedstrijd staat er niet meer.</p>
			<div class="knoprij" style="padding-left: 0"><a class="knop prim" href="/app/archief">Terug</a></div>
		{:else}
			{@const thuis = a.thuis !== false}
			<h2>Uitslag</h2>
			<p style="font-size: 22px; font-weight: 700; margin: 0 0 4px">
				{thuis ? 'O14' : a.tegenstander} {a.stand[0]} – {a.stand[1]} {thuis ? a.tegenstander : 'O14'}
			</p>
			<p class="uitleg">{datumMetJaar(a.datum)} · {mmss(a.duur ?? 0)} gespeeld · {a.formatie}</p>
			<div class="knoprij" style="padding-left: 0">
				<button onclick={() => (bewerken = !bewerken)}>{bewerken ? 'Klaar met bijwerken' : 'Bijwerken'}</button>
			</div>

			{#if bewerken}
				<div class="tweekolom">
					<label class="vak">
						Datum
						<input type="date" value={a.datum} onchange={(e) => app.wijzigArchief(i, { datum: e.currentTarget.value })} />
					</label>
					<label class="vak">
						Thuis of uit
						<select value={a.thuis !== false ? 'thuis' : 'uit'} onchange={(e) => app.wijzigArchief(i, { thuis: e.currentTarget.value === 'thuis' })}>
							<option value="thuis">Thuis</option>
							<option value="uit">Uit</option>
						</select>
					</label>
				</div>
				<label class="vak">
					Tegenstander
					<input value={a.tegenstander} onchange={(e) => app.wijzigArchief(i, { tegenstander: e.currentTarget.value })} />
				</label>
			{/if}

			<h2>Speeltijd</h2>
			<Speeltijd
				rijen={(a.speeltijd ?? []).map((r) => ({
					naam: naamNu(r),
					seconden: r.seconden ?? 0,
					/* oudere wedstrijden hebben alleen keeperminuten, nieuwere alle plekken */
					sub: positieTekst(r.posities, a.formatie) ||
						(r.keeper ? Math.round(r.keeper / 60) + ' min in het doel' : undefined)
				}))}
			/>

			<h2>Verloop</h2>
			{#if !bewerken}
				<Verloop gebeurtenissen={a.gebeurtenissen ?? []} namen={a.namen} delen={a.delen} />
			{:else}
				<p class="uitleg">
					Een doelpunt dat er niet was kun je weghalen; de stand telt vanzelf opnieuw. Wissels blijven staan, want
					daar hangt de speeltijd aan.
				</p>
				<ul class="log">
					{#each a.gebeurtenissen ?? [] as g, index (index)}
						<li>
							<b>{mmss(g.t)}</b>
							<span>{gebeurtenisTekst(g, app.toestand.spelers, a.namen, a.delen)}</span>
							{#if g.type === 'goal' || g.type === 'tegen'}
								<button class="klein uit" onclick={() => app.verwijderDoelpunt(i, index)}>Weg</button>
							{/if}
						</li>
					{/each}
				</ul>

				<h2>Doelpunt erbij</h2>
				<div class="tweekolom">
					<label class="vak">
						Minuut
						<input type="number" inputmode="numeric" bind:value={nieuwMinuut} placeholder="35" />
					</label>
					<label class="vak">
						Voor of tegen
						<select bind:value={nieuwTegen}>
							<option value={false}>Voor O14</option>
							<option value={true}>Tegen</option>
						</select>
					</label>
				</div>
				{#if !nieuwTegen}
					<label class="vak">
						Wie scoorde
						<select bind:value={nieuwMaker}>
							<option value="">Weet ik niet</option>
							{#each makers as m (m.id)}<option value={m.id}>{m.naam}</option>{/each}
						</select>
					</label>
				{/if}
				<div class="knoprij" style="padding-left: 0">
					<button class="prim" onclick={doelpuntErbij}>Toevoegen</button>
				</div>
			{/if}

			<h2>Hoe ging het</h2>
			<textarea
				value={a.notitie ?? ''}
				placeholder="Nog niets opgeschreven."
				oninput={(e) => app.zetArchiefNotitie(i, e.currentTarget.value)}
			></textarea>

			<h2>Delen</h2>
			<Verslag bron={bronVanArchief(a)} />

			<div class="knoprij" style="padding-left: 0; margin-top: 16px">
				<a class="knop prim" href="/app/archief">Terug</a>
				<button class="uit" onclick={verwijder}>Verwijderen</button>
			</div>
		{/if}
	</div>
</main>
