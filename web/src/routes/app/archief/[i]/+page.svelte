<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import Speeltijd from '$lib/components/Speeltijd.svelte';
	import Verloop from '$lib/components/Verloop.svelte';
	import Verslag from '$lib/components/Verslag.svelte';
	import { mmss, positionText } from '$lib/domain/time';
	import { shortDate, datumMetJaar } from '$lib/domain/dates';
	import { timelineRows } from '$lib/domain/report';
	import { bronVanArchief } from '$lib/domain/report';
	import { app } from '$lib/store.svelte';
	import { zetKop } from '$lib/header.svelte';

	const i = $derived(Number(page.params.i));
	const a = $derived(app.toestand.archive[i]);
	/* Afgeleid, niet in de template aangeroepen: dat rekent bij elke render opnieuw. */
	const regels = $derived(a ? timelineRows(a.events ?? [], app.toestand.players, a.names, a.parts, a.formation) : []);

	$effect(() => zetKop(a ? shortDate(a.date) + ' · ' + a.opponent : 'Wedstrijd', '/app', 'Terug'));

	/** De naam van nu, ook als iemand na de wedstrijd hernoemd is. */
	function naamNu(r: { id?: string; name: string }) {
		return (r.id && app.playerById(r.id)?.name) || r.name;
	}

	let bewerken = $state(false);
	let nieuwMinuut = $state('');
	let nieuwMaker = $state('');
	let nieuwTegen = $state(false);

	/* Wie er die wedstrijd speelde, voor het lijstje makers. */
	const makers = $derived(
		(a?.playingTime ?? [])
			.filter((r) => (r.seconds ?? 0) > 0)
			.map((r) => ({ id: r.id ?? '', name: naamNu(r) }))
			.filter((r) => r.id)
	);

	function doelpuntErbij() {
		const m = Number(nieuwMinuut);
		if (!Number.isFinite(m) || m < 0) {
			alert('Vul een minuut in.');
			return;
		}
		app.addGoal(i, m, nieuwTegen ? null : nieuwMaker || null, nieuwTegen);
		nieuwMinuut = '';
		nieuwMaker = '';
	}

	function verwijder() {
		if (!confirm('De wedstrijd tegen ' + a.opponent + ' van ' + a.date + ' uit het archief verwijderen?')) return;
		app.removeFromArchive(i);
		goto('/app');
	}
</script>

<main>
	<div class="pad">
		{#if !a}
			<p class="uitleg">Deze match staat er niet meer.</p>
			<div class="knoprij" style="padding-left: 0"><a class="knop prim" href="/app">Terug</a></div>
		{:else}
			{@const home = a.home !== false}
			{@const ons = a.teamName?.trim() || app.toestand.teamName}
			<h2>Uitslag</h2>
			<p style="font-size: 22px; font-weight: 700; margin: 0 0 4px">
				{home ? ons : a.opponent}
				{a.score[0]} – {a.score[1]}
				{home ? a.opponent : ons}
			</p>
			<p class="uitleg">{datumMetJaar(a.date)} · {mmss(a.duration ?? 0)} gespeeld · {a.formation}</p>
			<div class="knoprij" style="padding-left: 0">
				<button onclick={() => (bewerken = !bewerken)}>{bewerken ? 'Klaar met bijwerken' : 'Bijwerken'}</button>
			</div>

			{#if bewerken}
				<div class="tweekolom">
					<label class="vak">
						Datum
						<input
							type="date"
							value={a.date}
							onchange={(e) => app.updateArchived(i, { date: e.currentTarget.value })}
						/>
					</label>
					<label class="vak">
						Thuis of uit
						<select
							value={a.home !== false ? 'thuis' : 'uit'}
							onchange={(e) => app.updateArchived(i, { home: e.currentTarget.value === 'thuis' })}
						>
							<option value="thuis">Thuis</option>
							<option value="uit">Uit</option>
						</select>
					</label>
				</div>
				<label class="vak">
					Tegenstander
					<input value={a.opponent} onchange={(e) => app.updateArchived(i, { opponent: e.currentTarget.value })} />
				</label>
			{/if}

			<h2>Speeltijd</h2>
			<Speeltijd
				rijen={(a.playingTime ?? []).map((r) => ({
					name: naamNu(r),
					seconds: r.seconds ?? 0,
					/* oudere wedstrijden hebben alleen keeperminuten, nieuwere alle positionsOf */
					sub:
						positionText(r.positions, a.formation) ||
						(r.keeper ? Math.round(r.keeper / 60) + ' min in het doel' : undefined)
				}))}
			/>

			<h2>Verloop</h2>
			{#if !bewerken}
				<Verloop events={a.events ?? []} names={a.names} parts={a.parts} formation={a.formation} />
			{:else}
				<p class="uitleg">
					Een doelpunt dat er niet was kun je weghalen; de score telt vanzelf opnieuw. Wissels blijven staan, want daar
					hangt de playingTime aan.
				</p>
				<ul class="log">
					{#each regels as r (r.index)}
						<li>
							<b>{mmss(r.t)}</b>
							<span>{r.tekst}</span>
							{#if r.type === 'goal' || r.type === 'conceded'}
								<button class="klein uit" onclick={() => app.removeGoal(i, r.index)}>Weg</button>
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
							<option value={false}>Voor {ons}</option>
							<option value={true}>Tegen</option>
						</select>
					</label>
				</div>
				{#if !nieuwTegen}
					<label class="vak">
						Wie scoorde
						<select bind:value={nieuwMaker}>
							<option value="">Weet ik niet</option>
							{#each makers as m (m.id)}<option value={m.id}>{m.name}</option>{/each}
						</select>
					</label>
				{/if}
				<div class="knoprij" style="padding-left: 0">
					<button class="prim" onclick={doelpuntErbij}>Toevoegen</button>
				</div>
			{/if}

			<h2>Hoe ging het</h2>
			<textarea
				value={a.note ?? ''}
				placeholder="Nog niets opgeschreven."
				oninput={(e) => app.setArchiveNote(i, e.currentTarget.value)}></textarea>

			<h2>Delen</h2>
			<Verslag bron={bronVanArchief(a)} />

			<div class="knoprij" style="padding-left: 0; margin-top: 16px">
				<a class="knop prim" href="/app">Terug</a>
				<button class="uit" onclick={verwijder}>Verwijderen</button>
			</div>
		{/if}
	</div>
</main>
