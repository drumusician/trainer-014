<script lang="ts">
	import { goto } from '$app/navigation';
	import { mager, presentie } from '$lib/domein/presentie';
	import { app } from '$lib/toestand.svelte';
	import { zetKop } from '$lib/kop.svelte';

	$effect(() => zetKop('Wie is er?', '/app', 'Terug'));

	const w = $derived(app.wedstrijd);
	const afwezig = $derived(new Set(w?.afwezig ?? []));
	const er = $derived(app.toestand.spelers.filter((p) => !afwezig.has(p.id)).length);
	/* Loopt de wedstrijd al, dan is dit geen opzetscherm meer maar een correctie. */
	const bezig = $derived(app.gestart && !w?.afgelopen);
</script>

<main>
	<div class="pad">
		{#if !w}
			<p class="uitleg">Er is geen wedstrijd om spelers voor af te melden.</p>
			<div class="knoprij" style="padding-left: 0"><a class="knop prim" href="/app">Terug</a></div>
		{:else}
			<h2>Tegen wie</h2>
			<div class="tweekolom">
				<label class="vak">
					Tegenstander
					<input
						value={w.tegenstander === 'Tegenstander' ? '' : w.tegenstander}
						placeholder="bijv. Sparta JO11-2"
						onchange={(e) => app.zetTegenstander(e.currentTarget.value)}
					/>
				</label>
				<label class="vak">
					Thuis of uit
					<select
						value={w.thuis ? 'thuis' : 'uit'}
						onchange={(e) => app.zetThuis(e.currentTarget.value === 'thuis')}
					>
						<option value="thuis">Thuis</option>
						<option value="uit">Uit</option>
					</select>
				</label>
			</div>

			<h2>Wie is er vandaag</h2>
			<p class="uitleg">
				{#if bezig}
					De wedstrijd loopt. Wie in het veld staat haal je eruit met een wissel, niet hier — anders klopt zijn
					speeltijd niet meer. Van de bank afmelden kan wel.
				{:else}
					Tik weg wie er niet is. Die staat dan niet op de bank, zodat je hem er langs de lijn niet per ongeluk
					in brengt. Wie al opgesteld stond, laat zijn plek leeg.
				{/if}
			</p>
			<p class="telling">
				<span><b>{er}</b> van de {app.toestand.spelers.length} aanwezig</span>
			</p>

			{#each app.toestand.spelers as p (p.id)}
				{@const weg = afwezig.has(p.id)}
				{@const recent = presentie(app.toestand.trainingen, p.id, 4)}
				<div class="sregel">
					<span class="naam">
						{p.naam}
						{#if mager(recent)}<span class="min mager"> {recent.er}/{recent.totaal} training</span>{/if}
					</span>
					{#if bezig && app.staatInVeld(p.id)}
						<span class="presknop veld">In het veld</span>
					{:else}
						<button class="presknop {weg ? 'nee' : 'ja'}" onclick={() => app.zetAfwezig(p.id, !weg)}>
							{weg ? 'Er niet' : 'Er wel'}
						</button>
					{/if}
				</div>
			{/each}

			<div class="knoprij" style="padding-left: 0; margin-top: 16px">
				{#if bezig}
					<a class="knop prim" href="/app/wedstrijd">Terug naar de wedstrijd</a>
				{:else}
					<a class="knop prim" href="/app/opstelling/wedstrijd">Verder naar de opstelling</a>
				{/if}
			</div>
		{/if}
	</div>
</main>
